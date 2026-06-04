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

const urlCache  = new Map();
const CACHE_TTL = 50 * 60 * 1000;

function isShortLivedToken(videoUrl) {
  return /indavideo\.hu/i.test(videoUrl);
}

function getDirectUrl(videoUrl) {
  return new Promise((resolve, reject) => {
    const cached = urlCache.get(videoUrl);
    if (cached && !isShortLivedToken(videoUrl) && Date.now() - cached.ts < CACHE_TTL) {
      console.log('[cache] visszaadva:', cached.directUrl.substring(0, 80) + '...');
      return resolve(cached.directUrl);
    }
    const cmd = `${ytdlp} --no-playlist -f "b" --get-url "${videoUrl}"`;
    console.log('[yt-dlp] futtatás:', cmd);
    exec(cmd, { timeout: 30000 }, (err, stdout, stderr) => {
      if (err || !stdout.trim()) {
        console.error('[yt-dlp] hiba:', stderr);
        return reject(stderr || err?.message || 'yt-dlp hiba');
      }
      const directUrl = stdout.trim().split('\n')[0].trim();
      console.log('[yt-dlp] kinyert URL:', directUrl.substring(0, 100) + '...');
      urlCache.set(videoUrl, { directUrl, ts: Date.now() });
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

function proxyStream(req, res, directUrl, videoUrl, retries = 10) {
  const rangeHeader = req.headers['range'] || 'bytes=0-';
  console.log('[proxy] → Range:', rangeHeader, '| url:', directUrl.substring(0, 80));

  fetchWithRedirects(directUrl, rangeHeader)
    .then(({ res: proxyRes }) => {
      if (proxyRes.statusCode === 403 || proxyRes.statusCode === 401) {
        proxyRes.resume();
        // Ha van videoUrl és még van próbálkozás, kérj új tokent
        if (videoUrl && retries > 0) {
          console.log(`[proxy] 403 — új token kérése (még ${retries} próba)...`);
          urlCache.delete(videoUrl);
          getDirectUrl(videoUrl)
            .then(newUrl => proxyStream(req, res, newUrl, videoUrl, retries - 1))
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

  if (url.pathname === '/api/resolve') {
    const videoUrl = url.searchParams.get('url');
    if (!videoUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Hiányzó url' }));
    }
    try {
      await getDirectUrl(videoUrl);
      const proxyUrl = `/api/stream?url=${encodeURIComponent(videoUrl)}`;
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ proxyUrl }));
    } catch (e) {
      console.error('[resolve] hiba:', e);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String(e) }));
    }
    return;
  }

  if (url.pathname === '/api/stream') {
    const videoUrl = url.searchParams.get('url');
    if (!videoUrl) { res.writeHead(400); return res.end('Hiányzó url'); }
    try {
      const directUrl = await getDirectUrl(videoUrl);
      proxyStream(req, res, directUrl, videoUrl);
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