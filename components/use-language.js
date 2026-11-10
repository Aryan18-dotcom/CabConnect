'use client';

import { useEffect, useState } from 'react';
import { translate } from './language';

export function useLanguage() {
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    try { setLanguage(localStorage.getItem('cabconnectLanguage') || 'en'); } catch {}
  }, []);

  useEffect(() => { document.documentElement.lang = language; }, [language]);

  function changeLanguage(event) {
    const value = event.target.value;
    setLanguage(value);
    try { localStorage.setItem('cabconnectLanguage', value); } catch {}
  }

  return { language, t: value => translate(language, value), changeLanguage };
}

export function LanguageSelect({ language, onChange, t }) {
  return (
    <select className="language-select" aria-label={t('Language')} value={language} onChange={onChange}>
      <option value="en">English</option>
      <option value="hi">हिन्दी</option>
      <option value="gu">ગુજરાતી</option>
    </select>
  );
}
