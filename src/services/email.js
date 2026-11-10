import nodemailer from 'nodemailer';
import { getBusinessSettings } from './business-settings.js';

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}

function tripSummary(trip) {
  return [
    ['Pickup', trip.pickup],
    ['Destination', trip.destination],
    ['Travel dates', `${trip.pickupDate} to ${trip.bufferDate || trip.returnDate}`],
    [trip.bookingReference ? 'Booking reference' : 'Inquiry reference', trip.bookingReference || trip.inquiryReference]
  ];
}

async function sendEmail({ to, subject, heading, message, trip, note, ctaLabel, ctaUrl }) {
  const settings = await getBusinessSettings({ includeSmtpPassword: true });
  const host = settings.smtpHost.trim();
  const port = settings.smtpPort;
  const user = settings.smtpUser.trim();
  const pass = settings.smtpPassword.replace(/\s+/g, '');
  const from = (settings.smtpFrom || user).trim();
  if (!host || !Number.isInteger(port) || port < 1 || port > 65535 || !user || !pass || !from) {
    throw new Error('SMTP is not configured. Update email settings in the operations dashboard.');
  }

  const businessName = settings.businessName;
  const transport = nodemailer.createTransport({
    host,
    port,
    secure: settings.smtpSecure || port === 465,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 20000,
    auth: { user, pass }
  });
  const details = tripSummary(trip);
  const lines = [
    `Hello ${trip.customerName},`,
    message,
    ...details.map(([label, value]) => `${label}: ${value || '—'}`),
    ...(note ? [`Reason: ${note}`] : []),
    `${businessName}${settings.phone ? ` · ${settings.phone}` : ''}${settings.serviceEmail ? ` · ${settings.serviceEmail}` : ''}`
  ];
  const detailHtml = details.map(([label, value]) => `
    <tr>
      <td style="padding:11px 12px;border-bottom:1px solid #f0dfd8;color:#806f6b;font-size:12px">${escapeHtml(label)}</td>
      <td style="padding:11px 12px;border-bottom:1px solid #f0dfd8;color:#351b1a;font-size:12px;font-weight:700;text-align:right">${escapeHtml(value || '—')}</td>
    </tr>`).join('');
  const noteHtml = note ? `
    <div style="margin:22px 0;padding:16px 18px;background:#fff3ee;border-left:3px solid #c87965;border-radius:4px">
      <div style="margin-bottom:6px;color:#a16f63;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">A note from our team</div>
      <div style="color:#351b1a;font-size:14px;line-height:1.7;white-space:pre-wrap">${escapeHtml(note)}</div>
    </div>` : '';
  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#fff9f6;color:#351b1a;font-family:Arial,Helvetica,sans-serif">
  <div style="display:none;max-height:0;overflow:hidden">${escapeHtml(message)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fff9f6;padding:32px 12px">
    <tr><td align="center">
      <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="width:100%;max-width:600px;background:#fff;border:1px solid #f0dfd8">
        <tr><td style="padding:28px 32px;background:#551110;color:#fff4ed">
          <div style="font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase">${escapeHtml(businessName)}</div>
          <div style="margin-top:8px;color:#fbdac1;font-size:10px;letter-spacing:2px">TRAVEL WITH COMFORT</div>
        </td></tr>
        <tr><td style="padding:32px">
          <div style="margin-bottom:10px;color:#a16f63;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">Trip update</div>
          <h1 style="margin:0 0 14px;color:#351b1a;font-family:Georgia,serif;font-size:30px;font-weight:400;line-height:1.2">${escapeHtml(heading)}</h1>
          <p style="margin:0 0 22px;color:#806f6b;font-size:14px;line-height:1.7">${escapeHtml(message)}</p>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #f0dfd8;border-radius:5px">${detailHtml}</table>
          ${noteHtml}
          <div style="padding:22px 0 4px;text-align:center">
            <a href="${escapeHtml(ctaUrl)}" style="display:inline-block;padding:14px 22px;background:#551110;border-radius:4px;color:#fff;text-decoration:none;font-size:13px;font-weight:700">${escapeHtml(ctaLabel)} &nbsp; ↗</a>
          </div>
          <p style="margin:22px 0 0;color:#806f6b;font-size:12px;line-height:1.7">You can reply to this email or contact us${settings.phone ? ` at <a href="tel:${escapeHtml(settings.phone)}" style="color:#551110">${escapeHtml(settings.phone)}</a>` : ''}${settings.serviceEmail ? ` at <a href="mailto:${escapeHtml(settings.serviceEmail)}" style="color:#551110">${escapeHtml(settings.serviceEmail)}</a>` : ''}.</p>
        </td></tr>
        <tr><td style="padding:18px 32px;background:#fff3ee;color:#a18b84;font-size:10px;letter-spacing:1px">✳ &nbsp;${escapeHtml(businessName)} · YOUR JOURNEY, HANDLED WITH CARE</td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
  await transport.sendMail({ from, to, subject, text: lines.join('\n\n'), html });
}

function statusUrl(reference) {
  const baseUrl = process.env.PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
  return `${baseUrl}/status?IR=${encodeURIComponent(reference)}`;
}

export async function sendInquiryEmail(inquiry) {
  const settings = await getBusinessSettings();
  await sendEmail({
    to: inquiry.email,
    subject: `${settings.businessName}: inquiry received (${inquiry.inquiryReference})`,
    heading: 'We have your trip inquiry.',
    message: 'We received your trip inquiry. Our team will review it and get in touch with you.',
    trip: inquiry,
    ctaLabel: 'Check inquiry status',
    ctaUrl: statusUrl(inquiry.inquiryReference)
  });
}

export async function sendConfirmationEmail(booking) {
  const settings = await getBusinessSettings();
  const vehicleDetails = [
    ['Car', booking.vehicleName || booking.externalVehicleName || 'Chirag Travels vehicle'],
    ['Vehicle number', booking.vehicleNumber || booking.externalVehicleNumber || booking.vehicleLabel || 'To be confirmed'],
    ['Driver', booking.driverName || booking.externalDriverName || 'To be assigned'],
    ['Driver phone', booking.driverPhone || booking.externalDriverPhone || 'To be shared before the trip']
  ];
  await sendEmail({
    to: booking.customerEmail,
    subject: `${settings.businessName}: booking confirmed (${booking.bookingReference})`,
    heading: 'Your trip is confirmed.',
    message: 'Your trip has been confirmed. Here are the details for your journey.',
    trip: { ...booking, pickupDate: booking.pickupDate, returnDate: booking.returnDate },
    note: vehicleDetails.map(([label, value]) => `${label}: ${value}`).join('\n'),
    ctaLabel: 'View inquiry status',
    ctaUrl: statusUrl(booking.originalInquiry?.inquiryReference || booking.inquiryReference || '')
  });
}

export async function sendRejectionEmail(inquiry) {
  const settings = await getBusinessSettings();
  await sendEmail({
    to: inquiry.email,
    subject: `${settings.businessName}: update on inquiry (${inquiry.inquiryReference})`,
    heading: 'An update about your trip inquiry.',
    message: 'Unfortunately, we are unable to accept this trip inquiry.',
    trip: inquiry,
    note: inquiry.rejectionNote,
    ctaLabel: 'View inquiry status',
    ctaUrl: statusUrl(inquiry.inquiryReference)
  });
}

export async function sendBookingRejectionEmail(booking) {
  const settings = await getBusinessSettings();
  await sendEmail({
    to: booking.customerEmail,
    subject: `${settings.businessName}: update on booking (${booking.bookingReference})`,
    heading: 'An update about your confirmed trip.',
    message: 'We are sorry, but we are unable to proceed with this booking.',
    trip: booking,
    note: booking.rejectionNote,
    ctaLabel: 'View booking status',
    ctaUrl: statusUrl(booking.originalInquiry?.inquiryReference || booking.bookingReference)
  });
}
