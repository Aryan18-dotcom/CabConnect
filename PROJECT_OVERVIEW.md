# CabConnect — Chirag Travels Project Guide

This document is the standalone orientation and setup guide for the CabConnect codebase. It describes the implemented application as it exists in the repository; items called out as limitations are not implied to be available.

## 1. Product summary

CabConnect is a cab-booking inquiry and small-operator fleet management application for Chirag Travels. Customers use the public website to submit trip inquiries, compare vehicle estimates, and check inquiry status. Staff use the authenticated operations dashboard to review, accept, or reject inquiries; manage a fleet and drivers; create bookings; record payments and expenses; edit business/email settings; and view trips on a calendar.

The application is an MVP built with:

- Node.js 20+ using ES modules
- Next.js App Router and React for server-rendered, SEO-aware pages and interactive customer forms
- Next.js route handlers for JSON APIs and authentication
- React component state for interactive customer and operations workflows
- CSS modules/global styles and browser JavaScript (no TypeScript required)
- SQLite through `better-sqlite3` for development
- MongoDB through Mongoose/native collections outside development
- MongoDB/SQLite persistence, Argon2 password hashing, and Nodemailer

## 2. Application surfaces

| Surface | URL | Purpose |
|---|---|---|
| Marketing site | `/` | Public landing page and booking/status calls to action |
| Customer booking | `/booking` | Multi-step trip inquiry form, vehicle selection, and estimates |
| Inquiry status | `/status` | Look up an inquiry using its reference |
| Staff sign-in | `/login` | Start an authenticated session |
| Operations workspace | `/admin/` | Dashboard and operations modules; requires sign-in |

Successful staff login creates a session cookie that expires after seven days. Sessions are persisted in MongoDB in production and SQLite in development.

The public routes are rendered through Next.js, with page titles and descriptions for search engines. The booking wizard stores in-progress form state in React and submits through Next.js route handlers. Configure `MONGODB_URI`, a strong `SESSION_SECRET`, and `PUBLIC_APP_URL` in the project environment. Vercel's filesystem is not persistent, so do not use SQLite as a deployed database.

The admin navigation includes Dashboard, Vehicles, Drivers, Bookings, Payments, Expenses, and Inquiries. The dashboard summarizes business activity and shows a month-view booking calendar. Selecting a calendar booking opens its detail preview. The sidebar includes logout.

## 3. Customer booking and status workflow

1. The customer enters their name, 10-digit Indian mobile number, email, trip dates, pickup and destination, trip type (one way, round trip, or local), passenger count, estimated total kilometres, and any notes.
2. The location controls offer worldwide place suggestions. Google Places can be configured; Photon/OpenStreetMap is the fallback. A road-distance estimate is calculated from pickup and destination, doubled for a round trip, and remains editable. The customer can opt to use the browser's current location for pickup.
3. The customer chooses one to three eligible fleet vehicles. Each selection shows the vehicle image (when configured), passenger range, fuel and luggage information, per-kilometre price, and driver daily cost.
4. The final step presents a review and an estimate for each selected vehicle. The calculation is:

   `estimated total = (estimated total kilometres × vehicle rate per km) + (inclusive days through the later of return/buffer date × driver cost per day)`

   These are estimates based on customer-entered distance and inclusive travel days, not confirmed quotations. The displayed disclaimer notes that route, waiting time, tolls, parking, availability, and final confirmation can change the price.
5. Before submission, the customer must accept the phone-use consent notice. The form requires that the number may be used for trip calls and shared with the appropriate driver for coordination.
6. On success, the server saves an inquiry with a generated `INQ-...` reference and attempts to email a receipt. The reference is remembered in browser local storage for the status page. Email delivery failure does not undo a saved inquiry; the UI receives a warning and reference.
7. The status page looks up the inquiry by reference. It can reuse the remembered reference or let the customer look up another inquiry. A converted inquiry may also include the resulting booking reference. If staff reject an inquiry, the status page displays the rejection note and the customer receives an email with the same note.

The booking form uses a single navigation button: Continue on intermediate steps and Send trip inquiry on the final review step. Returning to an earlier step changes it back to Continue.

## 4. Operations workflows

### Dashboard and calendar

The dashboard displays counts for inquiries, bookings, today's pickups, active trips, available vehicles, drivers, payments received, and recorded expenses. Its calendar is an agenda-style month view of bookings and availability blocks; booking events open the full booking preview.

### Vehicles and drivers

Vehicle records support a name/model, registration number, optional HTTP(S) image URL, fuel type, minimum/maximum passenger capacity, luggage storage type, price per kilometre, driver cost per day, operational/availability status, ownership type, and assigned primary driver. The vehicle form offers a driver dropdown. Assignment updates the driver's vehicle link and clears their previous vehicle's primary-driver link when the driver is reassigned. Admin/owner users can delete vehicles that have no active bookings.

The driver form collects name, phone number, and age, and supports editing existing driver records. Fleet availability and inquiry acceptance use assigned drivers for bookings. Admin/owner users can delete drivers; deletion clears their vehicle assignment.

Public vehicle listings exclude partner-owned vehicles, inactive vehicles, maintenance vehicles, and vehicles without a valid positive kilometre rate. Capacity is used to filter vehicles by customer passenger count.

### Manual bookings and inquiry acceptance

Staff can create a booking from the Bookings module or the dashboard quick action. Vehicle availability is checked for the full selected date range, including any buffer date, and passenger count. Existing fleet bookings that overlap the requested dates reserve their vehicle unless their status is cancelled, rejected, or lost. If no eligible owned fleet vehicle is available, the booking workflow can use an outside vehicle and requires its car name, registration, driver name, and valid 10-digit driver phone. Booking rejection requires a customer-facing reason, changes the booking status, and attempts to email the customer; the reason is also visible through the status lookup.

Inquiry acceptance opens a full preview and allows staff to revise customer/trip information and dates before confirming. The inquiry's original data is retained, changed values are stored as Chirag's updates, and accepted details are copied into a booking. A fleet vehicle must be available for the revised dates and passenger count. The outside-vehicle option requires the same vehicle and driver information as manual booking. A confirmation email is attempted with trip, vehicle, and driver details.

### Settings, payments, and expenses

The Settings page is available to admin and owner users. It stores only the business name, customer-facing service phone/email, business timezone, SMTP username, SMTP password/app password, and sender address. Gmail host, port, and transport defaults (`smtp.gmail.com`, `587`, STARTTLS) are applied automatically. SMTP passwords are encrypted with AES-256-GCM using a key derived from `SESSION_SECRET`, and are never returned by settings/public APIs. Keep a strong `SESSION_SECRET` (at least 32 characters) stable; rotating it requires re-entering the SMTP password. Business and SMTP configuration is managed in Settings, not `.env`.

- A payment records settled money against a selected trip/booking. Fields include amount, payment mode, payment type (advance, balance, full, or refund), date, transaction reference, and notes.
- An expense records a cost against a selected vehicle. Fields include category, amount, date, and description.
- Dashboard totals are sums of recorded payment and expense amounts; they are record totals, not accounting statements.

## 5. Data and persistence

The data adapter exposes schemaless JSON documents in named collections. Main collections include:

`users`, `customers`, `inquiries`, `bookings`, `vehicles`, `drivers`, `partners`, `assignments`, `availabilityBlocks`, `quotations`, `payments`, `expenses`, `notifications`, `settings`, and `auditLogs`.

Important document links and fields:

- **Inquiry:** `inquiryReference`, customer name/phone/email, trip type, pickup/destination, pickup/return/buffer dates, passenger count, estimated kilometres, selected vehicle IDs/names and calculated estimates, consent, status, `customerId` (after acceptance), original data, and `chiragUpdates`.
- **Customer:** Accepted inquiries create or update a customer record keyed by normalized phone number. Records include name, phone, email, inquiry references, and the latest inquiry ID; the inquiry and booking link back through `customerId`.
- **Booking:** `bookingReference`, `inquiryId` (when converted), `customerId`, customer and trip details, dates, status, `vehicleId`, `vehicleSource`, driver details, fare, and (for accepted inquiries) `originalInquiry`, `acceptedDetails`, and `chiragUpdates`.
- **Vehicle:** `vehicleName`, `registrationNumber`, `imageUrl`, `fuelType`, passenger limits, `luggageStorageType`, `perKilometerRate`, `driverDailyCost`, `primaryDriverId`, `ownershipType`, `operationalStatus`, and `availabilityStatus`.
- **Driver:** `name`, `phone`, `age`, and `vehicleId`.
- **Payment:** `bookingId`, `amount`, `method`, `type`, `paidAt`, reference, and notes.
- **Expense:** `vehicleId`, category, amount, date, and description.
- **User:** username, display name, role, Argon2 password hash, active flag, and whether the initial password must be changed.

SQLite uses a separate table for each resource (`users`, `customers`, `inquiries`, `bookings`, `vehicles`, and so on), with each row storing an ID and JSON payload to preserve the existing schemaless adapter API. On startup, existing records in the old shared `documents` table are copied into their matching resource tables in a transaction; after successful migration, the old table is retained as `documents_legacy`. MongoDB continues to use one collection per resource. Keep a database backup before editing records manually.

Accepting an inquiry creates a customer row or refreshes the existing row with the same normalized phone number. This records the accepted customer's name and number and links the customer to the inquiry and booking. This contact record alone does not grant WhatsApp marketing consent; obtain and record any required campaign consent separately before sending campaigns.

### Demo fleet seed

`seedData.js` inserts four clearly labelled demo drivers and four demo vehicles using the four supplied Unsplash photos. The seed entries use placeholder driver phone values and registration numbers, plus sample pricing of ₹15/km and ₹500/driver-day. Demo vehicles are seeded `INACTIVE`, so they are not offered to customers until their real details and approved rates have been entered and their status changed to `ACTIVE` in the vehicle editor.

The script skips existing records with its stable demo IDs; it does not overwrite or update them. Edit `seedData.js` and update/remove the existing demo records directly if they have already been seeded. Production/MongoDB seeding is blocked unless the explicit `--confirm-production` flag is supplied.

## 6. API reference

All API responses are JSON. Public endpoints precede the authentication middleware; other `/api` endpoints require an authenticated session.

### Public and authentication endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health and active database mode |
| `POST` | `/api/auth/login` | Sign in and create a session |
| `GET` | `/api/auth/me` | Current session user |
| `POST` | `/api/auth/change-password` | Change password; minimum 12 characters |
| `POST` | `/api/auth/logout` | Destroy the current session |
| `GET` | `/api/public/business` | Public business details and optional Maps browser key |
| `GET` | `/api/public/vehicles` | Public vehicle catalog and customer estimate rates |
| `POST` | `/api/public/inquiries` | Validate and create a customer inquiry; attempts receipt email |
| `GET` | `/api/public/inquiries/:reference/status` | Public status lookup by inquiry or booking reference |

### Authenticated operations endpoints

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/api/me` | Current authenticated session |
| `GET` | `/api/summary` | Dashboard metrics |
| `GET` | `/api/calendar/events` | Booking and availability-block calendar events |
| `GET` | `/api/vehicles/availability?start=YYYY-MM-DD&end=YYYY-MM-DD&passengers=N` | Find eligible vehicles for dates and capacity |
| `GET` | `/api/bookings/:id` | Fetch a booking preview |
| `POST` | `/api/inquiries/:id/accept` | Convert an inquiry into a confirmed booking |
| `POST` | `/api/inquiries/:id/reject` | Reject an inquiry with a customer-visible/email rejection note |
| `GET`, `PUT` | `/api/settings` | Read/update sanitized settings (admin/owner only; SMTP password is never returned) |
| `GET`, `POST`, `PATCH`, `DELETE` | `/api/:resource[/:id]` | Generic resource read/create/update/delete for allow-listed collections (settings excluded) |

The generic resource route supports customers, inquiries, bookings, vehicles, drivers, partners, assignments, availability blocks, quotations, payments, expenses, notifications, and audit logs. Settings are managed only through their dedicated endpoints. Deletion is restricted to the admin and owner roles. Vehicle deletion is blocked while it has active bookings; driver deletion clears vehicle assignments. Check `src/routes/api.js` for current validation, field handling, and response shapes.

## 7. Configuration

Copy `.env.example` to `.env`, then set values locally. Do not commit `.env` or paste secrets into source files, docs, or issue reports.

| Variable | Purpose |
|---|---|
| `NODE_ENV` | `development` selects SQLite; other values select MongoDB |
| `PORT` | HTTP port; defaults to `3000` |
| `SESSION_SECRET` | Session-signing secret; replace the development fallback with a long random value |
| `MONGODB_URI` | Required when not in development |
| `GOOGLE_MAPS_API_KEY` | Optional restricted browser key for Places suggestions |
| `PUBLIC_APP_URL` | Public base URL included in inquiry emails |

Business identity, public contact details, timezone, and SMTP credentials are stored in the database using the authenticated Settings page rather than environment variables.

### Vercel deployment

Import the project into Vercel and keep the Next.js framework preset. Add these environment variables for Production (and Preview if needed):

- `MONGODB_URI`: persistent MongoDB connection string accessible from Vercel
- `SESSION_SECRET`: a unique random secret of at least 32 characters
- `PUBLIC_APP_URL`: the deployed HTTPS origin, used in email links and metadata
- `GOOGLE_MAPS_API_KEY`: optional, restricted browser key for Places suggestions

The repository includes `vercel.json`; API route handlers live under `app/api`. Vercel's local filesystem is ephemeral; production must use MongoDB and must not run the SQLite development mode. Set email credentials through the authenticated Settings page after deploying.

### Gmail SMTP

For Gmail SMTP, set host to `smtp.gmail.com`, port to `587`, and security mode to STARTTLS in the Settings page. Port 465 normally uses SSL/TLS. Use a Gmail app password generated after enabling 2-Step Verification; do not use the normal account password. Gmail may display an app password in groups with spaces. CabConnect removes whitespace before SMTP authentication. The password is encrypted at rest and is not included in API responses.

The SMTP sender address may be the authenticated Gmail address; if omitted, the SMTP username is used. Emails are sent for inquiry receipts, accepted booking confirmations, and rejection notices. Delivery is best-effort: a failure is logged and shown as a warning without discarding the underlying inquiry or booking.

## 8. Local setup and commands

Requirements: Node.js 20.9 or newer and npm.

```powershell
Copy-Item .env.example .env
npm install
npm run dev
```

`npm run dev` starts the Next.js website and API on port 3000.

In `.env`, keep `NODE_ENV=development` to use SQLite. The server creates the SQLite database and bootstraps the initial admin and owner accounts if missing. The first login requires changing the bootstrap password; new passwords must be at least 12 characters. These bootstrap credentials are intended for local setup only—change them before any shared or public deployment.

Seed the demo vehicles/drivers from the project root:

```powershell
npm run seed:data
```

Open `http://localhost:3000`. To build the Next.js application, use `npm run build`. `npm start` starts Next.js in production mode. The seed script will not target MongoDB unless explicitly invoked with `node seedData.js --confirm-production`; review the demo data before doing so.

No frontend compilation step is required. The server serves files directly from `public/`.

## 9. Project layout

```text
public/
  admin/                     Operations dashboard HTML
  assets/css/                Public and admin styles
  assets/js/                 Admin, booking, marketing, status, language logic
  booking.html               Customer inquiry flow
  index.html                 Landing page
  login.html                 Staff sign-in
  status.html                Inquiry status lookup
src/
  db/index.js                SQLite/MongoDB adapter and bootstrap users
  middleware/auth.js         Session and role authorization
  routes/api.js              Public and authenticated business APIs
  routes/auth.js             Login, logout, and password change
  services/email.js          Inquiry and booking email delivery
data/                        Local SQLite database (generated; do not commit)
app/api/                     Next.js API and authentication route handlers
seedData.js                  Repeatable demo fleet seed script
app/                         Next.js App Router pages and SEO metadata
components/                  React booking, login, status, and admin shells
vercel.json                  Vercel project/function configuration
next.config.js               Next.js config and local API proxy
```

## 10. Security, privacy, and operations notes

- Never publish `.env`, SMTP passwords, MongoDB credentials, or unrestricted Maps keys. Rotate any secret that has been exposed.
- SMTP password encryption depends on `SESSION_SECRET`; keep it strong and stable, and update the SMTP password in Settings after rotating it.
- Change bootstrap passwords and `SESSION_SECRET`; use HTTPS and a least-privilege MongoDB user in production.
- Production sessions use MongoDB; development sessions use SQLite.
- The customer phone consent is stored with the inquiry. Follow applicable privacy, consent, data-retention, and customer communication rules.
- Fleet availability is validated by the API, but the MongoDB adapter does not provide transaction-based conflict protection for concurrent booking acceptance. Do not treat this MVP as a guaranteed atomic dispatch system.
- Back up production data and test restore procedures. Configure persistent object storage before introducing identity or vehicle-document uploads.
- Public vehicle photo URLs point to Unsplash; replace them with approved, durable image URLs if required.

## 11. Current limitations

- The calendar is a month agenda/grid, not a resource timeline with drag-and-drop scheduling.
- No atomic transaction or database-level uniqueness mechanism currently prevents two simultaneous requests from racing to reserve one vehicle.
- Route distance uses Photon geocoding and the public OSRM driving router as an editable estimate, not a guaranteed quote. Google Maps Directions routing, tolls, waiting rules, automated fare rules, quotation versioning, and final quote acceptance are not implemented.
- Partner settlement flows, OTP trip tracking, WhatsApp messaging, and document uploads/storage are not implemented.
- The resource model is intentionally schemaless and generic CRUD forms cover only the fields currently required by the interface.
- Automated test coverage is limited; verify authentication, role access, pricing, date overlaps, and email delivery in the target deployment before launch.

## 12. Useful source files

- `app/` — Next.js pages, metadata, and API route handlers
- `src/server/api-handler.js` — API initialization, cookie sessions, and route dispatch
- `src/db/index.js` — database selection, collection adapter, and bootstrap users
- `src/routes/api.js` — API validation, inquiry conversion, fleet availability, and CRUD
- `src/routes/auth.js` — login and password lifecycle
- `src/services/email.js` — SMTP transport and email content
- `.env.example` — secret-free environment variable template
- `README.md` — concise setup notes
