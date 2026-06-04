const http   = require('http');
const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const { exec, execSync } = require('child_process');

const PORT = process.env.PORT || 3000;

const MIME = {
  '.html': 'text/html',
  '.css':  'text/css',
  '.js':   'application/javascript',
  '.srt':  'text/plain',
  '.vtt':  'text/vtt',
  '.jpg':  'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png':  'image/png',
};

function findYtdlp() {
  const localLinux   = path.join(__dirname, 'yt-dlp');
  const localWindows = path.join(__dirname, 'yt-dlp.exe');
  if (fs.existsSync(localLinux))   return `"${localLinux}"`;
  if (fs.existsSync(localWindows)) return `"${localWindows}"`;
  try { execSync('yt-dlp --version', { stdio: 'ignore' }); return 'yt-dlp'; } catch {}
  return null;
}

const ytdlp = findYtdlp();
if (!ytdlp) {
  console.error('[HIBA] yt-dlp nem található!');
  process.exit(1);
}
console.log('[init] yt-dlp:', ytdlp);

const formatsCache = new Map();
const urlCache     = new Map();
const CACHE_TTL    = 50 * 60 * 1000;

// ─── HTTP helper ────────────────────────────────────────────────────
function fetchHtml(pageUrl, extraHeaders, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 5;
  if (!extraHeaders) extraHeaders = {};
  return new Promise((resolve, reject) => {
    function doGet(currentUrl, remaining) {
      if (remaining <= 0) return reject(new Error('Túl sok redirect: ' + currentUrl));
      let parsed;
      try { parsed = new URL(currentUrl.startsWith('http') ? currentUrl : 'https://' + currentUrl); }
      catch (e) { return reject(e); }
      const mod  = parsed.protocol === 'https:' ? https : http;
      const opts = {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers: Object.assign({
          'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
          'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'hu-HU,hu;q=0.9',
          'Referer':         'https://indavideo.hu/',
        }, extraHeaders),
      };
      let body = '';
      const req = mod.request(opts, (res) => {
        const loc = res.headers.location;
        if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) && loc) {
          res.resume();
          const next = loc.startsWith('http') ? loc : new URL(loc, currentUrl).href;
          return doGet(next, remaining - 1);
        }
        res.setEncoding('utf8');
        res.on('data', chunk => body += chunk);
        res.on('end', () => resolve({ html: body, finalUrl: currentUrl, status: res.statusCode }));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => { req.destroy(); reject(new Error('Timeout: ' + currentUrl)); });
      req.end();
    }
    doGet(pageUrl, maxRedirects);
  });
}

// ─── Indavideo: JSON API → ÖSSZES minőség ───────────────────────────
// Az indavideo Next.js frontend ezt az API-t hívja, nem geo-korlátozott tokennél
function resolveIndavideoViaApi(slug) {
  return new Promise(async (resolve, reject) => {
    // Az indavideo belső API végpontjai (próbáljuk sorban)
    const endpoints = [
      `https://indavideo.hu/api/video/${slug}`,
      `https://indavideo.hu/_next/data/latest/video/${slug}.json`,
    ];

    for (const endpoint of endpoints) {
      try {
        console.log('[indavideo-api] próbálom:', endpoint);
        const { html, status } = await fetchHtml(endpoint, {
          'Accept': 'application/json, */*',
          'X-Requested-With': 'XMLHttpRequest',
        });

        if (status !== 200) continue;

        let data;
        try { data = JSON.parse(html); } catch { continue; }

        // Keressük a video URL-eket a különböző lehetséges struktúrákban
        const streams = extractUrlsFromApiResponse(data);
        if (streams && streams.length > 0) {
          console.log('[indavideo-api] siker:', endpoint, '→', streams.length, 'stream');
          return resolve(streams);
        }
      } catch (e) {
        console.log('[indavideo-api] hiba:', endpoint, e.message);
      }
    }

    resolve(null); // egyik sem sikerült
  });
}

function extractUrlsFromApiResponse(data) {
  const streams = [];

  function scanObj(obj) {
    if (!obj || typeof obj !== 'object') return;

    // video_urls vagy videoUrls tömb
    for (const key of ['video_urls', 'videoUrls', 'video_files', 'videoFiles', 'urls', 'files']) {
      if (Array.isArray(obj[key])) {
        obj[key].forEach(item => {
          const url = typeof item === 'string' ? item : (item.url || item.src || item.file || item.video_url);
          if (url && typeof url === 'string' && url.startsWith('http') && (url.includes('.mp4') || url.includes('video'))) {
            if (!streams.find(s => s.url === url)) {
              streams.push({ url, height: guessHeight(url) });
            }
          }
        });
      }
    }

    // Rekurzív scan
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object') scanObj(v);
    }
  }

  scanObj(data);
  return streams.length > 0 ? streams.sort((a, b) => b.height - a.height) : null;
}

function guessHeight(url) {
  const m = url.match(/[_\-\/](\d{3,4})[_\-\.]?(?:p|\.mp4)/i);
  if (m) return parseInt(m[1]);
  if (/\b720\b/.test(url)) return 720;
  if (/\b1080\b/.test(url)) return 1080;
  if (/\b480\b/.test(url)) return 480;
  if (/\b360\b/.test(url)) return 360;
  if (url.includes('hd')) return 720;
  if (url.includes('sd')) return 360;
  return 0;
}

// ─── Indavideo: embed HTML parse → stream URL-ek ────────────────────
function resolveIndavideoFromEmbed(embedUrl) {
  return fetchHtml(embedUrl, {
    'Referer': 'https://indavideo.hu/',
    'Origin':  'https://indavideo.hu',
  }).then(({ html }) => {
    const streams = [];

    // __NEXT_DATA__ JSON (modern Next.js oldal)
    const nextDataMatch = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (nextDataMatch) {
      try {
        const nd = JSON.parse(nextDataMatch[1]);
        const fromNext = extractUrlsFromApiResponse(nd);
        if (fromNext) fromNext.forEach(s => { if (!streams.find(x => x.url === s.url)) streams.push(s); });
      } catch(e) {}
    }

    // window.PLAYER_FLASH_PARAMS (régi player)
    const flashMatch = html.match(/PLAYER_FLASH_PARAMS\s*=\s*(\{[\s\S]*?\});/);
    if (flashMatch) {
      try {
        const fp = JSON.parse(flashMatch[1]);
        const fromFlash = extractUrlsFromApiResponse(fp);
        if (fromFlash) fromFlash.forEach(s => { if (!streams.find(x => x.url === s.url)) streams.push(s); });
      } catch(e) {}
    }

    // videoUrls tömb direkt regex (ha a JSON nem parse-olható)
    const urlsMatch = html.match(/"videoUrls"\s*:\s*(\[[^\]]+\])/);
    if (urlsMatch) {
      try {
        JSON.parse(urlsMatch[1]).forEach(u => {
          if (u && u.startsWith('http') && !streams.find(s => s.url === u))
            streams.push({ url: u, height: guessHeight(u) });
        });
      } catch(e) {}
    }

    // Nyers mp4 URL-ek keresése CDN domain-eken
    const cdnPatterns = [
      /https?:\/\/[^"'<\s]*\.(?:iinda\.hu|indavideocdn\.hu|cdn\.indavideo\.hu)[^"'<\s]*\.mp4[^"'<\s]*/g,
      /https?:\/\/[^"'<\s]*indavideo[^"'<\s]*\.mp4(?:\?[^"'<\s]*)?/g,
      /https?:\/\/[^"'<\s]*iinda[^"'<\s]*\.mp4(?:\?[^"'<\s]*)?/g,
    ];
    for (const pat of cdnPatterns) {
      const matches = html.matchAll(pat);
      for (const m of matches) {
        const u = m[0].replace(/\\u0026/g, '&').replace(/\\/g, '');
        if (!streams.find(s => s.url === u))
          streams.push({ url: u, height: guessHeight(u) });
      }
    }

    console.log('[indavideo-embed] talált stream-ek:', streams.length,
      streams.map(s => `${s.height}p: ${s.url.substring(0, 60)}`));

    return streams.length > 0 ? streams.sort((a, b) => b.height - a.height) : null;
  });
}

// ─── Indavideo: fő belépési pont ────────────────────────────────────
async function resolveIndavideoStreams(pageUrl) {
  // Kinyerjük a slug-ot és a hex ID-t
  const slugMatch  = pageUrl.match(/indavideo\.hu\/video\/([^/?#]+)/);
  const hexMatch   = pageUrl.match(/(?:embed\.indavideo\.hu\/player\/video\/)([a-f0-9]{6,})/);
  const slug       = slugMatch ? slugMatch[1] : null;
  const hexId      = hexMatch  ? hexMatch[1]  : null;

  // 1. Próbálkozás: az indavideo JSON API-ja (slug alapján)
  if (slug) {
    try {
      const streams = await resolveIndavideoViaApi(slug);
      if (streams && streams.length > 0) return { streams, source: 'api' };
    } catch(e) {
      console.error('[indavideo] API hiba:', e.message);
    }
  }

  // 2. Próbálkozás: az indavideo oldaláról kinyert embed URL + HTML parse
  let embedUrl = null;
  if (hexId) {
    embedUrl = `https://embed.indavideo.hu/player/video/${hexId}`;
  } else if (slug) {
    // A videó oldaláról kinyerjük a hex ID-t
    try {
      const { html } = await fetchHtml(pageUrl);
      const m = html.match(/embed\.indavideo\.hu\/player\/video\/([a-f0-9]{6,})/);
      if (m) embedUrl = `https://embed.indavideo.hu/player/video/${m[1]}`;
      else if (slug) embedUrl = `https://embed.indavideo.hu/player/video/${slug}`;
    } catch(e) {
      if (slug) embedUrl = `https://embed.indavideo.hu/player/video/${slug}`;
    }
  }

  if (embedUrl) {
    try {
      console.log('[indavideo] embed parse:', embedUrl);
      const streams = await resolveIndavideoFromEmbed(embedUrl);
      if (streams && streams.length > 0) return { streams, source: 'embed', embedUrl };
    } catch(e) {
      console.error('[indavideo] embed hiba:', e.message);
    }
  }

  return { streams: null, embedUrl };
}

// ─── Régi kompatibilitás ────────────────────────────────────────────
function resolveIndavideoEmbedUrl(pageUrl) {
  return new Promise(async (resolve, reject) => {
    try {
      const { html } = await fetchHtml(pageUrl);
      const m = html.match(/embed\.indavideo\.hu\/player\/video\/([a-f0-9]+)/);
      if (m) return resolve(`https://embed.indavideo.hu/player/video/${m[1]}`);
      const slugMatch = pageUrl.match(/indavideo\.hu\/video\/([^/?#]+)/);
      if (slugMatch) return resolve(`https://embed.indavideo.hu/player/video/${slugMatch[1]}`);
      reject(new Error('Nem találtam embed URL-t: ' + pageUrl));
    } catch(e) { reject(e); }
  });
}

// ─── getFormats ──────────────────────────────────────────────────────
function getFormats(videoUrl) {
  return new Promise(async (resolve, reject) => {
    const cached = formatsCache.get(videoUrl);
    // Indavideo-nál soha ne cache-eljük (token rövid életű), másoknál igen
    if (cached && !/indavideo\.hu/i.test(videoUrl) && Date.now() - cached.ts < CACHE_TTL) {
      return resolve(cached.formats);
    }

    if (/indavideo\.hu/i.test(videoUrl)) {
      try {
        const { streams, source } = await resolveIndavideoStreams(videoUrl);
        if (streams && streams.length > 0) {
          console.log('[indavideo] getFormats forrás:', source, '→', streams.map(s => s.height + 'p').join(', '));
          const qualities = streams.map(s => ({
            height:    s.height,
            label:     s.height ? s.height + 'p' : 'Legjobb',
            directUrl: s.url,
          }));
          const result = { qualities, maxHeight: qualities[0].height, indavideoStreams: streams };
          formatsCache.set(videoUrl, { formats: result, ts: Date.now() });
          return resolve(result);
        }
        console.warn('[indavideo] direkt kinyerés sikertelen, yt-dlp fallback');
      } catch(e) {
        console.error('[indavideo] getFormats hiba:', e.message);
      }
    }

    // yt-dlp fallback (nem indavideo, vagy ha a direkt kinyerés sikertelen)
    let ytdlpUrl = videoUrl;
    if (/indavideo\.hu\/video\//i.test(videoUrl)) {
      try { ytdlpUrl = await resolveIndavideoEmbedUrl(videoUrl); }
      catch(e) { return reject(e); }
    }

    const cmd = `${ytdlp} --no-playlist -J "${ytdlpUrl}"`;
    console.log('[yt-dlp] formats:', cmd);
    exec(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err || !stdout.trim()) return reject(new Error(stderr || err?.message || 'yt-dlp hiba'));
      try {
        const info = JSON.parse(stdout);
        const fmts = info.formats || [];
        const seen = new Set();
        const qualities = [];
        fmts.filter(f => f.height > 0 && f.vcodec && f.vcodec !== 'none')
            .sort((a, b) => b.height - a.height)
            .forEach(f => {
              if (!seen.has(f.height)) { seen.add(f.height); qualities.push({ height: f.height, label: f.height + 'p', formatId: f.format_id }); }
            });
        if (qualities.length === 0) {
          fmts.filter(f => f.height > 0).sort((a, b) => b.height - a.height)
              .forEach(f => { if (!seen.has(f.height)) { seen.add(f.height); qualities.push({ height: f.height, label: f.height + 'p', formatId: f.format_id }); } });
        }
        if (qualities.length === 0) qualities.push({ height: 0, label: 'Legjobb', formatId: 'best' });
        qualities.sort((a, b) => b.height - a.height);
        const result = { qualities, maxHeight: qualities[0].height, resolvedUrl: ytdlpUrl };
        formatsCache.set(videoUrl, { formats: result, ts: Date.now() });
        resolve(result);
      } catch(e) { reject(new Error('JSON parse hiba: ' + e.message)); }
    });
  });
}

// ─── getDirectUrl ────────────────────────────────────────────────────
function getDirectUrl(videoUrl, quality) {
  return new Promise(async (resolve, reject) => {
    const cacheKey = videoUrl + '::' + (quality || 'best');
    const cached = urlCache.get(cacheKey);
    if (cached && !/indavideo\.hu/i.test(videoUrl) && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[cache] visszaadva');
      return resolve(cached.directUrl);
    }

    if (/indavideo\.hu/i.test(videoUrl)) {
      // Próbáljuk a formats cache-ből
      const fmtCached = formatsCache.get(videoUrl);
      if (fmtCached && fmtCached.formats && fmtCached.formats.indavideoStreams) {
        const chosen = pickStream(fmtCached.formats.indavideoStreams, quality);
        if (chosen) {
          console.log('[indavideo] cache-ből:', chosen.height + 'p');
          urlCache.set(cacheKey, { directUrl: chosen.url, ts: Date.now() });
          return resolve(chosen.url);
        }
      }

      // Frissen kinyerjük
      try {
        const { streams } = await resolveIndavideoStreams(videoUrl);
        if (streams && streams.length > 0) {
          const chosen = pickStream(streams, quality);
          if (chosen) {
            console.log('[indavideo] frissen kinyerve:', chosen.height + 'p');
            urlCache.set(cacheKey, { directUrl: chosen.url, ts: Date.now() });
            return resolve(chosen.url);
          }
        }
      } catch(e) {
        console.error('[indavideo] getDirectUrl hiba:', e.message);
      }
    }

    // yt-dlp fallback
    let ytdlpUrl = videoUrl;
    if (/indavideo\.hu\/video\//i.test(videoUrl)) {
      try { ytdlpUrl = await resolveIndavideoEmbedUrl(videoUrl); }
      catch(e) { return reject(e); }
    }

    let fmtSelector = 'bestvideo+bestaudio/best';
    if (quality && quality !== 'best') {
      const h = parseInt(quality);
      if (!isNaN(h)) fmtSelector = `bestvideo[height=${h}]+bestaudio/best[height=${h}]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
    }

    const cmd = `${ytdlp} --no-playlist -f "${fmtSelector}" --get-url "${ytdlpUrl}"`;
    console.log('[yt-dlp] futtatás:', cmd);
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (!stdout.trim()) return reject(stderr || err?.message || 'yt-dlp hiba');
      const directUrl = stdout.trim().split('\n')[0].trim();
      console.log('[yt-dlp] kinyert URL:', directUrl.substring(0, 100));
      urlCache.set(cacheKey, { directUrl, ts: Date.now() });
      resolve(directUrl);
    });
  });
}

function pickStream(streams, quality) {
  if (!streams || streams.length === 0) return null;
  if (!quality || quality === 'best') return streams[0];
  const h = parseInt(quality);
  if (isNaN(h)) return streams[0];
  return streams.find(s => s.height === h)
      || streams.filter(s => s.height <= h).sort((a, b) => b.height - a.height)[0]
      || streams[0];
}

// ─── Proxy stream ────────────────────────────────────────────────────
function fetchWithRedirects(urlStr, rangeHeader, maxRedirects) {
  if (maxRedirects === undefined) maxRedirects = 5;
  return new Promise((resolve, reject) => {
    function doRequest(currentUrl, remaining) {
      if (remaining <= 0) return reject(new Error('Túl sok redirect'));
      const parsed = new URL(currentUrl);
      const mod    = parsed.protocol === 'https:' ? https : http;
      const opts   = {
        hostname: parsed.hostname,
        path:     parsed.pathname + parsed.search,
        method:   'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
          'Range':      rangeHeader,
          'Accept':     'video/mp4,video/*,*/*',
          'Referer':    `https://${parsed.hostname}/`,
        },
      };
      const r = mod.request(opts, (res) => {
        const s = res.statusCode;
        console.log('[proxy] ←', s, '| ct:', res.headers['content-type'], '| url:', currentUrl.substring(0, 80));
        if ((s === 301 || s === 302 || s === 307 || s === 308) && res.headers['location']) {
          res.resume();
          return doRequest(new URL(res.headers['location'], currentUrl).href, remaining - 1);
        }
        resolve({ res, finalUrl: currentUrl });
      });
      r.on('error', reject);
      r.end();
    }
    doRequest(urlStr, maxRedirects);
  });
}

function proxyStream(req, res, directUrl, videoUrl, quality, retries) {
  if (retries === undefined) retries = 10;
  const rangeHeader = req.headers['range'] || 'bytes=0-';
  console.log('[proxy] → Range:', rangeHeader, '| url:', directUrl.substring(0, 80));

  fetchWithRedirects(directUrl, rangeHeader)
    .then(({ res: proxyRes }) => {
      if (proxyRes.statusCode === 403 || proxyRes.statusCode === 401) {
        proxyRes.resume();
        if (videoUrl && retries > 0) {
          const cacheKey = videoUrl + '::' + (quality || 'best');
          urlCache.delete(cacheKey);
          formatsCache.delete(videoUrl); // indavideo-nál a tokent is törüljük
          console.log(`[proxy] 403 — újra kinyerés (még ${retries} próba)...`);
          getDirectUrl(videoUrl, quality)
            .then(newUrl => proxyStream(req, res, newUrl, videoUrl, quality, retries - 1))
            .catch(e => { if (!res.headersSent) { res.writeHead(502); res.end('Proxy hiba: ' + e.message); } });
          return;
        }
        if (!res.headersSent) { res.writeHead(403); res.end('403'); }
        return;
      }

      const upstreamCT  = proxyRes.headers['content-type'] || '';
      const contentType = (upstreamCT.startsWith('video') || upstreamCT.includes('octet-stream')) ? upstreamCT : 'video/mp4';
      const headers = {
        'Content-Type': contentType, 'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*', 'Cache-Control': 'no-store',
      };
      if (proxyRes.headers['content-length']) headers['Content-Length'] = proxyRes.headers['content-length'];
      if (proxyRes.headers['content-range'])  headers['Content-Range']  = proxyRes.headers['content-range'];

      if (req.headers['range'] && proxyRes.statusCode === 200 && !headers['Content-Range'] && headers['Content-Length']) {
        const total = parseInt(headers['Content-Length']);
        const rm    = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rm) {
          const start = parseInt(rm[1]);
          const end   = rm[2] ? parseInt(rm[2]) : total - 1;
          headers['Content-Range']  = `bytes ${start}-${end}/${total}`;
          headers['Content-Length'] = String(end - start + 1);
        }
      }

      res.writeHead(proxyRes.statusCode === 206 ? 206 : (req.headers['range'] ? 206 : 200), headers);
      proxyRes.pipe(res);
    })
    .catch(e => { if (!res.headersSent) { res.writeHead(502); res.end('Proxy hiba: ' + e.message); } });
}

// ─── HTTP szerver ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // ── DEBUG: mit lát a szerver az indavideo oldalán ─────────────────
  // Hívd meg: /api/debug?url=http://indavideo.hu/video/n3m_j4t3k_s_1
  if (url.pathname === '/api/debug') {
    const videoUrl = url.searchParams.get('url');
    if (!videoUrl) { res.writeHead(400); return res.end('Hiányzó url'); }
    try {
      // Kinyerjük amit tudunk
      const { streams, source } = await resolveIndavideoStreams(videoUrl);

      // Raw embed HTML is kellhet
      const slugMatch = videoUrl.match(/indavideo\.hu\/video\/([^/?#]+)/);
      let rawSnippet  = '(nem sikerült betölteni)';
      if (slugMatch) {
        try {
          const { html } = await fetchHtml(`https://embed.indavideo.hu/player/video/${slugMatch[1]}`, {
            'Referer': 'https://indavideo.hu/', 'Origin': 'https://indavideo.hu',
          });
          // Csak a releváns részeket adjuk vissza (ne adjuk vissza az egész HTML-t)
          const relevantLines = html.split('\n').filter(l =>
            /videoUrl|video_url|mp4|iinda|indavideo.*cdn|PLAYER|__NEXT/i.test(l)
          ).slice(0, 50);
          rawSnippet = relevantLines.join('\n') || '(nincs mp4/videoUrl sor az embed HTML-ben)';
        } catch(e) { rawSnippet = 'embed fetch hiba: ' + e.message; }
      }

      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        inputUrl: videoUrl,
        source,
        streams,
        rawEmbedSnippet: rawSnippet,
      }, null, 2));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message, stack: e.stack }));
    }
    return;
  }

  if (url.pathname === '/api/formats') {
    const videoUrl = url.searchParams.get('url');
    if (!videoUrl) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Hiányzó url' })); }
    try {
      const result = await getFormats(videoUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  if (url.pathname === '/api/resolve') {
    const videoUrl = url.searchParams.get('url');
    const quality  = url.searchParams.get('quality') || null;
    if (!videoUrl) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'Hiányzó url' })); }
    try {
      await getDirectUrl(videoUrl, quality);
      const qParam   = quality ? `&quality=${encodeURIComponent(quality)}` : '';
      const proxyUrl = `/api/stream?url=${encodeURIComponent(videoUrl)}${qParam}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ proxyUrl }));
    } catch(e) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  if (url.pathname === '/api/stream') {
    const videoUrl = url.searchParams.get('url');
    const quality  = url.searchParams.get('quality') || null;
    if (!videoUrl) { res.writeHead(400); return res.end('Hiányzó url'); }
    try {
      const directUrl = await getDirectUrl(videoUrl, quality);
      proxyStream(req, res, directUrl, videoUrl, quality);
    } catch(e) {
      res.writeHead(500); res.end(String(e));
    }
    return;
  }

  const filePath = path.join(__dirname, url.pathname === '/' ? 'index.html' : url.pathname);
  const ext      = path.extname(filePath);
  const mimeType = MIME[ext] || 'application/octet-stream';
  fs.readFile(filePath, (err, data) => {
    if (err) { res.writeHead(404); return res.end('Not found'); }
    res.writeHead(200, { 'Content-Type': mimeType });
    res.end(data);
  });
});

server.listen(PORT, () => {
  console.log(`[init] Szerver fut: http://localhost:${PORT}`);
});
