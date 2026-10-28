import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = path.join(ROOT, 'data', 'artic-artworks.json');
const API = 'https://api.artic.edu/api/v1/artworks/search';
const FIELDS = [
  'id', 'title', 'artist_title', 'date_display', 'image_id', 'is_public_domain',
  'short_description', 'medium_display', 'place_of_origin', 'web_url', 'description',
  'style_title', 'classification_title', 'term_titles', 'credit_line'
];
const ARTISTS = [
  'Sandro Botticelli', 'Michelangelo', 'Caravaggio', 'Artemisia Gentileschi',
  'Sarah Goodridge', 'Anna Lea Merritt', 'Amedeo Modigliani', 'Jesús Helguera'
];
const TOPICS = [
  'Renaissance painting', 'Baroque painting', 'Impressionism painting', 'portrait painting',
  'still life painting', 'landscape painting', 'religious painting', 'modern art',
  'mythology painting', 'sculpture'
];
const MIN_DELAY_MS = 1050;
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const normalize = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();

async function readPrevious() {
  try {
    const parsed = JSON.parse(await fs.readFile(OUTPUT, 'utf8'));
    return parsed && Array.isArray(parsed.works) ? parsed : null;
  } catch {
    return null;
  }
}

function makeUrl(payload) {
  const url = new URL(API);
  url.searchParams.set('params', JSON.stringify(payload));
  return url;
}

async function fetchRecords(payload, label) {
  const url = makeUrl(payload);
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'AIC-User-Agent': 'Atelier-GitHub-Pages (static gallery; automated weekly public-data sync)'
        },
        signal: AbortSignal.timeout(25000)
      });
      const text = await response.text();
      let json;
      try { json = JSON.parse(text); } catch { throw new Error(`HTTP ${response.status}: response was not JSON`); }
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${json?.error || json?.errors?.[0]?.message || response.statusText}`);
      if (!Array.isArray(json.data)) throw new Error('API response did not contain a data array');
      return json.data.filter(item => item && item.id != null && item.image_id && item.is_public_domain === true);
    } catch (error) {
      lastError = error;
      if (attempt < 3) await sleep(1000 * attempt);
    }
  }
  throw new Error(`${label}: ${lastError?.message || lastError}`);
}

function publicDomainImageFilter() {
  return {
    bool: {
      must: [
        { term: { is_public_domain: true } },
        { exists: { field: 'image_id' } }
      ]
    }
  };
}

async function main() {
  await fs.mkdir(path.dirname(OUTPUT), { recursive: true });
  const previous = await readPrevious();
  const collected = new Map();
  const failures = [];
  let successfulQueries = 0;
  let queryCounter = 0;

  async function runQuery(label, payload, artistFallback = null) {
    if (queryCounter > 0) await sleep(MIN_DELAY_MS);
    queryCounter += 1;
    try {
      let rows = await fetchRecords(payload, label);
      if (!rows.length && artistFallback) {
        // Some agents have alternate display names; do a broader API query but keep only
        // records whose credited artist matches the requested name, never loose-name cousins.
        if (queryCounter > 0) await sleep(MIN_DELAY_MS);
        queryCounter += 1;
        const broadPayload = {
          q: artistFallback,
          query: publicDomainImageFilter(),
          limit: 40,
          fields: FIELDS
        };
        const broadRows = await fetchRecords(broadPayload, `${label} fallback`);
        const wanted = normalize(artistFallback);
        rows = broadRows.filter(row => {
          const got = normalize(row.artist_title);
          return got === wanted || (wanted === 'michelangelo' && got.startsWith('michelangelo '));
        });
      }
      successfulQueries += 1;
      for (const row of rows) collected.set(String(row.id), row);
      console.log(`[AIC sync] ${label}: ${rows.length} public-domain works with images`);
    } catch (error) {
      failures.push(error.message);
      console.warn(`[AIC sync] skipped ${label}: ${error.message}`);
    }
  }

  for (const artist of ARTISTS) {
    await runQuery(`artist:${artist}`, {
      query: {
        bool: {
          must: [
            { term: { 'artist_title.keyword': artist } },
            { term: { is_public_domain: true } },
            { exists: { field: 'image_id' } }
          ]
        }
      },
      limit: 40,
      fields: FIELDS
    }, artist);
  }

  for (const topic of TOPICS) {
    await runQuery(`topic:${topic}`, {
      q: topic,
      query: publicDomainImageFilter(),
      limit: 30,
      fields: FIELDS
    });
  }

  const fresh = [...collected.values()];
  if (previous?.works?.length) {
    for (const old of previous.works) {
      if (!collected.has(String(old.id))) collected.set(String(old.id), old);
    }
  }
  const works = [...collected.values()].slice(0, 1200);
  const now = new Date().toISOString();
  const output = {
    schemaVersion: 1,
    source: 'Art Institute of Chicago API',
    sourceUrl: 'https://api.artic.edu/docs/',
    generatedAt: fresh.length ? now : (previous?.generatedAt || null),
    lastAttemptAt: now,
    lastSyncStatus: failures.length ? (fresh.length ? 'partial' : 'failed-preserved-cache') : (fresh.length ? 'ok' : (previous?.works?.length ? 'failed-preserved-cache' : 'empty')),
    successfulQueries,
    attemptedQueries: queryCounter,
    totalWorks: works.length,
    note: 'Static snapshot produced by GitHub Actions. Only public-domain works with image IDs are included. The browser searches this snapshot; it does not proxy live queries.',
    warnings: failures.slice(0, 25),
    works
  };

  await fs.writeFile(OUTPUT, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
  console.log(`[AIC sync] wrote ${works.length} works to ${path.relative(ROOT, OUTPUT)}; status=${output.lastSyncStatus}; successful queries=${successfulQueries}/${queryCounter}`);
  if (!fresh.length && !previous?.works?.length) {
    console.warn('[AIC sync] The API did not return any usable data. The site will still deploy and use the Commons fallback until the next successful sync.');
  }
}

main().catch(error => {
  console.error('[AIC sync] fatal error:', error);
  process.exitCode = 1;
});
