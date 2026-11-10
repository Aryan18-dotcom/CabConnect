import { dynamicPrefixes, translations } from './translations';

export function translate(language, value) {
  const dictionary = translations[language] || {};
  if (dictionary[value]) return dictionary[value];
  const distance = value.match(/^Estimated ([\d,.]+) total km(?: \(round trip\))?\. Edit if needed\.$/);
  if (distance && language === 'hi') return `अनुमानित ${distance[1]} कुल किमी${value.includes('(round trip)') ? ' (आने-जाने की यात्रा)' : ''}। ज़रूरत पड़ने पर संपादित करें।`;
  if (distance && language === 'gu') return `અંદાજિત ${distance[1]} કુલ કિમી${value.includes('(round trip)') ? ' (આવવા-જવાની મુસાફરી)' : ''}. જરૂર પડે તો ફેરફાર કરો.`;
  const prefix = Object.entries(dynamicPrefixes[language] || {})
    .find(([english]) => value.startsWith(english));
  return prefix ? `${prefix[1]}${value.slice(prefix[0].length)}` : value;
}
