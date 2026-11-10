# Chirag Travels — CabConnect Operations

Chirag Travels is a responsive cab booking inquiry, fleet, driver and partner operations application built as a single Next.js and React application with SQLite/MongoDB persistence.

## Requirements

- Node.js 20.9 or newer
- npm
- MongoDB Atlas connection string for production mode

## Quick start (SQLite development mode)

```bash
npm install
cp .env.example .env
npm run dev
```

On Windows PowerShell, if `cp` is unavailable:

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

`npm run dev` starts the complete Next.js application at `http://localhost:3000`. Next.js route handlers provide the API, and local API requests initialize SQLite automatically.

To insert the clearly labelled demo vehicles and drivers (with sample Unsplash vehicle photos) into the development database, run `npm run seed:data`. The demo records are intentionally inactive and use placeholder contact/registration values; replace them and confirm the rates before activating any vehicle.

Open:

- Public website: http://localhost:3000
- Booking flow: http://localhost:3000/booking
- Admin login: http://localhost:3000/login

### Initial accounts

| User | Username / ID | Temporary password |
|---|---|---|
| Administrator (you) | `admin` | `admin@123` |
| Owner (Chirag) | `chirag` | `chirag@123` |

Both accounts are seeded automatically if they do not already exist. Both users must change their temporary password at first login. New passwords must be at least 12 characters.

**Security:** These are development bootstrap credentials requested for the initial setup. Change both passwords immediately, set a strong `SESSION_SECRET`, and never expose the application publicly while these temporary credentials remain active.

## Production mode (MongoDB)

Set `NODE_ENV=production` and configure `MONGODB_URI` and a strong `SESSION_SECRET` in your hosting provider's environment variables.

```env
NODE_ENV=production
MONGODB_URI=mongodb+srv://...
SESSION_SECRET=use-a-long-random-secret
```

Then run:

```bash
npm start
```

When `NODE_ENV` is anything other than `development`, the app uses MongoDB. MongoDB must be reachable at startup. The initial admin and owner accounts are also created automatically if missing.

For production, use HTTPS. The session cookie is marked Secure in production. Configure your reverse proxy/hosting provider correctly before enabling trust proxy if needed.

## Main functionality included

- Animated Chirag Travels marketing landing page with a separate five-step booking inquiry flow
- Customer details, trip dates plus optional extension buffer, live place suggestions, passenger count and up to three vehicle preferences
- One-way, round-trip and local trip types, automatic editable road-distance estimates, and pricing through the later return/buffer date
- Google Places Autocomplete support when a restricted Google Maps browser API key is configured; Photon/OpenStreetMap suggestions are used as a worldwide fallback
- Inquiry submission stores buffer date and preferred vehicle choices
- Public customer inquiry form (no customer account required)
- Random inquiry references, public status lookup, and a remembered customer reference
- Optional English, Hindi and Gujarati translations on public pages
- SMTP inquiry receipts and booking confirmation emails, including assigned vehicle and driver details
- Inquiry rejection notes sent by email and shown on the public inquiry status page
- Booking rejection with a required reason, customer email notification, and status-page lookup by booking reference
- Admin/owner Settings page for business name, phone, email, timezone and encrypted Gmail SMTP credentials
- Worldwide place suggestions and an opt-in current-location pickup selector
- Admin login and forced first-login password change
- Owner and administrator accounts
- Dashboard summary
- Inquiry, booking, vehicle, driver, partner, customer, payment and expense records
- Driver editing and vehicle/driver assignment management
- Calendar agenda view for bookings and availability blocks
- Business settings
- Seven-day staff login sessions (MongoDB-backed in production)
- CSV exports
- Light/dark theme
- Responsive admin layout
- English, Hindi and Gujarati language switching on the public landing, booking and inquiry-status pages
- SQLite development / MongoDB non-development database selection

## Important current limitations

This is a working starter/MVP foundation, not a fully audited commercial dispatch platform yet.

- Calendar currently provides an agenda view; resource timeline and drag/drop scheduling are future work.
- Quotation versioning, automated fare rules, partner settlement workflow, OTP tracking, Google Maps routing and WhatsApp delivery are not yet implemented.
- Booking and inquiry review workflows support date edits, available-fleet selection, outside-vehicle details and customer rejection notes.
- The production MongoDB adapter uses MongoDB collections but does not yet implement transaction-based booking/assignment conflict protection.
- Sessions are persisted in SQLite during local development and MongoDB in production.
- Configure persistent object storage before uploading identity or vehicle documents.
- Review legal, privacy, WhatsApp consent/template and data-retention requirements before public launch.

## Project structure

```text
public/       Customer website, admin UI, CSS and JavaScript
src/db/       SQLite and MongoDB adapters and bootstrap users
src/routes/   Shared API endpoint definitions
app/api/      Next.js API route handlers
src/server/   Request dispatch and session helpers for route handlers
app/          Next.js App Router pages and SEO metadata
```

## API basics

- `GET /api/health`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/logout`
- `POST /api/public/inquiries`
- `GET /api/public/inquiries/{reference}/status` (accepts an inquiry or booking reference)
- `GET /api/public/business`
- `GET /api/summary`
- `GET /api/calendar/events`
- Authenticated CRUD: `/api/{inquiries,bookings,vehicles,drivers,partners,customers,payments,expenses}`; settings are managed through the dedicated settings page and API.

## Before production

1. Replace the temporary passwords and set a random session secret.
2. Configure MongoDB Atlas network access and least-privilege credentials.
3. Enable HTTPS and verify secure cookie behavior.
4. Add automated backups and test restore procedures.
5. Implement and test atomic availability/assignment checks before relying on the calendar for real dispatch.
6. Add customer-facing business and SMTP details from the authenticated Settings page before relying on email delivery.
7. Add automated tests for authentication, authorization, pricing, and booking overlaps.

## Vercel deployment

This project uses the Next.js framework preset and includes `vercel.json`. All API endpoints are implemented as Next.js route handlers under `app/api`. Configure `MONGODB_URI`, `SESSION_SECRET` (at least 32 random characters), and `PUBLIC_APP_URL` in Vercel's project environment settings. `GOOGLE_MAPS_API_KEY` is optional and should be restricted to the deployed browser origin.

Use MongoDB for Vercel deployments; serverless filesystem storage is ephemeral and SQLite is for local development only. Authentication uses a random seven-day HttpOnly cookie backed by the `sessions` collection. After deployment, configure business and SMTP details in the authenticated Settings page. Deploy with `npm run build`; Vercel runs the Next.js build automatically.


## Google Maps place suggestions

The booking page works without a Google key using worldwide Photon/OpenStreetMap suggestions. Customers can also choose to share their current location for pickup; the browser asks for permission and uses the location only to fill that field. To enable Google Places suggestions, create a browser key in Google Cloud, enable the Maps JavaScript API and Places API, configure HTTP referrer restrictions for your local and production domains, and set `GOOGLE_MAPS_API_KEY` in `.env`. This key is intentionally sent to the browser, so it must be restricted; never use an unrestricted server credential as the browser key.

## Email and business settings
The authenticated Settings page contains only business name, customer-facing phone/email, timezone, SMTP user, SMTP password/app password, and SMTP from address. Gmail host, port, and STARTTLS settings are applied automatically (`smtp.gmail.com`, port `587`, secure disabled). SMTP passwords are encrypted in the database with a key derived from `SESSION_SECRET`; use a random `SESSION_SECRET` of at least 32 characters and keep it stable. The SMTP password is never returned to the browser. Do not put business or SMTP credentials in `.env`.

Gmail usually uses `smtp.gmail.com`, port `587`, and STARTTLS (secure disabled); port `465` normally uses SSL/TLS. Use an app password after enabling 2-Step Verification. The application sends inquiry receipts, booking confirmations, and inquiry-rejection emails. Delivery failure does not undo the inquiry or booking, and the dashboard reports an email warning. The customer status page is available at `/status`.

The public inquiry endpoint validates the 10-digit Indian mobile number, a positive estimated trip distance, consent, and up to three preferred vehicles. The booking flow can estimate road distance from pickup and destination; customers may edit the estimate before submitting.
#   C a b C o n n e c t  
 