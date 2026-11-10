export default function robots() {
  const baseUrl = process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/login', '/status'] },
    sitemap: `${baseUrl}/sitemap.xml`
  };
}
