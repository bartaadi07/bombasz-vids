// setup-ytdlp.js — Render build lépésben fut, letölti a Linux yt-dlp binárist
const https = require('https');
const fs    = require('fs');
const path  = require('path');

const DEST = path.join(__dirname, 'yt-dlp');
const URL  = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp';

if (fs.existsSync(DEST)) {
  console.log('[setup] yt-dlp már létezik, kihagyva.');
  process.exit(0);
}

console.log('[setup] yt-dlp letöltése...');

function download(url, dest, redirects = 5) {
  if (redirects <= 0) { console.error('Túl sok redirect'); process.exit(1); }
  https.get(url, { headers: { 'User-Agent': 'setup-ytdlp/1.0' } }, (res) => {
    if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
      console.log('[setup] redirect →', res.headers.location);
      return download(res.headers.location, dest, redirects - 1);
    }
    if (res.statusCode !== 200) {
      console.error('[setup] HTTP hiba:', res.statusCode);
      process.exit(1);
    }
    const file = fs.createWriteStream(dest);
    res.pipe(file);
    file.on('finish', () => {
      file.close();
      fs.chmodSync(dest, 0o755);
      console.log('[setup] yt-dlp letöltve és futtathatóvá téve.');
    });
  }).on('error', (e) => {
    console.error('[setup] Hiba:', e.message);
    process.exit(1);
  });
}

download(URL, DEST);
