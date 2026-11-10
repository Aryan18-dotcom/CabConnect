import { randomBytes } from 'node:crypto';
import { collection } from '../db/index.js';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { sendBookingRejectionEmail, sendConfirmationEmail, sendInquiryEmail, sendRejectionEmail } from '../services/email.js';
import { getBusinessSettings, saveBusinessSettings, toPublicBusinessSettings } from '../services/business-settings.js';
import { createRouter } from '../server/router.js';

const router = createRouter();
const allowed = new Set(['customers','inquiries','bookings','vehicles','drivers','partners','assignments','availabilityBlocks','quotations','payments','expenses','notifications','settings','auditLogs']);

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validTripDates(start, end) {
  return validDate(start) && validDate(end) && end >= start;
}

function validImageUrl(value) {
  if (!value) return true;
  try {
    return ['http:', 'https:'].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

async function getAvailableFleet(start, end, passengers = 0, excludeBookingId = '') {
  const [vehicles, drivers, bookings] = await Promise.all([
    collection('vehicles').find(),
    collection('drivers').find(),
    collection('bookings').find()
  ]);
  const driverById = new Map(drivers.map(driver => [String(driver._id), driver]));
  const reserved = bookings.filter(booking => {
    if (String(booking._id) === String(excludeBookingId)) return false;
    if (['CANCELLED', 'REJECTED', 'LOST'].includes(booking.status)) return false;
    if (!booking.vehicleId || booking.vehicleSource === 'EXTERNAL') return false;
    const bookingStart = String(booking.pickupDate || '');
    const bookingEnd = String(booking.bufferDate || booking.returnDate || booking.pickupDate || '');
    return bookingStart && bookingEnd && bookingStart <= end && bookingEnd >= start;
  });
  const reservedIds = new Set(reserved.map(booking => String(booking.vehicleId)));
  return vehicles.filter(vehicle => {
    if (vehicle.ownershipType === 'PARTNER') return false;
    if (['INACTIVE', 'MAINTENANCE'].includes(vehicle.operationalStatus)) return false;
    if (vehicle.availabilityStatus === 'UNAVAILABLE' || reservedIds.has(String(vehicle._id))) return false;
    const capacity = Number(vehicle.maxPassengers || vehicle.seatingCapacity || 0);
    return !passengers || !capacity || capacity >= passengers;
  }).map(vehicle => ({
    ...vehicle,
    _id: String(vehicle._id),
    driver: driverById.get(String(vehicle.primaryDriverId || '')) || null
  }));
}

// Public endpoints expose only the minimum data needed by customers.
router.get('/public/business', async (_req, res, next) => {
  try {
    const settings = await getBusinessSettings();
    res.json({ ...toPublicBusinessSettings(settings), googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY || '' });
  } catch (e) { next(e); }
});
router.get('/public/vehicles', async (_req, res, next) => {
  try {
    const vehicles = await collection('vehicles').find();
    res.json(vehicles.filter(vehicle =>
      vehicle.ownershipType !== 'PARTNER' &&
      vehicle.operationalStatus !== 'INACTIVE' &&
      vehicle.operationalStatus !== 'MAINTENANCE' &&
      Number(vehicle.perKilometerRate) > 0 &&
      Number(vehicle.driverDailyCost) >= 0
    ).map(vehicle => ({
      id: String(vehicle._id),
      name: String(vehicle.vehicleName || vehicle.model || vehicle.manufacturer || '').trim(),
      fuelType: vehicle.fuelType || '',
      minPassengers: Number(vehicle.minPassengers || 1),
      maxPassengers: Number(vehicle.maxPassengers || vehicle.seatingCapacity || 0),
      luggageStorageType: vehicle.luggageStorageType || '',
      imageUrl: String(vehicle.imageUrl || ''),
      perKilometerRate: Number(vehicle.perKilometerRate),
      driverDailyCost: Number(vehicle.driverDailyCost)
    })).filter(vehicle => vehicle.name));
  } catch (e) { next(e); }
});
router.get('/public/inquiries/:reference/status', async (req, res, next) => {
  try {
    const reference = String(req.params.reference || '').trim().toUpperCase();
    const inquiry = await collection('inquiries').findOne({ inquiryReference: reference });
    if (!inquiry) {
      const booking = await collection('bookings').findOne({ bookingReference: reference });
      if (!booking) return res.status(404).json({ error: 'Inquiry or booking not found. Check the reference and try again.' });
      return res.json({
        inquiryReference: booking.bookingReference,
        status: booking.status || 'TENTATIVE',
        createdAt: booking.createdAt || '',
        pickupDate: booking.pickupDate || '',
        returnDate: booking.returnDate || '',
        bufferDate: booking.bufferDate || '',
        rejectionNote: booking.status === 'REJECTED' ? String(booking.rejectionNote || '') : '',
        bookingReference: booking.bookingReference || ''
      });
    }
    let bookingReference = '';
    let status = inquiry.status || 'NEW';
    let rejectionNote = status === 'REJECTED' ? String(inquiry.rejectionNote || '') : '';
    if (inquiry.status === 'CONVERTED' && inquiry.bookingId) {
      const booking = await collection('bookings').findOne({ _id: String(inquiry.bookingId) });
      bookingReference = String(booking?.bookingReference || '');
      if (booking?.status === 'REJECTED') {
        status = 'REJECTED';
        rejectionNote = String(booking.rejectionNote || '');
      }
    }
    res.json({
      inquiryReference: inquiry.inquiryReference,
      status,
      createdAt: inquiry.createdAt || '',
      pickupDate: inquiry.pickupDate || '',
      returnDate: inquiry.returnDate || '',
      bufferDate: inquiry.bufferDate || '',
      rejectionNote,
      bookingReference
    });
  } catch (e) { next(e); }
});
router.post('/public/inquiries', async (req, res, next) => {
  try {
    const body = req.body || {};
    const required = ['customerName','phone','email','pickup','destination','pickupDate'];
    for (const key of required) if (!String(body[key] || '').trim()) return res.status(400).json({ error: `${key} is required.` });
    const phone = String(body.phone).replace(/\D/g, '');
    if (!/^\d{10}$/.test(phone)) return res.status(400).json({ error: 'Enter a valid 10-digit mobile number without +91.' });
    const email = String(body.email).trim().slice(0, 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (body.returnDate && !validTripDates(body.pickupDate, body.returnDate)) return res.status(400).json({ error: 'Enter a valid return date on or after the starting date.' });
    if (body.bufferDate && (!validDate(body.bufferDate) || body.bufferDate < (body.returnDate || body.pickupDate))) return res.status(400).json({ error: 'Buffer date must be on or after the return date.' });
    if (body.consent !== true && body.consent !== 'true' && body.consent !== 'on') return res.status(400).json({ error: 'Please confirm how we will use your phone number.' });
    const returnDate = String(body.returnDate || '');
    const bufferDate = String(body.bufferDate || '');
    const tripType = String(body.tripType || 'ONE_WAY');
    if (!['ONE_WAY', 'ROUND_TRIP', 'LOCAL'].includes(tripType)) return res.status(400).json({ error: 'Choose a valid trip type.' });
    const estimatedKm = Number(body.estimatedKm);
    const passengers = Number(body.passengers);
    const selectedIds = Array.isArray(body.preferredVehicleIds) ? [...new Set(body.preferredVehicleIds.map(String))] : [];
    if (!returnDate || !validTripDates(body.pickupDate, returnDate)) return res.status(400).json({ error: 'A valid starting date and return date are required.' });
    if (!Number.isFinite(estimatedKm) || estimatedKm <= 0 || estimatedKm > 10000) return res.status(400).json({ error: 'Enter an estimated trip distance between 1 and 10,000 km.' });
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > 20) return res.status(400).json({ error: 'Enter a passenger count between 1 and 20.' });
    if (selectedIds.length < 1 || selectedIds.length > 3) return res.status(400).json({ error: 'Select between one and three vehicles to compare.' });
    const fleet = await collection('vehicles').find();
    const vehicleById = new Map(fleet.map(vehicle => [String(vehicle._id), vehicle]));
    const pricingEndDate = bufferDate || returnDate;
    const days = Math.floor((Date.parse(`${pricingEndDate}T00:00:00Z`) - Date.parse(`${body.pickupDate}T00:00:00Z`)) / 86400000) + 1;
    const estimatedPricing = [];
    for (const id of selectedIds) {
      const vehicle = vehicleById.get(id);
      if (!vehicle || vehicle.ownershipType === 'PARTNER' || vehicle.operationalStatus === 'INACTIVE' || vehicle.operationalStatus === 'MAINTENANCE' || !vehicle.vehicleName) {
        return res.status(400).json({ error: 'One of the selected vehicles is no longer available for estimates. Please refresh the vehicle list.' });
      }
      const perKilometerRate = Number(vehicle.perKilometerRate);
      const driverDailyCost = Number(vehicle.driverDailyCost);
      const maxPassengers = Number(vehicle.maxPassengers || vehicle.seatingCapacity || 0);
      if (!(perKilometerRate > 0) || !(driverDailyCost >= 0) || (maxPassengers && maxPassengers < passengers)) {
        return res.status(400).json({ error: 'A selected vehicle does not have valid pricing or passenger capacity.' });
      }
      estimatedPricing.push({
        vehicleId: id,
        vehicleName: String(vehicle.vehicleName).trim(),
        estimatedKm,
        perKilometerRate,
        distanceCost: estimatedKm * perKilometerRate,
        days,
        driverDailyCost,
        driverCost: days * driverDailyCost,
        estimatedTotal: estimatedKm * perKilometerRate + days * driverDailyCost
      });
    }
    const inquiryReference = `INQ-${new Date().getFullYear()}-${randomBytes(8).toString('hex').toUpperCase()}`;
    const inquiry = await collection('inquiries').insert({
      inquiryReference,
      customerName: String(body.customerName).trim().slice(0,120),
      phone, email,
      tripType,
      pickup: String(body.pickup).trim().slice(0,300),
      destination: String(body.destination).trim().slice(0,300),
      pickupDate: body.pickupDate, returnDate, bufferDate,
      pickupTime: body.pickupTime || '', vehiclePreference: body.vehiclePreference || 'ANY',
      preferredVehicles: estimatedPricing.map(price => price.vehicleName),
      preferredVehicleIds: selectedIds,
      estimatedPricing,
      passengers,
      estimatedKm,
      notes: String(body.notes || '').slice(0,2000),
      phoneConsent: true,
      status: 'NEW', source: 'WEBSITE', createdAt: new Date().toISOString()
    });
    let emailSent = false;
    try {
      await sendInquiryEmail(inquiry);
      emailSent = true;
    } catch (error) {
      console.error(`Inquiry email delivery failed for ${inquiryReference}:`, error);
    }
    res.status(201).json({
      inquiryReference,
      id: String(inquiry._id),
      message: 'Inquiry submitted.',
      emailSent,
      emailWarning: emailSent ? '' : 'Your inquiry was saved, but we could not send the email. Please save your inquiry reference.'
    });
  } catch (e) { next(e); }
});

router.use(requireAuth);

router.get('/settings', requireRole('admin', 'owner'), async (_req, res, next) => {
  try {
    const settings = await getBusinessSettings();
    res.json({
      businessName: settings.businessName,
      phone: settings.phone,
      businessEmail: settings.businessEmail,
      timezone: settings.timezone,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      hasSmtpPassword: Boolean(settings.smtpPasswordEncrypted || settings.smtpPassword)
    });
  } catch (error) { next(error); }
});
router.put('/settings', requireRole('admin', 'owner'), async (req, res, next) => {
  try {
    const settings = await saveBusinessSettings(req.body || {});
    await collection('auditLogs').insert({
      actor: req.session.user.username,
      action: 'UPDATE',
      resource: 'settings',
      recordId: String(settings._id),
      at: new Date().toISOString()
    });
    res.json({
      businessName: settings.businessName,
      phone: settings.phone,
      businessEmail: settings.businessEmail,
      timezone: settings.timezone,
      smtpUser: settings.smtpUser,
      smtpFrom: settings.smtpFrom,
      hasSmtpPassword: Boolean(settings.smtpPasswordEncrypted || settings.smtpPassword)
    });
  } catch (error) {
    if (error.status === 400) return res.status(400).json({ error: error.message });
    next(error);
  }
});

router.get('/me', (req, res) => res.json({ user: req.session.user }));
router.get('/vehicles/availability', async (req, res, next) => {
  try {
    const start = String(req.query.start || '');
    const end = String(req.query.end || start);
    const passengers = Math.max(0, Number(req.query.passengers || 0));
    if (!validTripDates(start, end)) return res.status(400).json({ error: 'Choose valid trip dates before checking vehicle availability.' });
    const vehicles = await getAvailableFleet(start, end, passengers, String(req.query.excludeBookingId || ''));
    res.json({
      vehicles: vehicles.map(({ driver, ...vehicle }) => ({
        _id: vehicle._id,
        registrationNumber: vehicle.registrationNumber || vehicle.vehicleName || 'Fleet vehicle',
        fuelType: vehicle.fuelType || '',
        maxPassengers: Number(vehicle.maxPassengers || vehicle.seatingCapacity || 0),
        driverName: driver?.name || ''
      })),
      externalVehicleRecommended: vehicles.length === 0
    });
  } catch (e) { next(e); }
});
router.get('/bookings/:id', async (req, res, next) => {
  try {
    const booking = await collection('bookings').findOne({ _id: req.params.id });
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ ...booking, _id: String(booking._id) });
  } catch (e) { next(e); }
});
router.get('/summary', async (_req, res, next) => {
  try {
    const [inquiries, bookings, vehicles, payments] = await Promise.all([
      collection('inquiries').find(), collection('bookings').find(),
      collection('vehicles').find(), collection('payments').find()
    ]);
    const today = new Date().toISOString().slice(0,10);
    res.json({
      inquiries: inquiries.length,
      newInquiries: inquiries.filter(x => x.status === 'NEW').length,
      bookings: bookings.length,
      todayBookings: bookings.filter(x => String(x.pickupDate || '').slice(0,10) === today).length,
      activeTrips: bookings.filter(x => ['ONGOING','IN_PROGRESS'].includes(x.status)).length,
      vehicles: vehicles.length,
      availableVehicles: vehicles.filter(x => x.operationalStatus === 'ACTIVE' && x.availabilityStatus !== 'UNAVAILABLE').length,
      paymentsReceived: payments.reduce((s,p) => s + Number(p.amount || 0), 0)
    });
  } catch(e) { next(e); }
});

router.get('/calendar/events', async (req, res, next) => {
  try {
    const bookings = await collection('bookings').find();
    const blocks = await collection('availabilityBlocks').find();
    const events = [
      ...bookings.map(b => ({ id: String(b._id), title: `${b.bookingReference || 'Booking'} · ${b.customerName || ''}`, start: b.pickupDate, end: b.bufferDate || b.returnDate || b.pickupDate, color: b.status === 'CONFIRMED' ? '#16a36a' : '#d99128', extendedProps: { kind:'booking', status:b.status, vehicleId:b.vehicleId } })),
      ...blocks.map(b => ({ id: String(b._id), title: b.title || b.type, start:b.start, end:b.end, color:'#64748b', extendedProps:{kind:'block',type:b.type} }))
    ];
    res.json(events);
  } catch(e) { next(e); }
});

router.get('/:resource', async (req, res, next) => {
  try {
    if (!allowed.has(req.params.resource)) return res.status(404).json({ error: 'Resource not found' });
    if (req.params.resource === 'settings') return res.status(405).json({ error: 'Use the settings page to manage business and email configuration.' });
    const rows = await collection(req.params.resource).find();
    res.json(rows.map(x => ({ ...x, _id: String(x._id) })));
  } catch(e) { next(e); }
});
router.post('/:resource', async (req, res, next) => {
  try {
    const name = req.params.resource;
    if (!allowed.has(name)) return res.status(404).json({ error: 'Resource not found' });
    if (name === 'settings') return res.status(405).json({ error: 'Use the settings page to manage business and email configuration.' });
    const body = { ...req.body };
    delete body._id;
    if (name === 'bookings') {
      if (!validTripDates(body.pickupDate, body.returnDate || body.pickupDate)) return res.status(400).json({ error: 'Enter a valid return date on or after the starting date.' });
      body.returnDate ||= body.pickupDate;
      if (body.bufferDate && (!validDate(body.bufferDate) || body.bufferDate < body.returnDate)) return res.status(400).json({ error: 'Buffer date must be on or after the return date.' });
      body.tripType = String(body.tripType || 'ONE_WAY');
      if (!['ONE_WAY', 'ROUND_TRIP', 'LOCAL'].includes(body.tripType)) return res.status(400).json({ error: 'Choose a valid trip type.' });
      body.customerEmail = String(body.customerEmail || '').trim().slice(0, 160);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.customerEmail)) return res.status(400).json({ error: 'Enter a valid customer email address.' });
      const endDate = body.bufferDate || body.returnDate;
      const available = await getAvailableFleet(body.pickupDate, endDate, Number(body.passengers || 0));
      if (body.vehicleId === 'OUTSIDE') body.vehicleId = '';
      if (body.vehicleId && !available.some(vehicle => String(vehicle._id) === String(body.vehicleId))) {
        return res.status(409).json({ error: 'That vehicle is not available for the selected dates or passenger count.' });
      }
      if (body.vehicleId) {
        const selected = available.find(vehicle => String(vehicle._id) === String(body.vehicleId));
        body.vehicleSource = 'FLEET';
        body.driverId = String(selected.primaryDriverId || '');
      } else {
        body.vehicleSource = 'EXTERNAL';
        body.vehicleLabel = 'Outside vehicle';
        body.driverId = '';
      }
      body.status ||= 'TENTATIVE';
      body.bookingReference ||= `CAB-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`;
    }
    if (name === 'vehicles') {
      body.vehicleName = String(body.vehicleName || '').trim().slice(0, 100);
      body.imageUrl = String(body.imageUrl || '').trim().slice(0, 2000);
      body.perKilometerRate = Number(body.perKilometerRate);
      body.driverDailyCost = Number(body.driverDailyCost);
      if (!body.vehicleName) return res.status(400).json({ error: 'Car name or model is required for customer price estimates.' });
      if (!validImageUrl(body.imageUrl)) return res.status(400).json({ error: 'Vehicle image must be an HTTP or HTTPS URL.' });
      if (!Number.isFinite(body.perKilometerRate) || body.perKilometerRate <= 0) return res.status(400).json({ error: 'Price per km must be greater than zero.' });
      if (!Number.isFinite(body.driverDailyCost) || body.driverDailyCost < 0) return res.status(400).json({ error: 'Driver cost per day must be zero or more.' });
      body.operationalStatus ||= 'ACTIVE';
      body.availabilityStatus ||= 'AVAILABLE';
    }
    if (name === 'inquiries') body.status ||= 'NEW';
    if (name === 'vehicles' && body.primaryDriverId) {
      const driver = await collection('drivers').findOne({ _id: String(body.primaryDriverId) });
      if (!driver) return res.status(400).json({ error: 'Selected driver was not found.' });
      const previousVehicleId = String(driver.vehicleId || '');
      if (previousVehicleId) {
        const previousVehicle = await collection('vehicles').findOne({ _id: previousVehicleId });
        if (previousVehicle && String(previousVehicle.primaryDriverId || '') === String(driver._id)) {
          await collection('vehicles').update(previousVehicleId, { primaryDriverId: '' });
        }
      }
    }
    const created = await collection(name).insert(body);
    if (name === 'vehicles' && body.primaryDriverId) {
      const driver = await collection('drivers').findOne({ _id: body.primaryDriverId });
      await collection('drivers').update(String(driver._id), { vehicleId: String(created._id) });
    }
    await collection('auditLogs').insert({ actor:req.session.user.username, action:'CREATE', resource:name, recordId:String(created._id), at:new Date().toISOString() });
    res.status(201).json(created);
  } catch (e) { next(e); }
});
router.post('/inquiries/:id/accept', async (req, res, next) => {
  try {
    const inquiries = collection('inquiries');
    const inquiry = await inquiries.findOne({ _id: req.params.id });
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found' });
    if (['CONVERTED', 'REJECTED'].includes(inquiry.status)) {
      return res.status(409).json({ error: 'This inquiry has already been accepted or rejected.' });
    }

    const updates = req.body || {};
    const pickupDate = String(updates.pickupDate || inquiry.pickupDate || '');
    const returnDate = String(updates.returnDate || inquiry.returnDate || pickupDate);
    const bufferDate = String(Object.hasOwn(updates, 'bufferDate') ? updates.bufferDate || '' : inquiry.bufferDate || '');
    const endDate = bufferDate || returnDate;
    const passengers = Number(updates.passengers ?? inquiry.passengers ?? 1);
    const customerName = String(updates.customerName ?? inquiry.customerName ?? '').trim().slice(0, 120);
    const customerPhone = String(updates.customerPhone ?? inquiry.phone ?? '').replace(/\D/g, '');
    const customerEmail = String(updates.customerEmail ?? inquiry.email ?? '').trim().slice(0, 160);
    const pickup = String(updates.pickup ?? inquiry.pickup ?? '').trim().slice(0, 300);
    const destination = String(updates.destination ?? inquiry.destination ?? '').trim().slice(0, 300);
    const tripType = String(updates.tripType ?? inquiry.tripType ?? 'ONE_WAY');
    if (!validTripDates(pickupDate, returnDate)) return res.status(400).json({ error: 'Enter valid trip dates before accepting this inquiry.' });
    if (bufferDate && (!validDate(bufferDate) || bufferDate < returnDate)) return res.status(400).json({ error: 'Buffer date must be on or after the return date.' });
    if (!Number.isInteger(passengers) || passengers < 1 || passengers > 20) return res.status(400).json({ error: 'Passenger count must be between 1 and 20.' });
    if (!customerName || !/^\d{10}$/.test(customerPhone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) || !pickup || !destination) {
      return res.status(400).json({ error: 'Enter a customer name, valid 10-digit phone number, valid email address, pickup and destination.' });
    }
    if (!['ONE_WAY', 'ROUND_TRIP', 'LOCAL'].includes(tripType)) return res.status(400).json({ error: 'Choose a valid trip type.' });
    const available = await getAvailableFleet(pickupDate, endDate, passengers);
    const requestedVehicleId = String(updates.vehicleId && updates.vehicleId !== 'OUTSIDE' ? updates.vehicleId : '');
    if (requestedVehicleId && !available.some(vehicle => String(vehicle._id) === requestedVehicleId)) {
      return res.status(409).json({ error: 'The selected vehicle is no longer available for these trip dates.' });
    }
    const selectedVehicle = available.find(vehicle => String(vehicle._id) === requestedVehicleId);
    const externalVehicleName = selectedVehicle ? '' : String(updates.externalVehicleName || '').trim().slice(0, 100);
    const externalVehicleNumber = selectedVehicle ? '' : String(updates.externalVehicleNumber || '').trim().slice(0, 30);
    const externalDriverName = selectedVehicle ? '' : String(updates.externalDriverName || '').trim().slice(0, 120);
    const externalDriverPhone = selectedVehicle ? '' : String(updates.externalDriverPhone || '').replace(/\D/g, '');
    if (!selectedVehicle && (!externalVehicleName || !externalVehicleNumber || !externalDriverName || !/^\d{10}$/.test(externalDriverPhone))) {
      return res.status(400).json({ error: 'For an outside vehicle, enter the car name, vehicle number, driver name and valid 10-digit driver phone.' });
    }
    const originalInquiry = { ...inquiry, _id: String(inquiry._id) };
    const acceptedDetails = {
      inquiryId: String(inquiry._id),
      customerName,
      customerPhone,
      customerEmail,
      tripType,
      pickup,
      destination,
      pickupDate,
      returnDate,
      bufferDate,
      pickupTime: String(updates.pickupTime ?? inquiry.pickupTime ?? ''),
      passengers,
      quotedFare: Number(updates.quotedFare ?? inquiry.quotedFare ?? 0),
      estimatedKm: Number(inquiry.estimatedKm || 0),
      notes: String(updates.notes ?? inquiry.notes ?? ''),
      vehicleId: selectedVehicle ? String(selectedVehicle._id) : '',
      vehicleSource: selectedVehicle ? 'FLEET' : 'EXTERNAL',
      vehicleLabel: selectedVehicle ? selectedVehicle.registrationNumber : `${externalVehicleName} · ${externalVehicleNumber}`,
      vehicleName: selectedVehicle ? String(selectedVehicle.vehicleName || selectedVehicle.model || selectedVehicle.manufacturer || '').trim() : externalVehicleName,
      vehicleNumber: selectedVehicle ? String(selectedVehicle.registrationNumber || '') : externalVehicleNumber,
      driverName: selectedVehicle ? String(selectedVehicle.driver?.name || '') : externalDriverName,
      driverPhone: selectedVehicle ? String(selectedVehicle.driver?.phone || '') : externalDriverPhone,
      externalVehicleName,
      externalVehicleNumber,
      externalDriverName,
      externalDriverPhone,
      driverId: selectedVehicle ? String(selectedVehicle.primaryDriverId || '') : '',
      status: 'CONFIRMED'
    };
    const updateValues = {
      customerName, customerPhone, email: customerEmail, tripType, pickup, destination,
      pickupDate, returnDate, bufferDate, pickupTime: acceptedDetails.pickupTime,
      passengers, quotedFare: acceptedDetails.quotedFare, notes: acceptedDetails.notes,
      vehicleId: acceptedDetails.vehicleId,
      vehicleSource: acceptedDetails.vehicleSource, vehicleLabel: acceptedDetails.vehicleLabel,
      externalVehicleName, externalVehicleNumber, externalDriverName, externalDriverPhone
    };
    const originalValues = { ...inquiry, customerPhone: inquiry.phone || '' };
    const chiragUpdates = Object.fromEntries(Object.entries(updateValues)
      .filter(([key, value]) => String(value ?? '') !== String(originalValues[key] ?? '')));
    const booking = await collection('bookings').insert({
      ...acceptedDetails,
      originalInquiry,
      acceptedDetails: { ...acceptedDetails },
      chiragUpdates,
      bookingReference: `CAB-${new Date().getFullYear()}-${Date.now().toString().slice(-6)}`
    });
    const customers = collection('customers');
    const existingCustomer = await customers.findOne({ phone: customerPhone });
    const customer = existingCustomer
      ? await customers.update(String(existingCustomer._id), {
        name: customerName,
        email: customerEmail,
        lastInquiryId: String(inquiry._id),
        inquiryIds: [...new Set([...(existingCustomer.inquiryIds || []), String(inquiry._id)])]
      })
      : await customers.insert({
        name: customerName,
        phone: customerPhone,
        email: customerEmail,
        source: 'INQUIRY',
        firstInquiryId: String(inquiry._id),
        lastInquiryId: String(inquiry._id),
        inquiryIds: [String(inquiry._id)]
      });
    const linkedBooking = await collection('bookings').update(String(booking._id), {
      customerId: String(customer._id)
    });
    await inquiries.update(String(inquiry._id), {
      status: 'CONVERTED',
      bookingId: String(booking._id),
      customerId: String(customer._id),
      originalData: inquiry.originalData || originalInquiry,
      chiragUpdates,
      convertedAt: new Date().toISOString()
    });
    await collection('auditLogs').insert({
      actor: req.session.user.username,
      action: 'ACCEPT',
      resource: 'inquiries',
      recordId: String(inquiry._id),
      at: new Date().toISOString()
    });
    let emailSent = false;
    try {
      await sendConfirmationEmail({ ...linkedBooking, customerEmail });
      emailSent = true;
    } catch (error) {
      console.error(`Booking confirmation email delivery failed for ${booking.bookingReference}:`, error);
    }
    res.status(201).json({
      booking: linkedBooking,
      customer,
      emailSent,
      emailWarning: emailSent ? '' : 'The booking was created, but the confirmation email could not be sent.'
    });
  } catch (e) { next(e); }
});
router.post('/inquiries/:id/reject', async (req, res, next) => {
  try {
    const inquiries = collection('inquiries');
    const inquiry = await inquiries.findOne({ _id: req.params.id });
    if (!inquiry) return res.status(404).json({ error: 'Inquiry not found.' });
    if (['CONVERTED', 'REJECTED'].includes(inquiry.status)) {
      return res.status(409).json({ error: 'This inquiry has already been accepted or rejected.' });
    }
    const rejectionNote = String(req.body?.rejectionNote || '').trim().slice(0, 2000);
    if (rejectionNote.length < 5) return res.status(400).json({ error: 'Enter a rejection note of at least 5 characters.' });
    const rejectedAt = new Date().toISOString();
    const updated = await inquiries.update(String(inquiry._id), {
      status: 'REJECTED',
      rejectionNote,
      rejectedAt,
      rejectedBy: req.session.user.username
    });
    await collection('auditLogs').insert({
      actor: req.session.user.username,
      action: 'REJECT',
      resource: 'inquiries',
      recordId: String(inquiry._id),
      at: rejectedAt
    });
    let emailSent = false;
    try {
      await sendRejectionEmail({ ...updated, rejectionNote });
      emailSent = true;
    } catch (error) {
      console.error(`Inquiry rejection email delivery failed for ${inquiry.inquiryReference}:`, error);
    }
    res.json({
      inquiry: updated,
      emailSent,
      emailWarning: emailSent ? '' : 'The inquiry was rejected, but the customer email could not be sent.'
    });
  } catch (error) { next(error); }
});
router.post('/bookings/:id/reject', async (req, res, next) => {
  try {
    const bookings = collection('bookings');
    const booking = await bookings.findOne({ _id: req.params.id });
    if (!booking) return res.status(404).json({ error: 'Booking not found.' });
    if (!['TENTATIVE', 'CONFIRMED', 'UPCOMING'].includes(String(booking.status || '').toUpperCase())) {
      return res.status(409).json({ error: 'Only tentative or upcoming bookings can be rejected.' });
    }
    const rejectionNote = String(req.body?.rejectionNote || '').trim().slice(0, 2000);
    if (rejectionNote.length < 5) return res.status(400).json({ error: 'Enter a rejection reason of at least 5 characters.' });
    const customerEmail = String(req.body?.customerEmail || booking.customerEmail || '').trim().slice(0, 160);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail)) return res.status(400).json({ error: 'Enter a valid customer email address to send the rejection notice.' });
    const rejectedAt = new Date().toISOString();
    const updated = await bookings.update(String(booking._id), {
      status: 'REJECTED',
      rejectionNote,
      customerEmail,
      rejectedAt,
      rejectedBy: req.session.user.username
    });
    await collection('auditLogs').insert({
      actor: req.session.user.username,
      action: 'REJECT',
      resource: 'bookings',
      recordId: String(booking._id),
      at: rejectedAt
    });
    let emailSent = false;
    try {
      await sendBookingRejectionEmail({ ...updated, customerEmail, rejectionNote });
      emailSent = true;
    } catch (error) {
      console.error(`Booking rejection email delivery failed for ${booking.bookingReference}:`, error);
    }
    res.json({
      booking: updated,
      emailSent,
      emailWarning: emailSent ? '' : 'The booking was rejected, but the customer email could not be sent.'
    });
  } catch (error) { next(error); }
});
router.patch('/:resource/:id', async (req, res, next) => {
  try {
    const name = req.params.resource;
    if (!allowed.has(name)) return res.status(404).json({ error: 'Resource not found' });
    if (name === 'settings') return res.status(405).json({ error: 'Use the settings page to manage business and email configuration.' });
    const body = { ...req.body };
    delete body._id;
    delete body.passwordHash;
    if (name === 'vehicles') {
      const current = await collection('vehicles').findOne({ _id: req.params.id });
      if (!current) return res.status(404).json({ error: 'Record not found' });
      const vehicleName = String(body.vehicleName ?? current.vehicleName ?? '').trim();
      const imageUrl = String(body.imageUrl ?? current.imageUrl ?? '').trim().slice(0, 2000);
      const perKilometerRate = Number(body.perKilometerRate ?? current.perKilometerRate);
      const driverDailyCost = Number(body.driverDailyCost ?? current.driverDailyCost);
      if (!vehicleName) return res.status(400).json({ error: 'Car name or model is required for customer price estimates.' });
      if (!validImageUrl(imageUrl)) return res.status(400).json({ error: 'Vehicle image must be an HTTP or HTTPS URL.' });
      if (!Number.isFinite(perKilometerRate) || perKilometerRate <= 0) return res.status(400).json({ error: 'Price per km must be greater than zero.' });
      if (!Number.isFinite(driverDailyCost) || driverDailyCost < 0) return res.status(400).json({ error: 'Driver cost per day must be zero or more.' });
      body.vehicleName = vehicleName;
      body.imageUrl = imageUrl;
      body.perKilometerRate = perKilometerRate;
      body.driverDailyCost = driverDailyCost;
    }
    if (name === 'vehicles' && Object.hasOwn(body, 'primaryDriverId')) {
      const vehicles = collection('vehicles');
      const drivers = collection('drivers');
      const vehicle = await vehicles.findOne({ _id: req.params.id });
      if (!vehicle) return res.status(404).json({ error: 'Record not found' });
      const oldDriverId = String(vehicle.primaryDriverId || '');
      const newDriverId = String(body.primaryDriverId || '');
      if (newDriverId) {
        const newDriver = await drivers.findOne({ _id: newDriverId });
        if (!newDriver) return res.status(400).json({ error: 'Selected driver was not found.' });
        const previousVehicleId = String(newDriver.vehicleId || '');
        if (previousVehicleId && previousVehicleId !== req.params.id) {
          const previousVehicle = await vehicles.findOne({ _id: previousVehicleId });
          if (previousVehicle && String(previousVehicle.primaryDriverId || '') === newDriverId) {
            await vehicles.update(previousVehicleId, { primaryDriverId: '' });
          }
        }
        await drivers.update(newDriverId, { vehicleId: req.params.id });
      }
      if (oldDriverId && oldDriverId !== newDriverId) {
        const oldDriver = await drivers.findOne({ _id: oldDriverId });
        if (oldDriver && String(oldDriver.vehicleId || '') === req.params.id) {
          await drivers.update(oldDriverId, { vehicleId: '' });
        }
      }
    }
    const updated = await collection(name).update(req.params.id, body);
    if (!updated) return res.status(404).json({ error: 'Record not found' });
    await collection('auditLogs').insert({ actor:req.session.user.username, action:'UPDATE', resource:name, recordId:req.params.id, at:new Date().toISOString() });
    res.json(updated);
  } catch(e) { next(e); }
});
router.delete('/:resource/:id', requireRole('admin','owner'), async (req, res, next) => {
  try {
    const name = req.params.resource;
    if (!allowed.has(name)) return res.status(404).json({ error: 'Resource not found' });
    if (name === 'settings') return res.status(405).json({ error: 'Business and email settings cannot be deleted here.' });
    if (name === 'vehicles') {
      const activeBookings = (await collection('bookings').find({ vehicleId: req.params.id }))
        .filter(booking => !['CANCELLED', 'REJECTED', 'LOST'].includes(booking.status));
      if (activeBookings.length) return res.status(409).json({ error: 'This vehicle is linked to active bookings. Cancel or reassign those trips before deleting it.' });
      const drivers = await collection('drivers').find({ vehicleId: req.params.id });
      for (const driver of drivers) await collection('drivers').update(String(driver._id), { vehicleId: '' });
    }
    if (name === 'drivers') {
      const vehicles = await collection('vehicles').find({ primaryDriverId: req.params.id });
      for (const vehicle of vehicles) await collection('vehicles').update(String(vehicle._id), { primaryDriverId: '' });
    }
    const ok = await collection(name).remove(req.params.id);
    if (ok) await collection('auditLogs').insert({
      actor: req.session.user.username,
      action: 'DELETE',
      resource: name,
      recordId: req.params.id,
      at: new Date().toISOString()
    });
    res.json({ deleted:ok });
  } catch(e) { next(e); }
});
export default router;
