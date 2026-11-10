'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { LanguageSelect, useLanguage } from './use-language';

export default function HomePage() {
  const { language, t, changeLanguage } = useLanguage();
  const [business, setBusiness] = useState({ businessName: 'Chirag Travels' });
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    fetch('/api/public/business')
      .then(response => response.ok ? response.json() : null)
      .then(details => { if (details) setBusiness(details); })
      .catch(() => {});
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    }), { threshold: 0.12 });
    document.querySelectorAll('.reveal').forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, []);

  const phoneHref = business.phone ? `tel:${business.phone.replace(/[^\d+]/g, '')}` : 'tel:';
  const contactText = useMemo(() => {
    if (!business.phone && !business.serviceEmail) return "Questions? we're happy to help.";
    return null;
  }, [business.phone, business.serviceEmail]);
  const brandName = business.businessName || 'Chirag Travels';

  useEffect(() => {
    document.title = document.title.replace(/Chirag Travels/gi, brandName);
  }, [brandName]);

  return (
    <>
      <div className="announcement"><span>✦</span> {t('Your next journey starts with a little more comfort')} <Link href="/booking">{t('Plan a ride')} <b>↗</b></Link></div>
      <nav className="site-nav">
        <Link className="logo" href="/"><span className="logo-mark">c<span>t</span></span><span>{brandName.toUpperCase()}<small>{t('TRAVEL WITH COMFORT')}</small></span></Link>
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#experience">{t('Why us')}</a><a href="#fleet">{t('Our fleet')}</a><a href="#journeys">{t('Our journeys')}</a><a href="#contact">{t('Contact')}</a><Link href="/status">{t('Check inquiry status')}</Link>
        </div>
        <div className="nav-actions">
          <LanguageSelect language={language} onChange={changeLanguage} t={t} />
          <a className="nav-phone" id="navPhone" href={phoneHref}>↗ <span>{t('Talk to us')}</span></a>
          <Link className="btn btn-dark nav-cta" href="/booking">{t('Book your ride')} <span>↗</span></Link>
          <button className="menu-toggle" aria-label="Open menu" aria-expanded={menuOpen} onClick={() => setMenuOpen(value => !value)}>☰</button>
        </div>
      </nav>
      <main>
        <section className="hero">
          <div className="hero-copy reveal"><div className="eyebrow"><i /> {t('A BETTER WAY TO GET THERE')}</div><h1>{t('Make the journey')}<br />{t('part of the')} <em>{t('memory.')}</em></h1>
            <p>{t("Thoughtful rides, trusted drivers and the freedom to travel at your own pace. From quick getaways to family adventures, we're here for every mile.")}</p>
            <div className="hero-buttons"><Link className="btn btn-dark btn-large" href="/booking">{t('Book your ride now')} <span>↗</span></Link><a className="text-link" href="#experience">{t('Discover the difference')} <span>↓</span></a></div>
            <div className="hero-trust"><div className="avatar-stack"><span>CT</span><span>✦</span><span>✓</span></div><div><b>{t('Personal service, every trip')}</b><small>{t('From first hello to final drop-off')}</small></div></div>
          </div>
          <div className="hero-visual reveal"><div className="hero-image" /><div className="image-note"><span className="note-icon">✳</span><div><b>{t('Your route. Your rhythm.')}</b><small>{t('Comfort comes standard.')}</small></div></div><div className="floating-stamp"><span>CHIRAG</span><b>TRAVELS</b><small>EST. WITH CARE</small></div><div className="hero-orbit" /></div>
          <div className="hero-bottom"><span>01 / 03</span><span>{t('MADE FOR THE ROAD AHEAD')}</span><span>{t('SCROLL TO EXPLORE ↓')}</span></div>
        </section>
        <section className="intro section-wrap" id="experience">
          <div className="intro-kicker reveal">{t('THE CHIRAG DIFFERENCE')} <span>✳</span></div>
          <div className="intro-content reveal"><h2>{t('Good trips begin')}<br />{t('with')} <em>{t('good people.')}</em></h2><div><p>{t("We believe getting there should feel just as good as being there. That's why we bring together comfortable vehicles, experienced drivers and a personal touch that makes every journey easier.")}</p><Link className="under-link" href="/booking">{t("Let's plan your journey")} <span>↗</span></Link></div></div>
          <div className="benefits"><article className="benefit reveal"><span>01</span><div className="benefit-icon">✦</div><h3>{t('Comfort, considered')}</h3><p>{t('Clean, air-conditioned rides with room for your people and luggage.')}</p></article><article className="benefit reveal"><span>02</span><div className="benefit-icon">⌖</div><h3>{t('Drivers you can trust')}</h3><p>{t('Experienced people who value your time, safety and peace of mind.')}</p></article><article className="benefit reveal"><span>03</span><div className="benefit-icon">♡</div><h3>{t('Personal by nature')}</h3><p>{t('Real conversations, flexible plans and support when you need it.')}</p></article></div>
        </section>
        <section className="fleet-section" id="fleet"><div className="section-wrap"><div className="section-heading reveal"><div><div className="eyebrow"><i /> {t('FIND YOUR KIND OF COMFORT')}</div><h2>{t('A ride for every')}<br /><em>{t('kind of plan.')}</em></h2></div><p>{t("From nimble city rides to spacious family travel, choose what feels right. We'll confirm the best available vehicle for your dates.")}</p></div>
          <div className="fleet-preview"><article className="fleet-tile fleet-one reveal"><div className="fleet-photo ertiga-photo" /><div className="fleet-meta"><div><small>{t('FAMILY FAVOURITE')}</small><h3>Maruti Ertiga</h3><p>{t('Room for the whole crew.')}</p></div><Link href="/booking" aria-label="Choose Ertiga">↗</Link></div></article><article className="fleet-tile fleet-two reveal"><div className="fleet-photo innova-photo" /><div className="fleet-meta"><div><small>{t('EXTRA ROOM, EXTRA EASE')}</small><h3>Toyota Innova</h3><p>{t('Made for longer journeys.')}</p></div><Link href="/booking" aria-label="Choose Innova">↗</Link></div></article><article className="fleet-tile fleet-three reveal"><div className="fleet-photo sedan-photo" /><div className="fleet-meta"><div><small>{t('LIGHT & EASY')}</small><h3>Swift / Dzire</h3><p>{t('Simple, comfortable travel.')}</p></div><Link href="/booking" aria-label="Choose Swift or Dzire">↗</Link></div></article></div>
          <div className="fleet-foot"><span>✳ {t('MORE OPTIONS AVAILABLE ON REQUEST')}</span><Link className="under-link" href="/booking">{t('Explore & select your vehicle')} <span>↗</span></Link></div></div></section>
        <section className="journey-section section-wrap"><div className="journey-art reveal"><div className="journey-art-bg" /><div className="journey-quote">“{t('The best part')}<br />{t('is getting')}<br /><em>{t('there together.')}</em>”</div><span className="journey-sun">✳</span></div><div className="journey-copy reveal"><div className="eyebrow"><i /> {t('WHERE TO NEXT?')}</div><h2>{t('Big plans.')}<br /><em>{t('Easy journeys.')}</em></h2><p>{t("Weekend escapes, family visits, airport transfers or a few days exploring somewhere new. Tell us what you have in mind — we'll help make the ride happen.")}</p><ul><li><span>↗</span> {t('Outstation & round trips')}</li><li><span>↗</span> {t('One-way city-to-city rides')}</li><li><span>↗</span> {t('Multi-day travel & custom itineraries')}</li></ul><Link className="btn btn-dark btn-large" href="/booking">{t('Start planning')} <span>↗</span></Link></div></section>
        <section className="cta-band" id="contact"><div className="cta-spark">✳</div><div className="eyebrow">{t('YOUR SEAT IS WAITING')}</div><h2>{t('Where will the road')}<br /><em>{t('take you?')}</em></h2><p>{t("Share a few details. We'll take it from there.")}</p><Link className="btn btn-light btn-large" href="/booking">{t('Book your ride now')} <span>↗</span></Link><small id="contactLine">{contactText || <>{t('Questions?')} {business.phone && <> {t('Call')} <a href={phoneHref}>{business.phone}</a></>}{business.phone && business.serviceEmail && ' or '}{business.serviceEmail && <a href={`mailto:${business.serviceEmail}`}>{business.serviceEmail}</a>} — {t("we're happy to help.")}</>}</small></section>
      </main>
      <footer className="site-footer"><Link className="logo" href="/"><span className="logo-mark">c<span>t</span></span><span>{brandName.toUpperCase()}<small>{t('TRAVEL WITH COMFORT')}</small></span></Link><span>© {new Date().getFullYear()} {brandName}. {t('Made for the road ahead.')}</span><Link href="/status">{t('Check inquiry status')} ↗</Link><Link href="/login">{t('Admin sign in ↗')}</Link></footer>
    </>
  );
}
