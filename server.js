const http = require('http');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SECRET_KEY;
const PORT = process.env.PORT || 3000;

// Helper para llamar Supabase
async function supabase(method, table, body, query) {
  const url = `${SUPABASE_URL}/rest/v1/${table}${query||''}`;
  const res = await fetch(url, {
    method: method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method==='POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Supabase error: ${err}`);
  }
  return res.status === 204 ? [] : res.json();
}

// Parsear body de request
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', chunk => data += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(data || '{}')); }
      catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// Parsear query string
function parseQuery(url) {
  const q = {};
  const idx = url.indexOf('?');
  if (idx < 0) return q;
  url.slice(idx+1).split('&').forEach(p => {
    const [k,v] = p.split('=');
    if(k) q[decodeURIComponent(k)] = decodeURIComponent(v||'');
  });
  return q;
}

const server = http.createServer(async (req, res) => {
  const urlPath = req.url.split('?')[0];
  const query = parseQuery(req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  try {
    // ── GET /api/registros?area=tejido ──
    if (req.method === 'GET' && urlPath === '/api/registros') {
      const area = query.area;
      const q = area ? `?area=eq.${area}&order=creado_en.desc&limit=200` : '?order=creado_en.desc&limit=200';
      const data = await supabase('GET', 'registros', null, q);
      res.writeHead(200);
      res.end(JSON.stringify(data));
      return;
    }

    // ── POST /api/registros ──
    if (req.method === 'POST' && urlPath === '/api/registros') {
      const body = await parseBody(req);
      const data = await supabase('POST', 'registros', body);
      res.writeHead(201);
      res.end(JSON.stringify(data));
      return;
    }

    // ── DELETE /api/registros?id=123 ──
    if (req.method === 'DELETE' && urlPath === '/api/registros') {
      const id = query.id;
      await supabase('DELETE', 'registros', null, `?id=eq.${id}`);
      res.writeHead(204); res.end(); return;
    }

    // ── GET /api/pedidos ──
    if (req.method === 'GET' && urlPath === '/api/pedidos') {
      const data = await supabase('GET', 'pedidos', null, '?order=creado_en.desc');
      res.writeHead(200); res.end(JSON.stringify(data)); return;
    }

    // ── POST /api/pedidos ──
    if (req.method === 'POST' && urlPath === '/api/pedidos') {
      const body = await parseBody(req);
      const data = await supabase('POST', 'pedidos', body);
      res.writeHead(201); res.end(JSON.stringify(data)); return;
    }

    // ── POST /api/pedidos/update ──
    if (req.method === 'POST' && urlPath === '/api/pedidos/update') {
      const body = await parseBody(req);
      const { id, ...rest } = body;
      await supabase('PATCH', 'pedidos', rest, `?id=eq.${id}`);
      res.writeHead(200); res.end('{}'); return;
    }

    // ── DELETE /api/pedidos?id=123 ──
    if (req.method === 'DELETE' && urlPath === '/api/pedidos') {
      await supabase('DELETE', 'pedidos', null, `?id=eq.${query.id}`);
      res.writeHead(204); res.end(); return;
    }

    // ── GET /api/casaazul ──
    if (req.method === 'GET' && urlPath === '/api/casaazul') {
      const data = await supabase('GET', 'casaazul', null, '?order=creado_en.desc');
      res.writeHead(200); res.end(JSON.stringify(data)); return;
    }

    // ── POST /api/casaazul ──
    if (req.method === 'POST' && urlPath === '/api/casaazul') {
      const body = await parseBody(req);
      const data = await supabase('POST', 'casaazul', body);
      res.writeHead(201); res.end(JSON.stringify(data)); return;
    }

    // ── DELETE /api/casaazul?id=123 ──
    if (req.method === 'DELETE' && urlPath === '/api/casaazul') {
      await supabase('DELETE', 'casaazul', null, `?id=eq.${query.id}`);
      res.writeHead(204); res.end(); return;
    }

    // ── GET /api/config?clave=nomina ──
    if (req.method === 'GET' && urlPath === '/api/config') {
      const data = await supabase('GET', 'configuracion', null, `?clave=eq.${query.clave}`);
      res.writeHead(200); res.end(JSON.stringify(data[0]||{})); return;
    }

    // ── POST /api/config ──
    if (req.method === 'POST' && urlPath === '/api/config') {
      const body = await parseBody(req);
      // Upsert
      await supabase('DELETE', 'configuracion', null, `?clave=eq.${body.clave}`);
      const data = await supabase('POST', 'configuracion', body);
      res.writeHead(200); res.end(JSON.stringify(data)); return;
    }

    // ── Servir el HTML ──
    if (req.method === 'GET') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      const html = fs.readFileSync(path.join(__dirname, 'index.html'));
      res.writeHead(200); res.end(html); return;
    }

    res.writeHead(404); res.end('Not found');

  } catch(e) {
    console.error(e);
    res.writeHead(500); res.end(JSON.stringify({ error: e.message }));
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Cristiana corriendo en puerto ${PORT}`);
});
