import { randomBytes } from 'node:crypto';
import { collection, connectDatabase, seedUsers } from '../db/index.js';
import apiRouter from '../routes/api.js';
import authRouter from '../routes/auth.js';
import { JsonResponse } from './router.js';

const SESSION_COOKIE = 'cabconnect.sid';
let initialized;

async function initialize() {
  if (!initialized) {
    initialized = (async () => {
      if ((process.env.NODE_ENV === 'production' || process.env.VERCEL === '1') &&
          (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32 || /replace-this|development-only/i.test(process.env.SESSION_SECRET))) {
        throw new Error('Set a unique SESSION_SECRET with at least 32 characters for production.');
      }
      await connectDatabase();
      await seedUsers();
    })();
  }
  await initialized;
}

function getCookie(request, name) {
  const cookies = request.headers.get('cookie') || '';
  for (const item of cookies.split(';')) {
    const [key, ...value] = item.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

async function loadSession(request) {
  const id = getCookie(request, SESSION_COOKIE);
  if (!id) return { id: '', user: null };
  const session = await collection('sessions').findOne({ _id: id });
  if (!session) return { id: '', user: null };
  if (!session.expiresAt || session.expiresAt <= new Date().toISOString()) {
    await collection('sessions').remove(id);
    return { id: '', user: null };
  }
  return { id, user: session.user || null };
}

async function parseBody(request) {
  if (['GET', 'HEAD'].includes(request.method)) return {};
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON.'), { status: 400 });
  }
}

function routePath(pathname, prefix) {
  const path = pathname.slice(prefix.length);
  return path || '/';
}

export async function handleApiRequest(request, prefix = '/api') {
  try {
    await initialize();
    const url = new URL(request.url);
    if (url.pathname === '/api/health' && request.method === 'GET') {
      return Response.json({
        ok: true,
        mode: process.env.NODE_ENV === 'development' && process.env.VERCEL !== '1' ? 'sqlite' : 'mongodb',
        time: new Date().toISOString()
      });
    }
    const body = await parseBody(request);
    const session = await loadSession(request);
    const response = new JsonResponse();
    const path = routePath(url.pathname, prefix);
    const req = {
      method: request.method.toUpperCase(),
      path,
      params: {},
      query: Object.fromEntries(url.searchParams.entries()),
      body,
      headers: request.headers,
      session,
      sessionId: session.id,
      ip: request.headers.get('x-forwarded-for') || '',
      get(name) { return request.headers.get(name); }
    };
    const isAuthRoute = path.startsWith('/auth/');
    const handled = isAuthRoute
      ? await authRouter.dispatch({ ...req, path: routePath(path, '/auth') }, response)
      : await apiRouter.dispatch(req, response);

    if (!handled) return Response.json({ error: 'API route not found.' }, { status: 404 });
    if (!response.body) response.body = {};
    return Response.json(response.body, { status: response.statusCode, headers: response.headers });
  } catch (error) {
    console.error('Next.js API request failed:', error);
    return Response.json(
      { error: error.status ? error.message : 'Internal server error' },
      { status: error.status || 500 }
    );
  }
}
