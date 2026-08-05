const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = (process.env.SUPABASE_URL || '').trim();
const SUPABASE_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();

console.log('SUPABASE_URL:', SUPABASE_URL ? 'OK' : 'FALTA');
console.log('SUPABASE_KEY:', SUPABASE_KEY ? 'OK' : 'FALTA');

async function sbFetch(method, table, body, qs) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase no configurado');
  const url = `${SUPABASE_URL}/rest/v1/${table}${qs||''}`;
  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Prefer': method === 'POST' ? 'return=representation' : ''
    },
    body: body ? JSON.stringify(body) : undefined
  });
  if (!res.ok) throw new Error(await res.text());
  return res.status === 204 ? [] : res.json();
}

function body(req) {
  return new Promise((ok, fail) => {
    let d = '';
    req.on('data', c => d += c);
    req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } });
    req.on('error', fail);
  });
}

function qs(url) {
  const q = {}, i = url.indexOf('?');
  if (i < 0) return q;
  url.slice(i+1).split('&').forEach(p => {
    const [k,v] = p.split('=');
    if (k) q[decodeURIComponent(k)] = decodeURIComponent(v||'');
  });
  return q;
}

http.createServer(async (req, res) => {
  const p = req.url.split('?')[0];
  const q = qs(req.url);

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  // Servir HTML para cualquier ruta que no sea /api
  if (!p.startsWith('/api')) {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    try {
      res.writeHead(200);
      res.end(fs.readFileSync(path.join(__dirname, 'index.html')));
    } catch(e) { res.writeHead(500); res.end('Error'); }
    return;
  }

  res.setHeader('Content-Type', 'application/json');

  try {
    // REGISTROS
    if (p === '/api/registros') {
      if (req.method === 'GET') {
        let qs2 = '?order=creado_en.desc&limit=2000';
        if (q.area) qs2 += `&area=eq.${q.area}`;
        if (q.desde) qs2 += `&fecha=gte.${q.desde}`;
        if (q.hasta) qs2 += `&fecha=lte.${q.hasta}`;
        const d = await sbFetch('GET', 'registros', null, qs2);
        res.writeHead(200); res.end(JSON.stringify(d)); return;
      }
      if (req.method === 'POST') {
        const b = await body(req);
        const d = await sbFetch('POST', 'registros', b);
        res.writeHead(201); res.end(JSON.stringify(d)); return;
      }
      if (req.method === 'DELETE') {
        await sbFetch('DELETE', 'registros', null, `?id=eq.${q.id}`);
        res.writeHead(204); res.end(); return;
      }
    }

    // PEDIDOS
    if (p === '/api/pedidos') {
      if (req.method === 'GET') {
        const d = await sbFetch('GET', 'pedidos', null, '?order=creado_en.desc&limit=200');
        res.writeHead(200); res.end(JSON.stringify(d)); return;
      }
      if (req.method === 'POST') {
        const b = await body(req);
        const d = await sbFetch('POST', 'pedidos', b);
        res.writeHead(201); res.end(JSON.stringify(d)); return;
      }
      if (req.method === 'DELETE') {
        await sbFetch('DELETE', 'pedidos', null, `?id=eq.${q.id}`);
        res.writeHead(204); res.end(); return;
      }
    }

    // CASA AZUL
    if (p === '/api/casaazul') {
      if (req.method === 'GET') {
        const d = await sbFetch('GET', 'casaazul', null, '?order=creado_en.desc&limit=200');
        res.writeHead(200); res.end(JSON.stringify(d)); return;
      }
      if (req.method === 'POST') {
        const b = await body(req);
        const d = await sbFetch('POST', 'casaazul', b);
        res.writeHead(201); res.end(JSON.stringify(d)); return;
      }
      if (req.method === 'DELETE') {
        await sbFetch('DELETE', 'casaazul', null, `?id=eq.${q.id}`);
        res.writeHead(204); res.end(); return;
      }
    }

    // CONFIG
    if (p === '/api/config') {
      if (req.method === 'GET') {
        const d = await sbFetch('GET', 'configuracion', null, `?clave=eq.${q.clave}`);
        res.writeHead(200); res.end(JSON.stringify(d[0]||{})); return;
      }
      if (req.method === 'POST') {
        const b = await body(req);
        await sbFetch('DELETE', 'configuracion', null, `?clave=eq.${b.clave}`);
        const d = await sbFetch('POST', 'configuracion', b);
        res.writeHead(200); res.end(JSON.stringify(d)); return;
      }
    }

    res.writeHead(404); res.end(JSON.stringify({error:'Not found'}));

  } catch(e) {
    console.error('Error:', e.message);
    res.writeHead(500); res.end(JSON.stringify({error: e.message}));
  }

}).listen(PORT, '0.0.0.0', () => console.log(`Puerto ${PORT}`));
