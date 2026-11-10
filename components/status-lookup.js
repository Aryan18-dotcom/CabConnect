'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { LanguageSelect, useLanguage } from './use-language';

export default function StatusLookup() {
  const { language, t, changeLanguage } = useLanguage();
  const [reference, setReference] = useState('');
  const [businessName, setBusinessName] = useState('Chirag Travels');
  const [businessContact, setBusinessContact] = useState({ phone: '', email: '' });
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetch('/api/public/business')
      .then(response => response.ok ? response.json() : null)
      .then(details => {
        if (active && details) {
          if (details.businessName) setBusinessName(details.businessName);
          setBusinessContact({ phone: details.phone || '', email: details.serviceEmail || '' });
        }
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    document.title = document.title.replace(/Chirag Travels/gi, businessName);
  }, [businessName]);

  useEffect(() => {
    const queryReference = new URLSearchParams(window.location.search).get('IR');
    let savedReference = '';
    try { savedReference = localStorage.getItem('cabconnectInquiryReference') || ''; } catch {}
    const initial = (queryReference || savedReference).trim();
    if (!initial) return;
    setReference(initial);
    lookup(initial);
  }, []);

  async function lookup(value = reference) {
    const normalized = value.trim().toUpperCase();
    if (!normalized) return;
    setBusy(true);
    setError('');
    setResult(null);
    try {
      const response = await fetch(`/api/public/inquiries/${encodeURIComponent(normalized)}/status`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'We could not find this reference.');
      setResult(data);
      setReference(data.inquiryReference);
      try { localStorage.setItem('cabconnectInquiryReference', data.inquiryReference); } catch {}
    } catch (lookupError) {
      setError(lookupError.message);
    } finally {
      setBusy(false);
    }
  }

  function submit(event) {
    event.preventDefault();
    lookup();
  }

  function another() {
    setResult(null);
    setReference('');
    setError('');
    try { localStorage.removeItem('cabconnectInquiryReference'); } catch {}
    window.history.replaceState({}, document.title, '/status');
  }

  const statusText = ({
    NEW: 'Received — our team is reviewing your inquiry.',
    REVIEWING: 'Under review by our team.',
    CONVERTED: 'Confirmed — your trip is now a booking.',
    CONFIRMED: 'Your booking is confirmed.',
    TENTATIVE: 'Your booking is being processed.',
    UPCOMING: 'Your trip is scheduled.',
    COMPLETED: 'This trip has been completed.',
    REJECTED: 'This trip request was not accepted. Please review the note from our team.',
    CANCELLED: 'This inquiry was cancelled.'
  })[result?.status] || result?.status || '';

  return (
    <>
      <nav className="site-nav booking-nav">
      <Link className="logo" href="/"><span className="logo-mark">c<span>t</span></span><span>{businessName.toUpperCase()}<small>{t('TRAVEL WITH COMFORT')}</small></span></Link>
      <Link className="help-link" href="/booking">{t('Plan another trip ↗')}</Link>
      <LanguageSelect language={language} onChange={changeLanguage} t={t} />
      </nav>
      <main className="status-shell">
      <section className="status-card">
        <div className="eyebrow"><i /> {businessName.toUpperCase()}</div>
        <h1>{t('Check your')} <em>{t('inquiry status.')}</em></h1>
        <p>{t('Enter the reference number you received after submitting your trip inquiry.')}</p>
        <form onSubmit={submit} className="stack">
          <label>{t('Inquiry reference')}<div className="status-input-row"><input autoComplete="off" value={reference} onChange={event => setReference(event.target.value)} placeholder="e.g. INQ-2026-12345678" required /><button className="btn btn-dark" disabled={busy}>{busy ? t('Checking…') : <>{t('Check status')} <span>↗</span></>}</button></div></label>
          {error && <p className="next-error" role="alert">{error}</p>}
        </form>
        {result && <div className="status-result" role="status">
          <div className={`status-badge ${['CONVERTED', 'CONFIRMED'].includes(result.status) ? 'confirmed' : ''} ${result.status === 'REJECTED' ? 'rejected' : ''}`}>{t(statusText)}</div>
          <div className="status-details">
            <div><small>{t('INQUIRY REFERENCE')}</small><b>{result.inquiryReference}</b></div>
            {result.pickupDate && <div><small>{t('TRAVEL DATES')}</small><b>{result.pickupDate}{result.returnDate ? ` – ${result.returnDate}` : ''}{result.bufferDate ? <><br />{t('Buffer through')} {result.bufferDate}</> : ''}</b></div>}
            {result.bookingReference && <div><small>{t('BOOKING REFERENCE')}</small><b>{result.bookingReference}</b></div>}
          </div>
          {result.rejectionNote && <div className="status-rejection-note"><small>{t('NOTE FROM OUR TEAM')}</small><p>{result.rejectionNote}</p></div>}
          <button type="button" className="status-another" onClick={another}>{t('View another inquiry')}</button>
        </div>}
      </section>
      <div className="booking-foot"><span>✳ {businessName.toUpperCase()}</span>{businessContact.phone && <a href={`tel:${businessContact.phone.replace(/[^\d+]/g, '')}`}>{businessContact.phone}</a>}{businessContact.email && <a href={`mailto:${businessContact.email}`}>{businessContact.email}</a>}<Link href="/booking">{t('Plan a trip ↗')}</Link><Link href="/">{t('Return to website')} ↗</Link></div>
      </main>
    </>
  );
}
