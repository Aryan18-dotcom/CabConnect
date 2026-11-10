'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LanguageSelect, useLanguage } from './use-language';

const initialForm = {
  customerName: '', phone: '', email: '', pickupDate: '', returnDate: '', bufferDate: '',
  pickupTime: '09:00', pickup: '', destination: '', tripType: 'ROUND_TRIP',
  passengers: 4, estimatedKm: '', notes: '', preferredVehicleIds: []
};

const money = value => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
const daysBetween = (start, end) => start && end
  ? Math.floor((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000) + 1
  : 0;

export default function BookingWizard() {
  const { language, t, changeLanguage } = useLanguage();
  const [form, setForm] = useState(initialForm);
  const [step, setStep] = useState(0);
  const [vehicles, setVehicles] = useState([]);
  const [loadingVehicles, setLoadingVehicles] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [consent, setConsent] = useState(false);
  const [distanceMessage, setDistanceMessage] = useState('Enter a route to estimate road distance. You can edit the estimate.');
  const [placeSuggestions, setPlaceSuggestions] = useState({ pickup: [], destination: [] });
  const [business, setBusiness] = useState({ businessName: 'Chirag Travels' });

  const update = (key, value) => setForm(current => ({ ...current, [key]: value }));

  useEffect(() => {
    let active = true;
    fetch('/api/public/business')
      .then(response => response.ok ? response.json() : null)
      .then(details => { if (active && details) setBusiness(details); })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    fetch('/api/public/vehicles')
      .then(async response => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || 'Vehicle options could not be loaded.');
        return result;
      })
      .then(result => { if (active) setVehicles(result); })
      .catch(fetchError => { if (active) setError(fetchError.message); })
      .finally(() => { if (active) setLoadingVehicles(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (form.pickup.trim().length < 3 || form.destination.trim().length < 3) return undefined;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      try {
        setDistanceMessage(t('Estimating driving distance…'));
        const geocode = async query => {
          const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(query)}&limit=1&lang=en`, { signal: controller.signal });
          if (!response.ok) throw new Error('Location lookup is unavailable.');
          const result = await response.json();
          const coordinates = result.features?.[0]?.geometry?.coordinates;
          if (!Array.isArray(coordinates) || coordinates.length < 2) throw new Error('Could not locate one of these places. Enter total kilometres manually.');
          return coordinates;
        };
        const [origin, destination] = await Promise.all([geocode(form.pickup), geocode(form.destination)]);
        const route = `${origin[0]},${origin[1]};${destination[0]},${destination[1]}`;
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${route}?overview=false`, { signal: controller.signal });
        if (!response.ok) throw new Error('Driving distance could not be estimated. Enter kilometres manually.');
        const result = await response.json();
        const km = result.routes?.[0]?.distance / 1000;
        if (!Number.isFinite(km) || km <= 0) throw new Error('No driving route was found. Enter kilometres manually.');
        const total = Math.max(1, Math.round(km * (form.tripType === 'ROUND_TRIP' ? 2 : 1)));
        setForm(current => ({ ...current, estimatedKm: String(total) }));
        setDistanceMessage(`Estimated ${total.toLocaleString('en-IN')} total km${form.tripType === 'ROUND_TRIP' ? ' (round trip)' : ''}. Edit if needed.`);
      } catch (routeError) {
        if (routeError.name !== 'AbortError') setDistanceMessage(t(routeError.message));
      }
    }, 650);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.pickup, form.destination, form.tripType]);

  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      const queries = ['pickup', 'destination'].filter(key => form[key].trim().length >= 3);
      try {
        const suggestions = await Promise.all(queries.map(async key => {
          const response = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(form[key])}&limit=5&lang=en`, { signal: controller.signal });
          if (!response.ok) throw new Error('Place suggestions are temporarily unavailable.');
          const data = await response.json();
          return [key, (data.features || []).map(feature => {
            const place = feature.properties || {};
            return [place.name, place.street, place.city, place.state, place.country].filter((part, index, list) => part && list.indexOf(part) === index).join(', ');
          }).filter(Boolean)];
        }));
        setPlaceSuggestions({ pickup: [], destination: [], ...Object.fromEntries(suggestions) });
      } catch (suggestionError) {
        if (suggestionError.name !== 'AbortError') setPlaceSuggestions({ pickup: [], destination: [] });
      }
    }, 350);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [form.pickup, form.destination]);

  const eligibleVehicles = useMemo(() => vehicles.filter(vehicle =>
    Number(vehicle.minPassengers || 1) <= Number(form.passengers) &&
    (!Number(vehicle.maxPassengers) || Number(vehicle.maxPassengers) >= Number(form.passengers))
  ), [vehicles, form.passengers]);

  const estimates = useMemo(() => {
    const end = form.bufferDate || form.returnDate;
    const days = daysBetween(form.pickupDate, end);
    const km = Number(form.estimatedKm || 0);
    return eligibleVehicles.filter(vehicle => form.preferredVehicleIds.includes(vehicle.id)).map(vehicle => {
      const distanceCost = km * vehicle.perKilometerRate;
      const driverCost = days * vehicle.driverDailyCost;
      return { ...vehicle, days, distanceCost, driverCost, total: distanceCost + driverCost };
    });
  }, [eligibleVehicles, form]);

  function validateCurrentStep() {
    if (step === 0) {
      if (!form.customerName.trim() || !/^\d{10}$/.test(form.phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
        setError(t('Enter your name, a valid 10-digit mobile number and email address.'));
        return false;
      }
    } else if (step === 1) {
      if (!form.pickupDate || !form.returnDate || form.returnDate < form.pickupDate ||
          (form.bufferDate && form.bufferDate < form.returnDate)) {
        setError(t('Enter valid travel dates. The buffer must be on or after your expected return.'));
        return false;
      }
    } else if (step === 2) {
      if (!Number.isInteger(Number(form.passengers)) || Number(form.passengers) < 1 || Number(form.passengers) > 20) {
        setError(t('Enter a passenger count between 1 and 20.'));
        return false;
      }
      if (!form.pickup.trim() || !form.destination.trim() || Number(form.estimatedKm) <= 0 || Number(form.estimatedKm) > 10000) {
        setError(t('Enter pickup, destination and an estimated trip distance between 1 and 10,000 km.'));
        return false;
      }
    } else if (step === 3 && (!form.preferredVehicleIds.length || form.preferredVehicleIds.length > 3)) {
      setError(t('Choose between one and three vehicles to compare.'));
      return false;
    } else if (step === 4 && !consent) {
      setError(t('Please confirm how we may use your phone number before submitting.'));
      return false;
    }
    setError('');
    return true;
  }

  function toggleVehicle(id) {
    setForm(current => {
      const selected = current.preferredVehicleIds.includes(id)
        ? current.preferredVehicleIds.filter(vehicleId => vehicleId !== id)
        : current.preferredVehicleIds.length < 3 ? [...current.preferredVehicleIds, id] : current.preferredVehicleIds;
      return { ...current, preferredVehicleIds: selected };
    });
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setDistanceMessage(t('Current location is not available in this browser.'));
      return;
    }
    setDistanceMessage(t('Finding your current location…'));
    navigator.geolocation.getCurrentPosition(async position => {
      try {
        const { latitude, longitude } = position.coords;
        const response = await fetch(`https://photon.komoot.io/reverse?lat=${latitude}&lon=${longitude}&lang=en`);
        if (!response.ok) throw new Error('Your location could not be converted to an address.');
        const result = await response.json();
        const place = result.features?.[0]?.properties || {};
        const address = [place.name, place.street, place.city, place.state, place.country].filter(Boolean).join(', ');
        if (!address) throw new Error('No address was found for your current location.');
        update('pickup', address);
      } catch (locationError) {
        setDistanceMessage(t(locationError.message));
      }
    }, () => setDistanceMessage(t('Location permission was denied or unavailable. Enter your pickup location instead.')), { timeout: 12000 });
  }

  async function submitInquiry(event) {
    event.preventDefault();
    if (!validateCurrentStep()) return;
    if (step < 4) {
      setStep(current => current + 1);
      return;
    }

    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/public/inquiries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, consent: true })
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'The inquiry could not be submitted.');
      try { localStorage.setItem('cabconnectInquiryReference', result.inquiryReference); } catch {}
      setNotice(`${t('Your inquiry was received.')} ${result.inquiryReference}. ${result.emailSent ? t('A confirmation email was sent.') : t('Email delivery is delayed; save this reference to check your status.')}`);
      setStep(5);
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setBusy(false);
    }
  }

  const fields = {
    customerName: [t('Full name'), 'text'],
    email: [t('Email address'), 'email']
  };
  const visibleStep = step === 5 ? 4 : step;

  return (
    <>
      <nav className="site-nav booking-nav">
        <Link className="logo" href="/"><span className="logo-mark">c<span>t</span></span><span>{business.businessName || 'Chirag Travels'}<small>{t('TRAVEL WITH COMFORT')}</small></span></Link>
        <Link className="help-link" href="/status">{t('Check inquiry status')} ↗</Link>
        <LanguageSelect language={language} onChange={changeLanguage} t={t} />
        {business.phone && <a className="help-link" href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}>{t('Need help?')} <b>{business.phone} ↗</b></a>}
      </nav>
      <main className="booking-shell">
        <div className="booking-heading">
          <div className="eyebrow"><i /> {t("LET'S GET YOU ON YOUR WAY")}</div>
          <h1>{t('Plan your')} <em>{t('journey.')}</em></h1>
          <p>{t('A few details are all we need to get things moving. Your booking is confirmed personally by our team.')}</p>
        </div>
        <div className="stepper" aria-label="Booking steps">
          {['Your details', 'Travel dates', 'Your route', 'Choose a ride', 'Review'].map((label, index) => <button type="button" className={`step ${index === step || step === 5 && index === 4 ? 'active' : ''} ${index < step ? 'done' : ''}`} key={label} onClick={() => { if (index < step && step !== 5) { setError(''); setStep(index); } }}><span>{String(index + 1).padStart(2, '0')}</span><b>{t(label)}</b></button>)}
        </div>
        <div className="booking-card">
          {step === 5 ? (
            <div className="success-screen" role="status">
              <div className="success-mark">✓</div>
              <div className="eyebrow">{t('INQUIRY RECEIVED')}</div>
              <h2>{t('Thank you,')} {form.customerName}</h2>
              <p>{notice}</p>
              <Link className="btn btn-primary" href="/status">{t('Check inquiry status')} ↗</Link>
            </div>
          ) : (
            <>
              <div className="panel-top"><span className="panel-number">STEP {String(step + 1).padStart(2, '0')} / 05</span><span className="panel-icon">{['♡', '◷', '⌖', '🚙', '✓'][step]}</span></div>
              <h2>{t(['Your details', 'Travel dates', 'Your route', 'Choose a ride', 'Review'][step])}</h2>
              <p className="panel-desc">{t(["Tell us who we'll be coordinating with.", 'Add your expected travel dates. A buffer gives you room if plans change.', 'Start typing a city, area or landmark and choose a suggested place.', "Choose up to three preferred vehicles. We'll confirm availability and the final option with you.", 'Review every required detail and compare estimates before sending your inquiry.'][step])}</p>
              <form noValidate onSubmit={submitInquiry}>
                {step === 0 && <div className="next-field-grid">
                  {Object.entries(fields).map(([name, [label, type]]) => <label key={name}><span>{label} *</span><input type={type} required value={form[name]} onChange={event => update(name, event.target.value)} autoComplete={name === 'customerName' ? 'name' : 'email'} /></label>)}
                  <label><span>{t('Mobile number')} *</span><input type="tel" inputMode="numeric" maxLength={10} value={form.phone} onChange={event => update('phone', event.target.value.replace(/\D/g, '').slice(0, 10))} required /><small>{t('Enter your 10-digit number without +91.')}</small></label>
                </div>}
                {step === 1 && <div className="next-field-grid">
                  <label><span>{t('Starting date')} *</span><input type="date" min={new Date().toISOString().slice(0, 10)} value={form.pickupDate} onChange={event => update('pickupDate', event.target.value)} required /></label>
                  <label><span>{t('Expected return date')} *</span><input type="date" min={form.pickupDate} value={form.returnDate} onChange={event => update('returnDate', event.target.value)} required /></label>
                  <label><span>{t('Pickup time')}</span><input type="time" value={form.pickupTime} onChange={event => update('pickupTime', event.target.value)} /></label>
                  <label><span>{t('Flexible extension until')} <small>{t('OPTIONAL BUFFER')}</small></span><input type="date" min={form.returnDate || form.pickupDate} value={form.bufferDate} onChange={event => update('bufferDate', event.target.value)} /></label>
                </div>}
                {step === 2 && <div className="next-field-grid">
                  <label><span>{t('Trip type')} *</span><select value={form.tripType} onChange={event => update('tripType', event.target.value)}><option value="ONE_WAY">{t('One way')}</option><option value="ROUND_TRIP">{t('Round trip')}</option><option value="LOCAL">{t('Local')}</option></select></label>
                  <label><span>{t('Passengers')} *</span><input type="number" min="1" max="20" value={form.passengers} onChange={event => update('passengers', Number(event.target.value))} /></label>
                  <label className="wide"><span>{t('Pickup location')} *</span><input value={form.pickup} onChange={event => update('pickup', event.target.value)} placeholder={t('City, area or address')} required /><button type="button" className="btn btn-soft" onClick={useCurrentLocation}>{t('Use current location')}</button>{placeSuggestions.pickup.length > 0 && <div className="next-place-suggestions">{placeSuggestions.pickup.map(place => <button type="button" key={place} onClick={() => { update('pickup', place); setPlaceSuggestions(current => ({ ...current, pickup: [] })); }}>{place}</button>)}</div>}</label>
                  <label className="wide"><span>{t('Destination')} *</span><input value={form.destination} onChange={event => update('destination', event.target.value)} placeholder={t('City, area or address')} required />{placeSuggestions.destination.length > 0 && <div className="next-place-suggestions">{placeSuggestions.destination.map(place => <button type="button" key={place} onClick={() => { update('destination', place); setPlaceSuggestions(current => ({ ...current, destination: [] })); }}>{place}</button>)}</div>}</label>
                  <label><span>{t('Approximate total trip distance (km)')} *</span><input type="number" min="1" max="10000" value={form.estimatedKm} onChange={event => update('estimatedKm', event.target.value)} required /></label>
                  <p className="wide muted" aria-live="polite">{t(distanceMessage)}</p>
                  <label className="wide"><span>{t('Special requirements')}</span><textarea value={form.notes} onChange={event => update('notes', event.target.value)} /></label>
                </div>}
                {step === 3 && <>
                  <p className="muted">{t('Choose up to three vehicles. Only vehicles matching your passenger count are shown.')}</p>
                  {loadingVehicles ? <p>{t('Loading available vehicles…')}</p> : (
                    <div className="next-vehicle-grid">
                      {eligibleVehicles.map(vehicle => {
                        const selected = form.preferredVehicleIds.includes(vehicle.id);
                        return <label className={`next-vehicle-option ${selected ? 'selected' : ''}`} key={vehicle.id}>
                          <input type="checkbox" checked={selected} onChange={() => toggleVehicle(vehicle.id)} />
                          {vehicle.imageUrl && <img src={vehicle.imageUrl} alt={vehicle.name} />}
                          <strong>{vehicle.name}</strong>
                          <span>{vehicle.minPassengers}–{vehicle.maxPassengers || '—'} {t('passengers')} · ₹{money(vehicle.perKilometerRate)}/km</span>
                          <span>{t('Driver')} ₹{money(vehicle.driverDailyCost)}/{t('day')}</span>
                        </label>;
                      })}
                      {!eligibleVehicles.length && <p>{t('No priced vehicles currently match this passenger count.')}</p>}
                    </div>
                  )}
                  {error && <p className="next-error" role="alert">{error}</p>}
                </>}
                {step === 4 && <div className="next-field-grid">
                  <div className="wide next-status-result">
                    <div className="review-head"><b>{t('Your trip at a glance')}</b><button type="button" onClick={() => { setError(''); setStep(0); }}>{t('Edit details ↗')}</button></div>
                    <p><strong>{form.customerName}</strong> · {form.phone}</p>
                    <p>{form.pickup} → {form.destination} · {t({ ONE_WAY: 'One way', ROUND_TRIP: 'Round trip', LOCAL: 'Local' }[form.tripType])}</p>
                    <p>{form.pickupDate} to {form.bufferDate || form.returnDate} · {form.passengers} {t('passengers')} · {money(form.estimatedKm)} km</p>
                    {estimates.map(vehicle => <p key={vehicle.id}><strong>{vehicle.name}</strong>: ₹{money(Number(form.estimatedKm) * vehicle.perKilometerRate + vehicle.days * vehicle.driverDailyCost)} {t('estimated')} ({money(form.estimatedKm)} km × ₹{money(vehicle.perKilometerRate)} + {vehicle.days} {t('days')} × ₹{money(vehicle.driverDailyCost)})</p>)}
                    <small>{t('Estimates are indicative; the team will confirm availability, route and final fare.')}</small>
                  </div>
                  <label className="wide next-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)} /><span>{t('Phone number consent is required.')} {t('I agree that Chirag Travels may use this number to call me about this trip and share it with the appropriate driver for trip coordination.')} *</span></label>
                </div>}
                {error && step !== 3 && <p className="next-error" role="alert">{error}</p>}
                <div className="next-actions">
                  <button type="button" className="btn btn-outline" disabled={step === 0 || busy} onClick={() => { setError(''); setStep(current => current - 1); }}>{t('Back')}</button>
                  {step < 4
                    ? <button type="submit" className="btn btn-primary" disabled={busy}>{t('Continue')} →</button>
                    : <button type="submit" className="btn btn-primary" disabled={busy}>{busy ? t('Sending…') : `${t('Send trip inquiry')} ↗`}</button>}
                </div>
              </form>
            </>
          )}
        </div>
        <div className="booking-foot"><span>✳ {business.businessName || 'Chirag Travels'}</span>{business.phone && <a href={`tel:${business.phone.replace(/[^\d+]/g, '')}`}>{business.phone}</a>}{business.serviceEmail && <a href={`mailto:${business.serviceEmail}`}>{business.serviceEmail}</a>}<Link href="/status">{t('Check inquiry status')} ↗</Link><Link href="/">{t('Return to website')} ↗</Link></div>
      </main>
    </>
  );
}
