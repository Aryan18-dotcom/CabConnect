import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { collection } from '../db/index.js';

const settingsKey = createHash('sha256')
  .update(String(process.env.SESSION_SECRET || 'development-only-change-this-secret'))
  .digest();

export async function getBusinessSettings({ includeSmtpPassword = false } = {}) {
  const settings = collection('settings');
  const record = await settings.findOne({ settingKey: 'business' }) || (await settings.find())[0] || {};
  const result = {
    ...record,
    settingKey: 'business',
    businessName: String(record.businessName || 'Chirag Travels'),
    phone: String(record.phone || ''),
    businessEmail: String(record.businessEmail || record.serviceEmail || ''),
    timezone: String(record.timezone || 'Asia/Kolkata'),
    smtpHost: 'smtp.gmail.com',
    smtpPort: 587,
    smtpSecure: false,
    smtpUser: String(record.smtpUser || ''),
    smtpFrom: String(record.smtpFrom || ''),
    hasSmtpPassword: Boolean(record.smtpPasswordEncrypted || record.smtpPassword)
  };
  if (includeSmtpPassword) {
    result.smtpPassword = record.smtpPasswordEncrypted
      ? decryptPassword(record.smtpPasswordEncrypted)
      : String(record.smtpPassword || '');
  }
  return result;
}

export async function saveBusinessSettings(patch) {
  const settings = collection('settings');
  const current = await getBusinessSettings();
  const next = {
    businessName: String(patch.businessName ?? current.businessName).trim().slice(0, 120),
    phone: String(patch.phone ?? current.phone).trim().slice(0, 40),
    businessEmail: String(patch.businessEmail ?? current.businessEmail).trim().slice(0, 160),
    timezone: String(patch.timezone ?? current.timezone).trim().slice(0, 80),
    smtpUser: String(patch.smtpUser ?? current.smtpUser).trim().slice(0, 160),
    smtpFrom: String(patch.smtpFrom ?? current.smtpFrom).trim().slice(0, 160)
  };
  if (!next.businessName) throw validationError('Business name is required.');
  if (!next.timezone || !isValidTimezone(next.timezone)) throw validationError('Choose a valid business timezone.');
  if (next.phone && (!/^[+\d\s().-]+$/.test(next.phone) || next.phone.replace(/\D/g, '').length < 5)) {
    throw validationError('Enter a valid service phone number.');
  }
  if (next.businessEmail && !isEmail(next.businessEmail)) throw validationError('Enter a valid business email address.');
  if (next.smtpUser && !isEmail(next.smtpUser)) throw validationError('Enter a valid SMTP username email address.');
  if (next.smtpFrom && !isEmail(next.smtpFrom)) throw validationError('Enter a valid SMTP sender email address.');

  const smtpPassword = String(patch.smtpPassword || '');
  if (smtpPassword) {
    const secret = String(process.env.SESSION_SECRET || '');
    if (secret.length < 32 || /replace-this|development-only/i.test(secret)) {
      throw validationError('Set a SESSION_SECRET with at least 32 characters before saving an SMTP password.');
    }
    if (smtpPassword.length > 1000) throw validationError('SMTP password is too long.');
    next.smtpPasswordEncrypted = encryptPassword(smtpPassword);
  } else if (current.smtpPasswordEncrypted) {
    next.smtpPasswordEncrypted = current.smtpPasswordEncrypted;
  } else if (current.smtpPassword) {
    next.smtpPasswordEncrypted = encryptPassword(current.smtpPassword);
  }

  const stored = { ...next, smtpPassword: '', settingKey: 'business' };
  if (current._id) return settings.update(String(current._id), stored);
  return settings.insert(stored);
}

export function toPublicBusinessSettings(settings) {
  return {
    businessName: settings.businessName,
    phone: settings.phone,
    serviceEmail: settings.businessEmail,
    timezone: settings.timezone
  };
}

function isValidTimezone(timezone) {
  try {
    new Intl.DateTimeFormat('en', { timeZone: timezone });
    return true;
  } catch {
    return false;
  }
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function encryptPassword(password) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', settingsKey, iv);
  const encrypted = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv.toString('base64'), cipher.getAuthTag().toString('base64'), encrypted.toString('base64')].join('.');
}

function decryptPassword(value) {
  const [iv, authTag, encrypted] = String(value).split('.');
  if (!iv || !authTag || !encrypted) throw new Error('Stored SMTP password has an invalid encrypted format.');
  const decipher = createDecipheriv('aes-256-gcm', settingsKey, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, 'base64')), decipher.final()]).toString('utf8');
}

function validationError(message) {
  const error = new Error(message);
  error.status = 400;
  return error;
}
