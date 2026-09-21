const http = require('http');
const https = require('https');
const jwt = require('jsonwebtoken');

function postJSON(url, body, cookie) {
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
  return new Promise((resolve, reject) => {
    const req = agent.request(opts, (res) => {
      let chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        try {
          const json = JSON.parse(raw);
          resolve({ status: res.statusCode, json });
        } catch (e) {
          reject(new Error(`Invalid JSON from ${url}: ${raw.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

function assert(cond, message, failures) {
  if (!cond) failures.push(message);
}

function hasHomogeneousSourceType(resp, expected) {
  if (!resp.sources) return true;
  if (expected === 'MIXED') {
    const hasCC = resp.sources.some((s) => (s.sourceType || null) === 'CC');
    const hasCPC = resp.sources.some((s) => (s.sourceType || null) === 'CPC');
    return hasCC && hasCPC;
  }
  return resp.sources.every((s) => (s.sourceType || null) === expected);
}

function titleFirstIsArticle(resp, num) {
  if (!resp.sources || resp.sources.length === 0) return false;
  const t = resp.sources[0].title || '';
  const re = new RegExp(`^Artículo ${num}(\\s|$)`);
  return re.test(t);
}

function noNearbyNumberContamination(resp, num) {
  if (!resp.sources) return true;
  const bad = new RegExp(`^Artículo ${num}\\d`);
  return resp.sources.every((s) => !bad.test(s.title || ''));
}

function extractArticleNumbersFromText(text) {
  const nums = new Set();
  const re = /art[íi]?culo\s+(\d+)/gi;
  let m;
  while ((m = re.exec(String(text || ''))) !== null) {
    nums.add(m[1]);
  }
  return Array.from(nums);
}

function extractArticleNumbersFromSources(resp) {
  const nums = new Set();
  (resp.sources || []).forEach((s) => {
    const m = String(s.title || '').match(/Artículo\s+(\d+)/i);
    if (m && m[1]) nums.add(m[1]);
  });
  return Array.from(nums);
}

async function runTest(label, mode, query, expectations, base, cookie) {
  const failures = [];
  const body = { query, ...mode, topK: 5 };
  if (expectations.integral === true) body.integral = true;
  const { json } = await postJSON(`${base}/api/rag/answer`, body, cookie);

  if (expectations.expectedSourceType !== null) {
    assert(
      hasHomogeneousSourceType(json, expectations.expectedSourceType),
      `${label}: sources sourceType not homogeneous ${expectations.expectedSourceType}`,
      failures
    );
  }
  if (expectations.usedVector !== undefined) {
    assert(json.usedVector === expectations.usedVector, `${label}: usedVector expected ${expectations.usedVector} got ${json.usedVector}`, failures);
  }
  if (expectations.exactPartial !== undefined) {
    assert(json.exactPartial === expectations.exactPartial, `${label}: exactPartial expected ${expectations.exactPartial} got ${json.exactPartial}`, failures);
  }
  if (expectations.fallbackWide !== undefined) {
    assert(json.fallbackWide === expectations.fallbackWide, `${label}: fallbackWide expected ${expectations.fallbackWide} got ${json.fallbackWide}`, failures);
  }
  if (expectations.articleNumber != null && expectations.articleFirst === true) {
    assert(titleFirstIsArticle(json, expectations.articleNumber), `${label}: first source is not Artículo ${expectations.articleNumber}`, failures);
    assert(noNearbyNumberContamination(json, expectations.articleNumber), `${label}: contamination with nearby numbers for ${expectations.articleNumber}`, failures);
  }
  if (expectations.notFound === true) {
    assert(
      typeof json.answer === 'string' && json.answer.includes('Artículo no encontrado'),
      `${label}: expected not found message`,
      failures
    );
    assert(Array.isArray(json.sources) && json.sources.length === 0, `${label}: expected no sources on not found`, failures);
  }
  if (expectations.answerCitationsWithinSources === true) {
    const ansNums = extractArticleNumbersFromText(json.answer || '');
    const srcNums = new Set(extractArticleNumbersFromSources(json));
    const bad = ansNums.filter((n) => !srcNums.has(n));
    assert(bad.length === 0, `${label}: answer cited articles not present in sources: ${bad.join(', ')}`, failures);
  }
  if (Array.isArray(expectations.mustIncludeStrings)) {
    const txt = String(json.answer || '');
    for (const m of expectations.mustIncludeStrings) {
      assert(txt.includes(m), `${label}: answer missing required string: ${m}`, failures);
    }
  }

  return { label, ok: failures.length === 0, failures, response: json };
}

async function main() {
  const base = process.env.BASE_URL || 'http://localhost:3000';
  const secret = process.env.JWT_SECRET || 'dev-secret-change';
  // Use seeded test user to satisfy ChatLog FK
  const token = jwt.sign({ uid: 'matrix-user', role: 'ABOGADO', name: 'Matrix', email: 'matrix@example.com' }, secret, { expiresIn: '1d' });
  const cookie = `abogados_token=${token}`;

  const CPC = { matter: 'CIVIL', submatter: 'Procesal/Adjetivo', jurisdiccion: 'ESTATAL' };
  const CC = { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' };

  const tests = [
    // Puros numéricos
    { label: 'CPC: Artículo 60', mode: CPC, query: 'Artículo 60', exp: { expectedSourceType: 'CPC', usedVector: false, exactPartial: false, fallbackWide: false, articleNumber: 60, articleFirst: true } },
    { label: 'CC: Artículo 287', mode: CC, query: 'Artículo 287', exp: { expectedSourceType: 'CC', usedVector: false, exactPartial: false, fallbackWide: false, articleNumber: 287, articleFirst: true } },
    { label: 'CPC: Artículo 1', mode: CPC, query: 'Artículo 1', exp: { expectedSourceType: 'CPC', usedVector: false, exactPartial: false, fallbackWide: false, articleNumber: 1, articleFirst: true } },
    // CC Artículo 1 puede no existir en base: validar no encontrado si aplica
    { label: 'CC: Artículo 1', mode: CC, query: 'Artículo 1', exp: { expectedSourceType: 'CC', usedVector: false, exactPartial: false, fallbackWide: false } },
    // Inexistentes
    { label: 'CPC: Artículo 9999', mode: CPC, query: 'Artículo 9999', exp: { expectedSourceType: 'CPC', usedVector: false, exactPartial: false, fallbackWide: false, notFound: true } },
    { label: 'CC: Artículo 9999', mode: CC, query: 'Artículo 9999', exp: { expectedSourceType: 'CC', usedVector: false, exactPartial: false, fallbackWide: false, notFound: true } },

    // Mixtas con artículo
    { label: 'CPC: ¿Qué dice el artículo 60 sobre plazos?', mode: CPC, query: '¿Qué dice el artículo 60 sobre plazos?', exp: { expectedSourceType: 'CPC', usedVector: true, exactPartial: true, fallbackWide: false, articleNumber: 60, articleFirst: true } },
    { label: 'CC: ¿Qué establece el artículo 322?', mode: CC, query: '¿Qué establece el artículo 322?', exp: { expectedSourceType: 'CC', usedVector: true, exactPartial: true, fallbackWide: false, articleNumber: 322, articleFirst: true } },

    // Temáticas puras
    { label: 'CPC: Requisitos de la demanda', mode: CPC, query: 'Requisitos de la demanda', exp: { expectedSourceType: 'CPC', usedVector: true, exactPartial: false, fallbackWide: false } },
    { label: 'CPC: Plazo para contestar demanda', mode: CPC, query: 'Plazo para contestar demanda', exp: { expectedSourceType: 'CPC', usedVector: true, exactPartial: false, fallbackWide: false } },
    { label: 'CC: Efectos del divorcio', mode: CC, query: 'Efectos del divorcio', exp: { expectedSourceType: 'CC', usedVector: true, exactPartial: false, fallbackWide: false } },
    { label: 'CC: Requisitos para contraer matrimonio', mode: CC, query: 'Requisitos para contraer matrimonio', exp: { expectedSourceType: 'CC', usedVector: true, exactPartial: false, fallbackWide: false } },

    // Estabilidad semántica larga (CPC)
    {
      label: 'CPC: Estabilidad semántica larga',
      mode: CPC,
      query: 'Explícame detalladamente los requisitos procesales de la demanda conforme al Código de Procedimientos Civiles del Estado de Guanajuato y menciona artículos aplicables.',
      exp: {
        expectedSourceType: 'CPC',
        usedVector: true,
        exactPartial: false,
        fallbackWide: false,
        answerCitationsWithinSources: true
      }
    },

    // Modo integral
    {
      label: 'Integral: abandono de hogar',
      mode: { matter: 'CIVIL', submatter: 'Sustantivo', jurisdiccion: 'ESTATAL' },
      query: 'Cliente demanda a pareja por abandono de hogar, ¿qué procede?',
      exp: {
        expectedSourceType: 'MIXED',
        usedVector: true,
        exactPartial: false,
        fallbackWide: false,
        integral: true,
        mustIncludeStrings: ['Fondo (Sustantivo):', 'Forma (Procesal):']
      }
    },

    // Pruebas cruzadas
    { label: 'CPC: Divorcio (no cruzar CC)', mode: CPC, query: 'Divorcio', exp: { expectedSourceType: 'CPC', usedVector: true, exactPartial: false, fallbackWide: false } },
    { label: 'CC: Demanda (no cruzar CPC)', mode: CC, query: 'Demanda', exp: { expectedSourceType: 'CC', usedVector: true, exactPartial: false, fallbackWide: false } }
  ];

  let failuresTotal = 0;
  for (const t of tests) {
    try {
      const r = await runTest(t.label, t.mode, t.query, t.exp, base, cookie);
      if (!r.ok) {
        failuresTotal += r.failures.length;
        console.error(`✗ ${t.label}`);
        r.failures.forEach((f) => console.error(`  - ${f}`));
      } else {
        console.log(`✓ ${t.label}`);
      }
    } catch (e) {
      failuresTotal++;
      console.error(`✗ ${t.label}: ${e.message}`);
    }
  }
  if (failuresTotal > 0) {
    console.error(`Failures: ${failuresTotal}`);
    process.exit(1);
  } else {
    console.log('All regression checks passed.');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
