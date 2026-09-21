const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');
const fs = require('fs');

async function postJSON(url, body, cookie) {
  const u = new URL(url);
  const isHttps = u.protocol === 'https:';
  const data = Buffer.from(JSON.stringify(body), 'utf8');
  const opts = {
    method: 'POST',
    hostname: u.hostname,
    port: u.port ? Number(u.port) : (isHttps ? 443 : 80),
    path: u.pathname + (u.search || ''),
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    },
    timeout: 60000
  };
  if (cookie) opts.headers['Cookie'] = cookie;
  const agent = isHttps ? https : http;
  return await new Promise((resolve, reject) => {
    const req = agent.request(opts, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ status: res.statusCode, body: raw });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const secret = process.env.JWT_SECRET || 'dev-secret-change';
  const token = jwt.sign({ uid: 'matrix-user', role: 'ABOGADO', name: 'Matrix', email: 'matrix@example.com' }, secret, { expiresIn: '1d' });
  const cookie = `abogados_token=${token}`;

  const outDir = 'scripts/matrix_outputs_mixed';
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(outDir, { recursive: true });

  const tests = [
    // CPC mode
    { label: 'CPC: ¿Qué dice el artículo 60 sobre plazos?', mode: { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' }, query: '¿Qué dice el artículo 60 sobre plazos?' },
    { label: 'CPC: Explica el artículo 1', mode: { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' }, query: 'Explica el artículo 1' },
    { label: 'CPC: Plazo para contestar demanda', mode: { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' }, query: 'Plazo para contestar demanda' },
    { label: 'CPC: Requisitos de la demanda', mode: { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' }, query: 'Requisitos de la demanda' },
    // CC mode
    { label: 'CC: Explica el artículo 287', mode: { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' }, query: 'Explica el artículo 287' },
    { label: 'CC: Efectos del divorcio', mode: { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' }, query: 'Efectos del divorcio' },
    { label: 'CC: Requisitos para contraer matrimonio', mode: { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' }, query: 'Requisitos para contraer matrimonio' },
    { label: 'CC: ¿Qué establece el artículo 322?', mode: { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' }, query: '¿Qué establece el artículo 322?' },
    // No-cruce
    { label: 'CPC: Divorcio', mode: { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' }, query: 'Divorcio' },
    { label: 'CC: Demanda', mode: { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' }, query: 'Demanda' }
  ];

  for (const t of tests) {
    const body = { query: t.query, ...t.mode, topK: 5 };
    const res = await postJSON(`${base}/api/rag/answer`, body, cookie);
    const obj = { label: t.label, response: JSON.parse(res.body) };
    const slug = t.label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const filePath = `${outDir}/${slug}.json`;
    fs.writeFileSync(filePath, JSON.stringify(obj, null, 2), 'utf8');
    console.log(`Wrote ${filePath}`);
  }
  console.log(`Outputs in ${outDir}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
