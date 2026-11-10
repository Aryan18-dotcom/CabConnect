'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';

const navItems = [
  ['dashboard', 'Dashboard', '▦'], ['vehicles', 'Vehicles', '▰'], ['drivers', 'Drivers', '♙'],
  ['bookings', 'Bookings', '▤'], ['payments', 'Payments', '₹'], ['expenses', 'Expenses', '↗'],
  ['inquiries', 'Inquiries', '✉'], ['settings', 'Settings', '⚙']
];

const config = {
  vehicles: { title: 'Vehicles', sub: 'Manage your fleet, rates and driver assignments', columns: ['vehicleName', 'registrationNumber', 'fuelType', 'minPassengers', 'maxPassengers', 'perKilometerRate', 'driverDailyCost', 'operationalStatus', 'primaryDriverId'], fields: [['vehicleName', 'Car name / model', 'text', true], ['registrationNumber', 'Vehicle number', 'text', true], ['imageUrl', 'Vehicle image URL', 'url'], ['fuelType', 'Fuel type', 'select', ['CNG', 'DIESEL', 'PETROL', 'ELECTRIC']], ['minPassengers', 'Minimum passengers', 'number', true], ['maxPassengers', 'Maximum passengers', 'number', true], ['luggageStorageType', 'Luggage storage', 'select', ['BOOT', 'ROOF_RACK', 'CARRIER', 'NONE']], ['perKilometerRate', 'Price per km (₹)', 'number', true], ['driverDailyCost', 'Driver cost per day (₹)', 'number', true], ['operationalStatus', 'Fleet status', 'select', ['ACTIVE', 'INACTIVE', 'MAINTENANCE']], ['primaryDriverId', 'Assigned driver', 'drivers']] },
  drivers: { title: 'Drivers', sub: 'Manage driver contact and age details', columns: ['name', 'phone', 'age'], fields: [['name', 'Name', 'text', true], ['phone', 'Phone number', 'tel', true], ['age', 'Age', 'number', true]] },
  bookings: { title: 'Bookings', sub: 'Create and manage customer trips', columns: ['bookingReference', 'customerName', 'pickup', 'destination', 'pickupDate', 'bufferDate', 'status'], fields: [['customerName', 'Customer name', 'text', true], ['customerEmail', 'Customer email', 'email', true], ['customerPhone', 'Phone number', 'tel', true], ['tripType', 'Trip type', 'select', ['ONE_WAY', 'ROUND_TRIP', 'LOCAL']], ['pickup', 'Pickup location', 'text', true], ['destination', 'Destination', 'text', true], ['pickupDate', 'Starting date', 'date', true], ['returnDate', 'Return date', 'date'], ['bufferDate', 'Buffer date', 'date'], ['pickupTime', 'Pickup time', 'time'], ['passengers', 'Passengers', 'number', true], ['vehicleId', 'Vehicle', 'vehicles', true], ['quotedFare', 'Trip fare (₹)', 'number'], ['status', 'Status', 'select', ['TENTATIVE', 'CONFIRMED', 'UPCOMING', 'ONGOING', 'COMPLETED', 'CANCELLED']], ['notes', 'Notes', 'textarea']] },
  payments: { title: 'Payments', sub: 'Record settled money against a trip', columns: ['bookingId', 'amount', 'method', 'type', 'paidAt'], fields: [['bookingId', 'Trip', 'bookings', true], ['amount', 'Settled amount (₹)', 'number', true], ['method', 'Payment mode', 'select', ['CASH', 'UPI', 'BANK_TRANSFER', 'CARD', 'OTHER']], ['type', 'Payment type', 'select', ['ADVANCE', 'BALANCE', 'FULL', 'REFUND']], ['paidAt', 'Payment date', 'date', true], ['reference', 'Transaction reference', 'text'], ['notes', 'Notes', 'textarea']] },
  expenses: { title: 'Expenses', sub: 'Record costs against a vehicle', columns: ['vehicleId', 'category', 'amount', 'date', 'description'], fields: [['vehicleId', 'Vehicle', 'vehicles', true], ['category', 'Expense type', 'select', ['FUEL', 'TOLL', 'PARKING', 'MAINTENANCE', 'DRIVER_ALLOWANCE', 'OTHER']], ['amount', 'Amount (₹)', 'number', true], ['date', 'Expense date', 'date', true], ['description', 'Description', 'text', true]] },
  inquiries: { title: 'Inquiries', sub: 'Review requests and accept them as bookings', columns: ['customerName', 'phone', 'pickup', 'destination', 'pickupDate', 'returnDate', 'bufferDate', 'status'], fields: [] }
};

const api = async (url, options = {}) => {
  const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (response.status === 401) {
    window.location.href = '/login';
    throw new Error('Session expired');
  }
  if (!response.ok) throw new Error(data.error || 'Request failed');
  return data;
};
const text = value => String(value ?? '');
const money = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const displayName = resource => ({ bookings: 'booking', vehicles: 'vehicle', drivers: 'driver', payments: 'payment', expenses: 'expense' })[resource] || resource;
const columnLabel = key => key.replace(/[A-Z]/g, match => ` ${match}`).replace(/^./, match => match.toUpperCase());
const formatDate = date => date.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

function Calendar({ events, onPreview }) {
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const eventMap = useMemo(() => {
    const map = new Map();
    events.filter(event => event.extendedProps?.kind === 'booking').forEach(event => {
      const key = text(event.start).slice(0, 10);
      if (!key) return;
      map.set(key, [...(map.get(key) || []), event]);
    });
    return map;
  }, [events]);
  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (firstDay.getDay() + 6) % 7;
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const total = Math.ceil((offset + count) / 7) * 7;

  return (
    <section className="panel booking-calendar">
      <div className="panel-head"><div><h3>Booking calendar</h3><p>All scheduled trips by pickup date</p></div>
        <div className="calendar-controls"><button className="icon-btn" aria-label="Previous month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>‹</button><strong>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</strong><button className="icon-btn" aria-label="Next month" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>›</button></div>
      </div>
      <div className="calendar-grid calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <div key={day}>{day}</div>)}</div>
      <div className="calendar-grid">{Array.from({ length: total }, (_, index) => {
        const day = index - offset + 1;
        if (day < 1 || day > count) return <div className="calendar-day outside" key={index} />;
        const key = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const items = eventMap.get(key) || [];
        return <div className="calendar-day" key={key}><span className="calendar-date">{day}</span>{items.slice(0, 3).map(event => <button type="button" className="calendar-event" key={event.id} title={`View booking: ${event.title}`} onClick={() => onPreview(event.id)}>{event.title}</button>)}{items.length > 3 && <span className="calendar-more">+{items.length - 3} more</span>}</div>;
      })}</div>
    </section>
  );
}

function Field({ field, value, onChange, options = [], requiredOverride }) {
  const [name, label, type, extra] = field;
  const required = requiredOverride ?? extra === true;
  if (type === 'select' || ['drivers', 'vehicles', 'bookings'].includes(type)) {
    const choices = type === 'select' ? extra.map(option => [option, option.replaceAll('_', ' ')]) : options;
    return <label className={name === 'notes' ? 'wide' : ''}>{label}<select name={name} value={value ?? ''} required={required} onChange={event => onChange(name, event.target.value)}><option value="">Select…</option>{choices.map(([optionValue, optionLabel]) => <option value={optionValue} key={optionValue}>{optionLabel}</option>)}</select></label>;
  }
  if (type === 'textarea') return <label className="wide">{label}<textarea name={name} value={value ?? ''} required={required} onChange={event => onChange(name, event.target.value)} /></label>;
  const numberMin = ['age', 'minPassengers', 'passengers', 'perKilometerRate'].includes(name) ? '1' : '0';
  return <label>{label}<input name={name} type={type} value={value ?? ''} required={required} min={type === 'number' ? numberMin : undefined} step={['perKilometerRate', 'driverDailyCost'].includes(name) ? '0.01' : type === 'number' ? '1' : undefined} onChange={event => onChange(name, event.target.value)} /></label>;
}

export default function AdminWorkspace() {
  const [user, setUser] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [records, setRecords] = useState([]);
  const [search, setSearch] = useState('');
  const [summary, setSummary] = useState(null);
  const [dashboardData, setDashboardData] = useState({ events: [], drivers: [], expenses: [] });
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [theme, setTheme] = useState('light');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [form, setForm] = useState({});
  const [settings, setSettings] = useState({});
  const [password, setPassword] = useState({});
  const [passwordVisible, setPasswordVisible] = useState({});
  const [todayLabel, setTodayLabel] = useState('');
  const [options, setOptions] = useState({ drivers: [], vehicles: [], bookings: [] });
  const [availability, setAvailability] = useState({ vehicles: [], note: '', loading: false });

  useEffect(() => {
    setTodayLabel(formatDate(new Date()));
  }, []);

  const notify = useCallback(message => {
    setToast(message);
    window.setTimeout(() => setToast(''), 3000);
  }, []);

  const loadPage = useCallback(async target => {
    target ||= 'dashboard';
    setError('');
    setSearch('');
    if (target === 'dashboard') {
        const [nextSummary, events, drivers, expenses] = await Promise.all([
        api('/api/summary'), api('/api/calendar/events'), api('/api/drivers'), api('/api/expenses')
      ]);
      setSummary(nextSummary);
      setDashboardData({ events, drivers, expenses });
      setRecords([]);
      return;
    }
    if (target === 'settings') {
      setSettings(await api('/api/settings'));
      setRecords([]);
      return;
    }
    const rows = await api(`/api/${target}`);
    const [drivers, vehicles, bookings] = await Promise.all([
      target === 'vehicles' ? api('/api/drivers') : Promise.resolve([]),
      target === 'expenses' || target === 'drivers' ? api('/api/vehicles') : Promise.resolve([]),
      target === 'payments' ? api('/api/bookings') : Promise.resolve([])
    ]);
    setOptions(current => ({ ...current, drivers, vehicles, bookings }));
    let enriched = rows;
    if (target === 'vehicles') enriched = rows.map(row => ({ ...row, driverName: drivers.find(driver => String(driver._id) === String(row.primaryDriverId))?.name || '' }));
    if (target === 'expenses') enriched = rows.map(row => ({ ...row, vehicleName: vehicles.find(vehicle => String(vehicle._id) === String(row.vehicleId))?.registrationNumber || '' }));
    if (target === 'payments') enriched = rows.map(row => ({ ...row, bookingReference: bookings.find(booking => String(booking._id) === String(row.bookingId))?.bookingReference || '' }));
    if (target === 'inquiries') enriched = [...rows].sort((a, b) => text(b.createdAt).localeCompare(text(a.createdAt)));
    setRecords(enriched);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const [me, savedTheme] = await Promise.all([
          api('/api/auth/me'),
          Promise.resolve(localStorage.getItem('cc-theme') || 'light')
        ]);
        if (!active) return;
        setUser(me.user);
        setTheme(savedTheme);
        document.documentElement.dataset.theme = savedTheme;
        const requested = window.location.hash.slice(1);
        const initial = navItems.some(item => item[0] === requested) ? requested : 'dashboard';
        setPage(initial);
        if (me.user.mustChangePassword) setModal({ type: 'password', required: true });
        else await loadPage(initial);
      } catch {
        window.location.href = '/login';
      }
    })();
    return () => { active = false; };
  }, [loadPage]);

  useEffect(() => {
    const updatePage = () => {
      const next = window.location.hash.slice(1);
      if (user && navItems.some(item => item[0] === next)) {
        setPage(next);
        loadPage(next).catch(requestError => setError(requestError.message));
      }
    };
    window.addEventListener('hashchange', updatePage);
    return () => window.removeEventListener('hashchange', updatePage);
  }, [user, loadPage]);

  useEffect(() => {
    if (!modal || !['record', 'inquiry'].includes(modal.type)) return;
    const loadOptions = async () => {
      try {
        const [drivers, vehicles, bookings] = await Promise.all([
          modal.resource === 'vehicles' || modal.type === 'inquiry' ? api('/api/drivers') : Promise.resolve([]),
          ['vehicles', 'bookings', 'expenses'].includes(modal.resource) || modal.type === 'inquiry' ? api('/api/vehicles') : Promise.resolve([]),
          modal.resource === 'payments' ? api('/api/bookings') : Promise.resolve([])
        ]);
        setOptions(current => ({ ...current, drivers, vehicles, bookings }));
      } catch (requestError) { setError(requestError.message); }
    };
    loadOptions();
  }, [modal]);

  useEffect(() => {
    if (!modal || !['record', 'inquiry'].includes(modal.type) || !['bookings', 'inquiry'].includes(modal.resource || modal.type)) return;
    const start = form.pickupDate || '';
    const end = form.returnDate || start;
    const buffer = form.bufferDate || '';
    const passengers = form.passengers || 1;
    if (!start || !end || end < start || (buffer && buffer < end)) {
      setAvailability({ vehicles: [], note: buffer && buffer < end ? 'Buffer must be on/after return date.' : 'Enter valid travel dates to check vehicle availability.', loading: false });
      return;
    }
    let active = true;
    setAvailability(current => ({ ...current, loading: true, note: 'Checking vehicle availability…' }));
    const timer = setTimeout(async () => {
      try {
        const result = await api(`/api/vehicles/availability?start=${encodeURIComponent(start)}&end=${encodeURIComponent(buffer || end)}&passengers=${encodeURIComponent(passengers)}`);
        if (!active) return;
        setForm(current => ({
          ...current,
          vehicleId: current.vehicleId === 'OUTSIDE' || result.vehicles?.some(vehicle => String(vehicle._id) === String(current.vehicleId))
            ? current.vehicleId
            : result.vehicles?.[0]?._id || 'OUTSIDE'
        }));
        setAvailability({
          vehicles: result.vehicles || [],
          note: result.externalVehicleRecommended
            ? 'No personal fleet vehicle is free for these dates and passenger count. An outside vehicle will be used.'
            : 'Only fleet vehicles free for the full selected date range are listed. You can also use an outside vehicle.',
          loading: false
        });
      } catch (requestError) {
        if (active) setAvailability({ vehicles: [], note: requestError.message, loading: false });
      }
    }, 140);
    return () => { active = false; clearTimeout(timer); };
  }, [modal, form.pickupDate, form.returnDate, form.bufferDate, form.passengers]);

  const changePage = target => {
    if (target === page) loadPage(target).catch(requestError => setError(requestError.message));
    setPage(target);
    window.location.hash = target;
    setMobileMenu(false);
    setModal(null);
  };
  const openRecord = async (resource, record = null) => {
    setError('');
    setForm({ ...(record || {}) });
    setAvailability({ vehicles: [], note: '', loading: false });
    setModal({ type: 'record', resource, record });
  };
  const updateForm = (name, value) => setForm(current => ({ ...current, [name]: value }));
  const setThemeMode = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.dataset.theme = next;
    localStorage.setItem('cc-theme', next);
  };

  async function logout() {
    try { await api('/api/auth/logout', { method: 'POST' }); } finally { window.location.href = '/login'; }
  }

  async function saveRecord(event) {
    event.preventDefault();
    const resource = modal.resource;
    const payload = { ...form };
    for (const [name] of config[resource].fields) {
      if (['minPassengers', 'maxPassengers', 'passengers', 'age', 'quotedFare', 'perKilometerRate', 'driverDailyCost'].includes(name) && payload[name] !== '') payload[name] = Number(payload[name]);
    }
    if (resource === 'bookings' && payload.vehicleId === 'OUTSIDE') payload.vehicleId = '';
    if (resource === 'vehicles' && Number(payload.minPassengers) > Number(payload.maxPassengers)) {
      setError('Minimum passengers cannot exceed maximum passengers.');
      return;
    }
    if (resource === 'vehicles' && (!(payload.perKilometerRate > 0) || payload.driverDailyCost < 0)) {
      setError('Enter a per-kilometre rate greater than zero and a valid daily driver cost.');
      return;
    }
    setBusy(true);
    try {
      await api(`/api/${resource}${modal.record ? `/${encodeURIComponent(modal.record._id)}` : ''}`, {
        method: modal.record ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      setModal(null);
      notify(modal.record ? 'Changes saved' : 'Record saved');
      await loadPage(resource);
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function deleteRecord(resource, record) {
    if (!window.confirm(`Delete this ${displayName(resource)}? This cannot be undone.`)) return;
    try {
      await api(`/api/${resource}/${encodeURIComponent(record._id)}`, { method: 'DELETE' });
      notify(`${displayName(resource)} deleted.`);
      await loadPage(resource);
    } catch (requestError) { notify(requestError.message); }
  }

  async function openBookingPreview(id) {
    try {
      const booking = await api(`/api/bookings/${encodeURIComponent(id)}`);
      const [vehicles, drivers] = await Promise.all([api('/api/vehicles'), api('/api/drivers')]);
      setModal({ type: 'bookingPreview', booking, vehicle: vehicles.find(item => String(item._id) === String(booking.vehicleId)), driver: drivers.find(item => String(item._id) === String(booking.driverId || vehicles.find(v => String(v._id) === String(booking.vehicleId))?.primaryDriverId)) });
    } catch (requestError) { notify(requestError.message); }
  }

  async function rejectBooking(event) {
    event.preventDefault();
    const payload = { customerEmail: form.customerEmail, rejectionNote: form.rejectionNote };
    setBusy(true); setError('');
    try {
      const result = await api(`/api/bookings/${encodeURIComponent(modal.booking._id)}/reject`, { method: 'POST', body: JSON.stringify(payload) });
      setModal(null);
      notify(result.emailSent ? 'Booking rejected and customer emailed.' : `Booking rejected. ${result.emailWarning || 'Email could not be sent.'}`);
      await loadPage('bookings');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function rejectInquiry() {
    const note = text(form.rejectionNote).trim();
    if (note.length < 5) { setError('Enter a customer-friendly rejection note of at least 5 characters.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api(`/api/inquiries/${encodeURIComponent(modal.inquiry._id)}/reject`, { method: 'POST', body: JSON.stringify({ rejectionNote: note }) });
      setModal(null);
      notify(result.emailSent ? 'Inquiry rejected and customer emailed.' : `Inquiry rejected. ${result.emailWarning || 'Email could not be sent.'}`);
      await loadPage('inquiries');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function acceptInquiry(event) {
    event.preventDefault();
    const payload = { ...form, passengers: Number(form.passengers), quotedFare: Number(form.quotedFare || 0), customerPhone: text(form.customerPhone).replace(/\D/g, '') };
    if (!Number.isInteger(payload.passengers) || payload.passengers < 1 || payload.passengers > 20) {
      setError('Enter a passenger count between 1 and 20.');
      return;
    }
    if (!/^\d{10}$/.test(payload.customerPhone)) { setError('Enter a valid 10-digit customer phone number.'); return; }
    setBusy(true); setError('');
    try {
      const result = await api(`/api/inquiries/${encodeURIComponent(modal.inquiry._id)}/accept`, { method: 'POST', body: JSON.stringify(payload) });
      setModal(null);
      notify(result.emailSent ? 'Inquiry accepted and confirmation email sent' : `Inquiry accepted. ${result.emailWarning || 'Confirmation email could not be sent.'}`);
      await loadPage('inquiries');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function saveSettings(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      await api('/api/settings', { method: 'PUT', body: JSON.stringify(settings) });
      notify('Settings saved.');
      await loadPage('settings');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  async function changePassword(event) {
    event.preventDefault();
    if (password.newPassword !== password.confirmPassword) { setError('Passwords do not match.'); return; }
    setBusy(true); setError('');
    try {
      await api('/api/auth/change-password', { method: 'POST', body: JSON.stringify(password) });
      setModal(null); setUser(current => ({ ...current, mustChangePassword: false }));
      notify('Password updated');
      await loadPage('dashboard');
    } catch (requestError) { setError(requestError.message); }
    finally { setBusy(false); }
  }

  const selectedConfig = config[page];
  const filteredRecords = useMemo(() => records.filter(record => JSON.stringify(record).toLowerCase().includes(search.toLowerCase())), [records, search]);
  const visibleNav = navItems.filter(([id]) => id !== 'settings' || ['admin', 'owner'].includes(user?.role));

  function renderField(field) {
    const [name, , type] = field;
    let choices = [];
    if (type === 'drivers') {
      const currentId = String(modal.record?._id || '');
      choices = options.drivers
        .filter(driver => (driver.status !== 'INACTIVE' && driver.status !== 'ON_LEAVE' || String(driver._id) === String(form[name] || '')) && (!driver.vehicleId || String(driver.vehicleId) === currentId || Boolean(currentId)))
        .map(driver => [driver._id, `${driver.name}${driver.phone ? ` · ${driver.phone}` : ''}${driver.vehicleId && String(driver.vehicleId) !== currentId ? ' · assigned to another vehicle (move)' : ''}`]);
    } else if (type === 'vehicles' && modal.resource === 'bookings') {
      choices = [
        ...availability.vehicles.map(vehicle => [vehicle._id, `${vehicle.registrationNumber}${vehicle.driverName ? ` · Driver: ${vehicle.driverName}` : ''}`]),
        ['OUTSIDE', 'Outside vehicle']
      ];
    } else if (type === 'vehicles') choices = options.vehicles.map(vehicle => [vehicle._id, vehicle.registrationNumber || vehicle.vehicleName || 'Vehicle']);
    else if (type === 'bookings') choices = options.bookings.map(booking => [booking._id, `${booking.bookingReference || 'Booking'} · ${booking.customerName || 'Customer'} · ${booking.pickupDate || ''}`]);
    if (type === 'drivers') choices.unshift(['', 'No driver assigned']);
    if (type === 'bookings' || type === 'vehicles') choices.unshift(['', type === 'vehicles' ? 'Select travel dates first' : 'Select a trip']);
    const fallbackValue = name === 'status' ? modal.record?.status : undefined;
    return <Field key={name} field={field} value={form[name] ?? fallbackValue ?? ''} onChange={updateForm} options={choices} requiredOverride={type === 'vehicles' && modal.resource === 'bookings' ? true : undefined} />;
  }

  function renderDashboard() {
    if (!summary) return <div className="empty">Loading dashboard…</div>;
    const expenseTotal = dashboardData.expenses.reduce((total, item) => total + Number(item.amount || 0), 0);
    const stats = [
      ['Bookings', summary.bookings, 'All recorded trips'], ['Today’s trips', summary.todayBookings, 'Scheduled pickups'],
      ['Active trips', summary.activeTrips, 'Currently in progress'], ['Fleet available', `${summary.availableVehicles} / ${summary.vehicles}`, 'Available vehicles'],
      ['Drivers', dashboardData.drivers.length, 'In your driver list'], ['New inquiries', summary.newInquiries, 'Awaiting your response'],
      ['Payments received', `₹${money(summary.paymentsReceived)}`, 'Recorded receipts'], ['Expenses', `₹${money(expenseTotal)}`, 'Recorded expenses']
    ];
    return <>
      <div className="page-head"><div><div className="eyebrow">CHIRAG TRAVELS · OPERATIONS</div><h1>Welcome, {user?.displayName}</h1><p>Your fleet, trips and business activity in one place.</p></div><div className="quick-actions"><button className="btn btn-primary" onClick={() => openRecord('bookings')}>＋ New booking</button><button className="btn btn-soft" onClick={() => openRecord('vehicles')}>＋ Add vehicle</button></div></div>
      <div className="grid stats-grid">{stats.map(([title, value, sub]) => <article className="stat-card" key={title}><div className="stat-top"><span>{title}</span></div><div className="stat-value">{value}</div><div className="stat-foot">{sub}</div></article>)}</div>
      <Calendar events={dashboardData.events} onPreview={openBookingPreview} />
    </>;
  }

  function renderTableValue(key, value, row) {
    if (page === 'vehicles' && key === 'vehicleName')     return <div className="vehicle-cell"><span className="vehicle-thumb">{row.imageUrl && <img src={row.imageUrl} alt={`${value || 'Vehicle'} photo`} loading="lazy" onLoad={event => { event.currentTarget.nextElementSibling.hidden = true; }} onError={event => { event.currentTarget.hidden = true; }} />}<span className="vehicle-thumb-fallback">🚘</span></span><strong>{value || '—'}</strong></div>;
    if (key === 'primaryDriverId') return row.driverName || row.primaryDriverName || '—';
    if (key === 'vehicleId') return row.vehicleName || row.registrationNumber || options.vehicles.find(vehicle => String(vehicle._id) === String(value))?.registrationNumber || '—';
    if (key === 'bookingId') return row.bookingReference || row.customerName || value || '—';
    if (key === 'status') {
      const status = text(value || 'NEW');
      const style = ['CONFIRMED', 'COMPLETED', 'ACTIVE', 'CONVERTED'].includes(status) ? 'status-green' : ['CANCELLED', 'LOST', 'REJECTED'].includes(status) ? 'status-red' : 'status-orange';
      return <span className={`status ${style}`}>{status}</span>;
    }
    return value || '—';
  }

  function renderList() {
    if (!selectedConfig) return null;
    const allowCreate = page !== 'inquiries';
    return <>
      <div className="page-head"><div><div className="eyebrow">CHIRAG TRAVELS · OPERATIONS</div><h1>{selectedConfig.title}</h1><p>{selectedConfig.sub}</p></div>{allowCreate && <button className="btn btn-primary" onClick={() => openRecord(page)}>＋ Add {displayName(page)}</button>}</div>
      <section className="panel"><div className="toolbar"><input aria-label={`Search ${selectedConfig.title}`} placeholder={`Search ${selectedConfig.title.toLowerCase()}…`} value={search} onChange={event => setSearch(event.target.value)} /><span className="muted" style={{ alignSelf: 'center' }}>{filteredRecords.length} records</span></div>
        {!filteredRecords.length ? <div className="empty"><strong>No records yet</strong>{allowCreate ? 'Add a record to see it here.' : 'There are no inquiries matching this search.'}</div> :
          <div className="table-wrap"><table><thead><tr>{selectedConfig.columns.map(key => <th key={key}>{columnLabel(key)}</th>)}<th>Action</th></tr></thead><tbody>
            {filteredRecords.map(row => <tr key={row._id}>{selectedConfig.columns.map(key => <td key={key}>{renderTableValue(key, row[key], row)}</td>)}<td>
              {page === 'vehicles' && <><button className="btn btn-soft btn-small" onClick={() => openRecord(page, row)}>Edit</button> <button className="btn btn-soft btn-small" onClick={() => deleteRecord(page, row)}>Delete</button></>}
              {page === 'drivers' && <><button className="btn btn-soft btn-small" onClick={() => openRecord(page, row)}>Edit</button> <button className="btn btn-soft btn-small" onClick={() => deleteRecord(page, row)}>Delete</button></>}
              {page === 'inquiries' && (row.status === 'CONVERTED' ? <span className="status status-green">Accepted</span> : row.status === 'REJECTED' ? <span className="status status-red">Rejected</span> : <button className="btn btn-primary btn-small" onClick={() => {
                setForm({ ...row, customerPhone: row.phone, customerEmail: row.email, returnDate: row.returnDate || row.pickupDate });
                setAvailability({ vehicles: [], note: '', loading: false });
                setModal({ type: 'inquiry', resource: 'inquiry', inquiry: row });
              }}>Review inquiry</button>)}
              {page === 'bookings' && (['TENTATIVE', 'CONFIRMED', 'UPCOMING'].includes(text(row.status).toUpperCase())
                ? <><button className="btn btn-soft btn-small" onClick={() => openBookingPreview(row._id)}>View</button> <button className="btn btn-soft btn-small" onClick={() => { setForm({ customerEmail: row.customerEmail || '', rejectionNote: '' }); setModal({ type: 'rejectBooking', booking: row }); }}>Reject</button></>
                : <button className="btn btn-soft btn-small" onClick={() => openBookingPreview(row._id)}>View</button>)}
            </td></tr>)}
          </tbody></table></div>}
      </section>
    </>;
  }

  function renderSettings() {
    return <>
      <div className="page-head"><div><div className="eyebrow">CHIRAG TRAVELS · OPERATIONS</div><h1>Settings</h1><p>Manage customer-facing business contact details and email delivery.</p></div></div>
      <section className="panel"><div className="panel-head"><div><h3>Business details</h3><p>Gmail transport defaults are applied automatically.</p></div></div>
        <form className="form-grid" onSubmit={saveSettings}>
          <label>Business name<input maxLength="120" required value={settings.businessName || ''} onChange={event => setSettings(current => ({ ...current, businessName: event.target.value }))} /></label>
          <label>Business phone<input type="tel" maxLength="40" value={settings.phone || ''} onChange={event => setSettings(current => ({ ...current, phone: event.target.value }))} /></label>
          <label>Business email<input type="email" maxLength="160" value={settings.businessEmail || ''} onChange={event => setSettings(current => ({ ...current, businessEmail: event.target.value }))} /></label>
          <label>Business timezone<input list="timezoneOptions" maxLength="80" required value={settings.timezone || ''} onChange={event => setSettings(current => ({ ...current, timezone: event.target.value }))} /><datalist id="timezoneOptions"><option value="Asia/Kolkata" /><option value="UTC" /><option value="Asia/Dubai" /><option value="Europe/London" /><option value="America/New_York" /></datalist></label>
          <div className="preview-divider wide"><span>EMAIL DELIVERY · GMAIL SMTP</span></div>
          <label>SMTP user<input type="email" maxLength="160" autoComplete="off" value={settings.smtpUser || ''} onChange={event => setSettings(current => ({ ...current, smtpUser: event.target.value }))} /></label>
          <label>SMTP from<input type="email" maxLength="160" autoComplete="off" placeholder="Defaults to SMTP user" value={settings.smtpFrom || ''} onChange={event => setSettings(current => ({ ...current, smtpFrom: event.target.value }))} /></label>
          <label className="wide">SMTP password / app password<div className="password-control"><input type={passwordVisible.smtpPassword ? 'text' : 'password'} maxLength="1000" autoComplete="new-password" placeholder={settings.hasSmtpPassword ? 'Saved securely — leave blank to keep current password' : 'Enter Gmail app password'} value={settings.smtpPassword || ''} onChange={event => setSettings(current => ({ ...current, smtpPassword: event.target.value }))} /><button className="password-toggle" type="button" aria-label={`${passwordVisible.smtpPassword ? 'Hide' : 'Show'} SMTP password`} aria-pressed={Boolean(passwordVisible.smtpPassword)} onClick={() => setPasswordVisible(current => ({ ...current, smtpPassword: !current.smtpPassword }))}>{passwordVisible.smtpPassword ? 'Hide' : 'Show'}</button></div></label>
          <p className="muted wide">SMTP password is encrypted in the database and never returned to the browser. Keep SESSION_SECRET stable to retain access to it.</p>
          {error && <p className="error wide" role="alert">{error}</p>}
          <div className="modal-actions wide"><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Save settings'}</button></div>
        </form>
      </section>
    </>;
  }

  function renderRecordModal() {
    const resource = modal.resource;
    const fields = config[resource].fields.filter(field => !(field[0] === 'status' && modal.record?.status === 'REJECTED')).map(field => {
      if (field[0] === 'status' && modal.record?.status && !field[3].includes(modal.record.status)) return [field[0], field[1], field[2], [...field[3], modal.record.status]];
      return field;
    });
    return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="record-title">
      <div className="modal-head"><div><div className="eyebrow">{modal.record ? 'EDIT RECORD' : 'NEW RECORD'}</div><h2 id="record-title">{modal.record ? 'Edit' : 'Add'} {displayName(resource)}</h2></div><button className="icon-btn" aria-label="Close" onClick={() => setModal(null)}>×</button></div>
      <form onSubmit={saveRecord}><div className="form-grid">{fields.map(renderField)}</div>
        {resource === 'bookings' && <p className="muted">{availability.note}</p>}
        {error && <p className="error" role="alert">{error}</p>}
        <div className="modal-actions"><button type="button" className="btn btn-soft" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : modal.record ? 'Save changes' : 'Save record'}</button></div>
      </form>
    </section></div>;
  }

  function renderInquiryModal() {
    const inquiry = modal.inquiry;
    const original = [
      ['Customer', inquiry.customerName], ['Phone', inquiry.phone], ['Email', inquiry.email], ['Pickup', inquiry.pickup],
      ['Destination', inquiry.destination], ['Requested start', inquiry.pickupDate], ['Requested return', inquiry.returnDate],
      ['Requested buffer', inquiry.bufferDate], ['Pickup time', inquiry.pickupTime], ['Passengers', inquiry.passengers],
      ['Estimated total km', inquiry.estimatedKm], ['Preferred vehicle', inquiry.vehiclePreference], ['Customer notes', inquiry.notes]
    ];
    const set = (key, value) => setForm(current => ({ ...current, [key]: value }));
    return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal preview-modal inquiry-modal" role="dialog" aria-modal="true" aria-labelledby="inquiry-title">
      <div className="modal-head"><div><div className="eyebrow">{inquiry.inquiryReference || 'CUSTOMER INQUIRY'}</div><h2 id="inquiry-title">Review inquiry</h2><p className="muted">Original customer details stay unchanged. Update the trip before accepting, or provide a note if rejecting.</p></div><button className="icon-btn" aria-label="Close" onClick={() => setModal(null)}>×</button></div>
      <div className="booking-preview-grid original-details">{original.map(([label, value]) => <div className="booking-detail" key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div>
      {Array.isArray(inquiry.estimatedPricing) && inquiry.estimatedPricing.length > 0 && <section className="inquiry-estimates"><div className="preview-divider"><span>CUSTOMER ESTIMATED PRICES</span></div>{inquiry.estimatedPricing.map((price, index) => <div className="booking-detail" key={`${price.vehicleName}-${index}`}><small>{price.vehicleName} · {price.estimatedKm} km × ₹{price.perKilometerRate}/km + {price.days} days × ₹{price.driverDailyCost}/day</small><strong>₹{money(price.estimatedTotal)}</strong></div>)}</section>}
      <div className="preview-divider"><span>CHIRAG’S CONFIRMED TRIP DETAILS</span></div>
      <form onSubmit={acceptInquiry}><div className="form-grid">
        <label>Customer name<input required value={form.customerName || ''} onChange={event => set('customerName', event.target.value)} /></label>
        <label>Customer phone<input type="tel" maxLength="10" required value={form.customerPhone || ''} onChange={event => set('customerPhone', event.target.value)} /></label>
        <label>Customer email<input type="email" required value={form.customerEmail || ''} onChange={event => set('customerEmail', event.target.value)} /></label>
        <label>Trip type<select value={form.tripType || 'ONE_WAY'} onChange={event => set('tripType', event.target.value)}>{['ONE_WAY', 'ROUND_TRIP', 'LOCAL'].map(value => <option key={value} value={value}>{value.replaceAll('_', ' ')}</option>)}</select></label>
        <label>Starting date<input type="date" required value={form.pickupDate || ''} onChange={event => set('pickupDate', event.target.value)} /></label>
        <label>Return date<input type="date" required value={form.returnDate || ''} onChange={event => set('returnDate', event.target.value)} /></label>
        <label>Buffer date (optional)<input type="date" value={form.bufferDate || ''} onChange={event => set('bufferDate', event.target.value)} /></label>
        <label>Passengers<input type="number" min="1" max="20" required value={form.passengers ?? ''} onChange={event => set('passengers', event.target.value)} /></label>
        <label>Confirmed fare (₹)<input type="number" min="0" value={form.quotedFare || ''} onChange={event => set('quotedFare', event.target.value)} /></label>
        <label className="wide">Vehicle for these dates<select required value={form.vehicleId || ''} onChange={event => set('vehicleId', event.target.value)}><option value="">{availability.loading ? 'Checking vehicle availability…' : 'Select a vehicle'}</option>{availability.vehicles.map(vehicle => <option value={vehicle._id} key={vehicle._id}>{vehicle.registrationNumber}{vehicle.driverName ? ` · Driver: ${vehicle.driverName}` : ''}</option>)}<option value="OUTSIDE">{availability.note.includes('No personal') ? 'Outside vehicle · no fleet vehicles are free' : 'Outside vehicle · use a partner vehicle'}</option></select><small className="muted">{availability.note}</small></label>
        {form.vehicleId === 'OUTSIDE' && <div className="form-grid wide"><label>Outside car name / model<input required maxLength="100" value={form.externalVehicleName || ''} onChange={event => set('externalVehicleName', event.target.value)} /></label><label>Outside vehicle number<input required maxLength="30" value={form.externalVehicleNumber || ''} onChange={event => set('externalVehicleNumber', event.target.value)} /></label><label>Outside driver name<input required maxLength="120" value={form.externalDriverName || ''} onChange={event => set('externalDriverName', event.target.value)} /></label><label>Outside driver phone<input required type="tel" inputMode="numeric" maxLength="10" value={form.externalDriverPhone || ''} onChange={event => set('externalDriverPhone', event.target.value)} /></label></div>}
        <label className="wide">Pickup time<input type="time" value={form.pickupTime || ''} onChange={event => set('pickupTime', event.target.value)} /></label>
        <label>Pickup location<input required value={form.pickup || ''} onChange={event => set('pickup', event.target.value)} /></label>
        <label>Destination<input required value={form.destination || ''} onChange={event => set('destination', event.target.value)} /></label>
        <label className="wide">Trip notes<textarea value={form.notes || ''} onChange={event => set('notes', event.target.value)} /></label>
        <label className="wide">Rejection note (required only if rejecting)<textarea maxLength="2000" rows="3" placeholder="Explain why this trip cannot be accepted, in a customer-friendly way." value={form.rejectionNote || ''} onChange={event => set('rejectionNote', event.target.value)} /></label>
      </div>
      {error && <p className="error" role="alert">{error}</p>}
      <div className="modal-actions"><button type="button" className="btn btn-soft" onClick={() => setModal(null)}>Cancel</button><button type="button" className="btn btn-soft" disabled={busy} onClick={rejectInquiry}>Reject inquiry</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Checking & accepting…' : 'Accept & create booking'}</button></div>
      </form>
    </section></div>;
  }

  function renderModal() {
    if (!modal) return null;
    if (modal.type === 'record') return renderRecordModal();
    if (modal.type === 'inquiry') return renderInquiryModal();
    if (modal.type === 'bookingPreview') {
      const { booking, vehicle, driver } = modal;
      const details = [['Customer', booking.customerName], ['Phone', booking.customerPhone], ['Trip type', booking.tripType], ['Pickup', booking.pickup], ['Destination', booking.destination], ['Start date', booking.pickupDate], ['Return date', booking.returnDate], ['Buffer date', booking.bufferDate], ['Pickup time', booking.pickupTime], ['Passengers', booking.passengers], ['Status', booking.status], ['Fare (₹)', booking.quotedFare], ['Vehicle', booking.vehicleLabel], ['Notes', booking.notes], ['Assigned vehicle', vehicle?.registrationNumber || booking.vehicleLabel || 'Outside vehicle'], ['Assigned driver', driver?.name || 'Not assigned']];
      return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal preview-modal" role="dialog" aria-modal="true"><div className="modal-head"><div><div className="eyebrow">{booking.bookingReference || 'BOOKING'}</div><h2>Booking preview</h2></div><button className="icon-btn" aria-label="Close" onClick={() => setModal(null)}>×</button></div><div className="booking-preview-grid">{details.map(([label, value]) => <div className="booking-detail" key={label}><small>{label}</small><strong>{value || '—'}</strong></div>)}</div>{booking.originalInquiry && <p className="muted preview-note">This booking was created from an inquiry. Original inquiry details are retained on the booking.</p>}</section></div>;
    }
    if (modal.type === 'rejectBooking') return <div className="modal-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) setModal(null); }}><section className="modal" role="dialog" aria-modal="true"><div className="modal-head"><div><div className="eyebrow">{modal.booking.bookingReference || 'BOOKING'}</div><h2>Reject booking</h2><p className="muted">The customer will receive the reason by email and can view it with the booking reference.</p></div><button className="icon-btn" aria-label="Close" onClick={() => setModal(null)}>×</button></div><form className="stack" onSubmit={rejectBooking}><label>Customer email<input type="email" required maxLength="160" value={form.customerEmail || ''} onChange={event => updateForm('customerEmail', event.target.value)} /></label><label>Reason for rejection<textarea required minLength="5" maxLength="2000" rows="4" placeholder="Explain why this booking cannot proceed." value={form.rejectionNote || ''} onChange={event => updateForm('rejectionNote', event.target.value)} /></label>{error && <p className="error" role="alert">{error}</p>}<div className="modal-actions"><button type="button" className="btn btn-soft" onClick={() => setModal(null)}>Cancel</button><button className="btn btn-primary" disabled={busy}>{busy ? 'Rejecting…' : 'Reject & email customer'}</button></div></form></section></div>;
    return <div className="modal-backdrop"><section className="modal" role="dialog" aria-modal="true"><div className="eyebrow">ACCOUNT SECURITY</div><h2>{modal.required ? 'Change your temporary password' : 'Change password'}</h2><p className="muted">Use at least 12 characters.</p><form className="stack" onSubmit={changePassword}>{[['currentPassword', 'Current password', 'current-password', 0], ['newPassword', 'New password', 'new-password', 12], ['confirmPassword', 'Confirm new password', 'new-password', 12]].map(([name, label, autocomplete, minLength]) => <label key={name}>{label}<div className="password-control"><input type={passwordVisible[name] ? 'text' : 'password'} name={name} autoComplete={autocomplete} minLength={minLength || undefined} required value={password[name] || ''} onChange={event => setPassword(current => ({ ...current, [name]: event.target.value }))} /><button className="password-toggle" type="button" aria-label={`${passwordVisible[name] ? 'Hide' : 'Show'} ${label.toLowerCase()}`} aria-pressed={Boolean(passwordVisible[name])} onClick={() => setPasswordVisible(current => ({ ...current, [name]: !current[name] }))}>{passwordVisible[name] ? 'Hide' : 'Show'}</button></div></label>)}{error && <p className="error">{error}</p>}<button className="btn btn-primary full" disabled={busy}>{busy ? 'Updating…' : 'Update password'}</button></form></section></div>;
  }

  const title = page === 'dashboard' ? 'Dashboard' : selectedConfig?.title || 'Settings';
  const subtitle = page === 'settings' ? 'Business contact and email delivery configuration' : 'Your business at a glance';
  return (
    <>
      <div className="app-shell">
        <aside className={`sidebar ${mobileMenu ? 'open' : ''}`} id="sidebar">
          <Link className="brand" href="/admin"><span className="brand-mark">C</span><span>CabConnect<small>OPERATIONS</small></span></Link>
          <div className="side-label">WORKSPACE</div>
          <nav className="nav-list" id="navigation">{visibleNav.map(([id, label, icon]) => <a href={`#${id}`} key={id} className={`nav-link ${page === id ? 'active' : ''}`} onClick={event => { event.preventDefault(); changePage(id); }}><span className="nav-icon">{icon}</span>{label}</a>)}</nav>
          <div className="side-bottom"><div className="profile-mini"><div className="avatar">{user?.displayName?.[0]?.toUpperCase() || 'C'}</div><div style={{ flex: 1, minWidth: 0 }}><strong>{user?.displayName || 'Loading…'}</strong><small>{user?.role === 'owner' ? 'Owner' : 'Administrator'}</small></div></div><button className="logout-button" onClick={logout}><span>↗</span> Log out</button></div>
        </aside>
        <main className="main"><header className="topbar"><div className="topbar-left"><button className="icon-btn mobile-menu" onClick={() => setMobileMenu(value => !value)}>☰</button><div><h2>{title}</h2><p>{subtitle}</p></div></div><div className="top-actions"><span className="muted user-label">{todayLabel}</span><button className="icon-btn theme-toggle" title="Toggle theme" onClick={setThemeMode}>{theme === 'dark' ? '☀' : '◐'}</button></div></header>
          <section className="content">{error && !modal && <div className="panel error" role="alert">{error}</div>}{page === 'dashboard' ? renderDashboard() : page === 'settings' ? renderSettings() : renderList()}</section>
        </main>
      </div>
      {renderModal()}
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}
