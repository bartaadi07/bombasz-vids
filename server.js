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
  console.error('[HIBA] yt-dlp nem található! Futtasd előbb: node setup-ytdlp.js');
  process.exit(1);
}
console.log('[init] yt-dlp:', ytdlp);

// Cache: videoUrl -> { formats, ts }
const formatsCache = new Map();
// Cache: videoUrl+quality -> { directUrl, ts }
const urlCache     = new Map();
const CACHE_TTL    = 50 * 60 * 1000;

function isShortLivedToken(videoUrl) {
  return /indavideo\.hu/i.test(videoUrl);
}

function resolveIndavideoEmbedUrl(pageUrl) {
  return new Promise((resolve, reject) => {
    const parsed = new URL(pageUrl.startsWith('http') ? pageUrl : 'https://' + pageUrl);
    const mod = parsed.protocol === 'https:' ? https : http;
    const opts = {
      hostname: parsed.hostname,
      path:     parsed.pathname + parsed.search,
      method:   'GET',
      headers: {
        'User-Agent':      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',
        'Accept':          'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'hu-HU,hu;q=0.9',
      },
    };
    let html = '';
    const req = mod.request(opts, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) && res.headers.location) {
        res.resume();
        return resolveIndavideoEmbedUrl(res.headers.location).then(resolve).catch(reject);
      }
      res.setEncoding('utf8');
      res.on('data', chunk => html += chunk);
      res.on('end', () => {
        const patterns = [
          /embed\.indavideo\.hu\/player\/video\/([a-f0-9]+)/,
          /indavideo\.hu\/player\/video\/([a-f0-9]+)/,
          /"video_id"\s*:\s*"([a-f0-9]+)"/,
          /player\.indavideo\.hu[^"']*[?&]v(?:ID|id)=([a-f0-9]+)/,
        ];
        for (const pat of patterns) {
          const m = html.match(pat);
          if (m) {
            const embedUrl = `https://embed.indavideo.hu/player/video/${m[1]}`;
            console.log('[indavideo] embed URL kinyerve:', embedUrl);
            return resolve(embedUrl);
          }
        }
        reject(new Error('Nem találtam embed URL-t az oldalon: ' + pageUrl));
      });
    });
    req.on('error', reject);
    req.setTimeout(10000, () => { req.destroy(); reject(new Error('Timeout az oldal betöltésekor')); });
    req.end();
  });
}

// Felbontás → sorrend szám (magasabb = jobb)
function heightScore(h) { return h || 0; }

// Elérhető formátumok lekérése és feldolgozása
function getFormats(videoUrl) {
  return new Promise(async (resolve, reject) => {
    const cached = formatsCache.get(videoUrl);
    if (cached && !isShortLivedToken(videoUrl) && Date.now() - cached.ts < CACHE_TTL) {
      return resolve(cached.formats);
    }

    let ytdlpUrl = videoUrl;
    if (/indavideo\.hu\/video\//i.test(videoUrl)) {
      try { ytdlpUrl = await resolveIndavideoEmbedUrl(videoUrl); }
      catch (e) { return reject(e); }
    }

    // -J: JSON dump, ebből kinyerjük a formátumokat
    const cmd = `${ytdlp} --no-playlist -J "${ytdlpUrl}"`;
    console.log('[formats] futtatás:', cmd);
    exec(cmd, { timeout: 30000, maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err || !stdout.trim()) {
        console.error('[formats] hiba:', stderr);
        return reject(new Error(stderr || err?.message || 'yt-dlp hiba'));
      }
      try {
        const info = JSON.parse(stdout);
        const fmts = info.formats || [];

        // Gyűjtsük össze az elérhető video felbontásokat
        const seen = new Set();
        const qualities = [];

        // Keressük a legjobb mp4/video-only + audio kombinációkat
        fmts
          .filter(f => f.height && f.height > 0 && (f.vcodec && f.vcodec !== 'none'))
          .sort((a, b) => b.height - a.height)
          .forEach(f => {
            if (!seen.has(f.height)) {
              seen.add(f.height);
              qualities.push({
                height: f.height,
                label: f.height + 'p',
                formatId: f.format_id,
              });
            }
          });

        // Ha nincs külön video track, próbáljuk a combined formátumokat
        if (qualities.length === 0) {
          fmts
            .filter(f => f.height && f.height > 0)
            .sort((a, b) => b.height - a.height)
            .forEach(f => {
              if (!seen.has(f.height)) {
                seen.add(f.height);
                qualities.push({
                  height: f.height,
                  label: f.height + 'p',
                  formatId: f.format_id,
                });
              }
            });
        }

        if (qualities.length === 0) {
          // Fallback: csak 1 "legjobb" opció
          qualities.push({ height: 0, label: 'Legjobb', formatId: 'best' });
        }

        // Rendezzük csökkenő sorrendbe (legmagasabb elöl)
        qualities.sort((a, b) => b.height - a.height);

        const result = {
          qualities,
          maxHeight: qualities[0].height,
          resolvedUrl: ytdlpUrl,
        };

        formatsCache.set(videoUrl, { formats: result, ts: Date.now() });
        resolve(result);
      } catch (e) {
        reject(new Error('JSON parse hiba: ' + e.message));
      }
    });
  });
}

// Direkt URL lekérése adott minőségnél
function getDirectUrl(videoUrl, quality) {
  return new Promise(async (resolve, reject) => {
    const cacheKey = videoUrl + '::' + (quality || 'best');
    const cached = urlCache.get(cacheKey);
    if (cached && !isShortLivedToken(videoUrl) && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[cache] visszaadva:', cached.directUrl.substring(0, 80) + '...');
      return resolve(cached.directUrl);
    }

    let ytdlpUrl = videoUrl;
    if (/indavideo\.hu\/video\//i.test(videoUrl)) {
      try { ytdlpUrl = await resolveIndavideoEmbedUrl(videoUrl); }
      catch (e) { return reject(e); }
    }

    // Formátum selector: ha van konkrét height, kérjük azt vagy alatta a legjobbat
    let fmtSelector;
    if (quality && quality !== 'best') {
      const h = parseInt(quality);
      if (!isNaN(h)) {
        // Legjobbat kérjük ezen a felbontáson (video+audio merge, vagy combined)
        fmtSelector = `bestvideo[height=${h}]+bestaudio/best[height=${h}]/bestvideo[height<=${h}]+bestaudio/best[height<=${h}]/best`;
      } else {
        fmtSelector = 'best';
      }
    } else {
      fmtSelector = 'bestvideo+bestaudio/best';
    }

    const cmd = `${ytdlp} --no-playlist -f "${fmtSelector}" --get-url "${ytdlpUrl}"`;
    console.log('[yt-dlp] futtatás:', cmd);
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (!stdout.trim()) {
        console.error('[yt-dlp] hiba:', stderr);
        return reject(stderr || err?.message || 'yt-dlp hiba');
      }
      // Ha 2 sor jön (video + audio külön), az első sort adjuk vissza
      const directUrl = stdout.trim().split('\n')[0].trim();
      console.log('[yt-dlp] kinyert URL:', directUrl.substring(0, 100) + '...');
      urlCache.set(cacheKey, { directUrl, ts: Date.now() });
      resolve(directUrl);
    });
  });
}

function fetchWithRedirects(urlStr, rangeHeader, maxRedirects = 5) {
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
          const next = new URL(res.headers['location'], currentUrl).href;
          return doRequest(next, remaining - 1);
        }
        resolve({ res, finalUrl: currentUrl });
      });
      r.on('error', reject);
      r.end();
    }
    doRequest(urlStr, maxRedirects);
  });
}

function proxyStream(req, res, directUrl, videoUrl, quality, retries = 10) {
  const rangeHeader = req.headers['range'] || 'bytes=0-';
  console.log('[proxy] → Range:', rangeHeader, '| url:', directUrl.substring(0, 80));

  fetchWithRedirects(directUrl, rangeHeader)
    .then(({ res: proxyRes }) => {
      if (proxyRes.statusCode === 403 || proxyRes.statusCode === 401) {
        proxyRes.resume();
        if (videoUrl && retries > 0) {
          console.log(`[proxy] 403 — új token kérése (még ${retries} próba)...`);
          // Töröljük a cache-t ennél a quality-nél
          const cacheKey = videoUrl + '::' + (quality || 'best');
          urlCache.delete(cacheKey);
          getDirectUrl(videoUrl, quality)
            .then(newUrl => proxyStream(req, res, newUrl, videoUrl, quality, retries - 1))
            .catch(e => {
              if (!res.headersSent) { res.writeHead(502); res.end('Proxy hiba: ' + e.message); }
            });
          return;
        }
        if (!res.headersSent) {
          res.writeHead(403, { 'Content-Type': 'text/plain' });
          res.end('403 — próbáld újra');
        }
        return;
      }

      const upstreamCT  = proxyRes.headers['content-type'] || '';
      const contentType = (upstreamCT.startsWith('video') || upstreamCT.includes('octet-stream'))
        ? upstreamCT : 'video/mp4';

      const headers = {
        'Content-Type':                contentType,
        'Accept-Ranges':               'bytes',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control':               'no-store',
      };
      if (proxyRes.headers['content-length']) headers['Content-Length'] = proxyRes.headers['content-length'];
      if (proxyRes.headers['content-range'])  headers['Content-Range']  = proxyRes.headers['content-range'];

      if (req.headers['range'] && proxyRes.statusCode === 200 && !headers['Content-Range'] && headers['Content-Length']) {
        const total      = parseInt(headers['Content-Length']);
        const rangeMatch = rangeHeader.match(/bytes=(\d+)-(\d*)/);
        if (rangeMatch) {
          const start = parseInt(rangeMatch[1]);
          const end   = rangeMatch[2] ? parseInt(rangeMatch[2]) : total - 1;
          headers['Content-Range']  = `bytes ${start}-${end}/${total}`;
          headers['Content-Length'] = String(end - start + 1);
        }
      }

      const status = proxyRes.statusCode === 206 ? 206 : (req.headers['range'] ? 206 : 200);
      res.writeHead(status, headers);
      proxyRes.pipe(res);
    })
    .catch((e) => {
      console.error('[proxy] hiba:', e.message);
      if (!res.headersSent) { res.writeHead(502); res.end('Proxy hiba: ' + e.message); }
    });
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    return res.end('OK');
  }

  // ─── ÚJ: /api/formats — elérhető minőségek lekérése ────────────────
  if (url.pathname === '/api/formats') {
    const videoUrl = url.searchParams.get('url');
    if (!videoUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Hiányzó url' }));
    }
    try {
      const result = await getFormats(videoUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(result));
    } catch (e) {
      console.error('[formats] hiba:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  // ─── /api/resolve — quality paraméterrel bővítve ───────────────────
  if (url.pathname === '/api/resolve') {
    const videoUrl = url.searchParams.get('url');
    const quality  = url.searchParams.get('quality') || null; // pl. "1080", "720", "best"
    if (!videoUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Hiányzó url' }));
    }
    try {
      await getDirectUrl(videoUrl, quality);
      const qParam   = quality ? `&quality=${encodeURIComponent(quality)}` : '';
      const proxyUrl = `/api/stream?url=${encodeURIComponent(videoUrl)}${qParam}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ proxyUrl }));
    } catch (e) {
      console.error('[resolve] hiba:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  // ─── /api/stream — quality paraméterrel bővítve ────────────────────
  if (url.pathname === '/api/stream') {
    const videoUrl = url.searchParams.get('url');
    const quality  = url.searchParams.get('quality') || null;
    if (!videoUrl) { res.writeHead(400); return res.end('Hiányzó url'); }
    try {
      const directUrl = await getDirectUrl(videoUrl, quality);
      proxyStream(req, res, directUrl, videoUrl, quality);
    } catch (e) {
      console.error('[stream] hiba:', e);
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
