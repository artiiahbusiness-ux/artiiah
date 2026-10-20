// functions/api/data.js — Cloudflare Pages Function (auto-routes to /api/data)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Artiiah-Key',
  'Cache-Control': 'no-store',
};

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS });
  }

  if (env.ARTIIAH_API_KEY) {
    const provided = request.headers.get('X-Artiiah-Key');
    if (provided !== env.ARTIIAH_API_KEY) {
      return json({ error: 'Unauthorized' }, 401);
    }
  }

  if (!env.ARTIIAH_KV) {
    return json({ error: 'KV binding ARTIIAH_KV not configured' }, 500);
  }

  const KEY = 'artiiah-db';
  const META = 'artiiah-db:meta';

  try {
    if (request.method === 'GET') {
      const data = await env.ARTIIAH_KV.get(KEY);
      const meta = await env.ARTIIAH_KV.get(META);
      return json({
        ok: true,
        data: data ? JSON.parse(data) : null,
        meta: meta ? JSON.parse(meta) : null,
      });
    }

    if (request.method === 'POST') {
      let body;
      try { body = await request.json(); } catch (e) {
        return json({ error: 'Invalid JSON' }, 400);
      }
      if (!body || typeof body !== 'object') {
        return json({ error: 'Empty body' }, 400);
      }
      const str = JSON.stringify(body);
      if (str.length > 24 * 1024 * 1024) {
        return json({ error: 'Too large (max 24MB)' }, 413);
      }
      await env.ARTIIAH_KV.put(KEY, str);
      await env.ARTIIAH_KV.put(META, JSON.stringify({
        pushedAt: new Date().toISOString(),
        size: str.length,
      }));
      return json({ ok: true, size: str.length });
    }

    if (request.method === 'DELETE') {
      await env.ARTIIAH_KV.delete(KEY);
      await env.ARTIIAH_KV.delete(META);
      return json({ ok: true });
    }

    return json({ error: 'Method not allowed' }, 405);
  } catch (e) {
    return json({ error: e.message || 'Unknown error' }, 500);
  }
}

function json(obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}