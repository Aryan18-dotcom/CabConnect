import './globals.css';
import '../public/assets/css/app.css';
import '../public/assets/css/marketing.css';
import '../public/assets/css/public.css';
import '../public/assets/css/booking.css';

export const metadata = {
  metadataBase: new URL(
    process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  ),
  title: {
    default: 'Chirag Travels | Comfortable Cab Booking',
    template: '%s | Chirag Travels'
  },
  description: 'Plan a comfortable trip with Chirag Travels. Compare vehicle estimates, send a trip inquiry, and check its status online.',
  applicationName: 'CabConnect',
  robots: { index: true, follow: true },
  openGraph: {
    type: 'website',
    siteName: 'Chirag Travels',
    title: 'Chirag Travels | Comfortable Cab Booking',
    description: 'Plan your journey, compare vehicle estimates, and send a trip inquiry.'
  }
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Manrope:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
