const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');

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
  const fs = require('fs');
  const outDir = process.env.OUT_DIR || 'scripts/matrix_outputs';
  try { fs.rmSync(outDir, { recursive: true, force: true }); } catch {}
  fs.mkdirSync(outDir, { recursive: true });
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const secret = process.env.JWT_SECRET || 'dev-secret-change';
  const token = jwt.sign({ uid: 'matrix-user', role: 'ABOGADO', name: 'Matrix', email: 'matrix@example.com' }, secret, { expiresIn: '1d' });
  const cookie = `abogados_token=${token}`;

  const tests = [
    { label: 'CPC: Artículo 60', body: { query: 'Artículo 60', matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CPC: Demanda', body: { query: 'Demanda', matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CC: Artículo 287', body: { query: 'Artículo 287', matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CC: Divorcio', body: { query: 'Divorcio', matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CPC: Artículo 1', body: { query: 'Artículo 1', matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CC: Artículo 1', body: { query: 'Artículo 1', matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CPC: Artículo 9999', body: { query: 'Artículo 9999', matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL', topK: 5 } },
    { label: 'CC: Artículo 9999', body: { query: 'Artículo 9999', matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL', topK: 5 } }
  ];

  for (const t of tests) {
    const res = await postJSON(`${base}/api/rag/answer`, t.body, cookie);
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
