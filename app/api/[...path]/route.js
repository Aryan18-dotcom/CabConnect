import { handleApiRequest } from '../../../src/server/api-handler.js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function handle(request) {
  return handleApiRequest(request, '/api');
}

export const GET = handle;
export const POST = handle;
export const PUT = handle;
export const PATCH = handle;
export const DELETE = handle;
