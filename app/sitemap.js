export default function sitemap() {
  const baseUrl = process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  const lastModified = new Date();

  return [
    { url: baseUrl, lastModified, changeFrequency: 'weekly', priority: 1 },
    { url: `${baseUrl}/booking`, lastModified, changeFrequency: 'monthly', priority: 0.8 }
  ];
}
