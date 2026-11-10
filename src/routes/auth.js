import argon2 from 'argon2';
import { collection } from '../db/index.js';
import { requireAuth } from '../middleware/auth.js';
import { createRouter } from '../server/router.js';

const router = createRouter();
router.post('/login', async (req, res, next) => {
  try {
    const username = String(req.body.username || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!username || !password) return res.status(400).json({ error: 'Username and password are required.' });
    const user = await collection('users').findOne({ username, active: true });
    if (!user || !(await argon2.verify(user.passwordHash, password))) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }
    const sessionId = globalThis.crypto.randomUUID();
    req.session.user = {
      id: String(user._id), username: user.username, displayName: user.displayName,
      role: user.role, mustChangePassword: user.mustChangePassword
    };
    req.sessionId = sessionId;
    await collection('sessions').insert({
      _id: sessionId,
      user: req.session.user,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
    });
    res.cookie('cabconnect.sid', sessionId, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1',
      maxAge: 7 * 24 * 60 * 60 * 1000
    });
    res.json({ user: req.session.user });
  } catch (e) { next(e); }
});
router.get('/me', requireAuth, (req, res) => res.json({ user: req.session.user }));
router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const current = String(req.body.currentPassword || '');
    const password = String(req.body.newPassword || '');
    if (password.length < 12) return res.status(400).json({ error: 'New password must be at least 12 characters.' });
    const user = await collection('users').findOne({ username: req.session.user.username });
    if (!user || !(await argon2.verify(user.passwordHash, current))) return res.status(400).json({ error: 'Current password is incorrect.' });
    await collection('users').update(String(user._id), {
      passwordHash: await argon2.hash(password), mustChangePassword: false
    });
    req.session.user.mustChangePassword = false;
    if (req.sessionId) {
      await collection('sessions').update(req.sessionId, { user: req.session.user });
    }
    res.json({ message: 'Password updated successfully.' });
  } catch (e) { next(e); }
});
router.post('/logout', async (req, res, next) => {
  try {
    if (req.sessionId) await collection('sessions').remove(req.sessionId);
    res.clearCookie('cabconnect.sid', { secure: process.env.NODE_ENV === 'production' || process.env.VERCEL === '1' });
    res.json({ message: 'Logged out.' });
  } catch (error) { next(error); }
});
export default router;
