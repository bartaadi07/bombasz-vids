//node script.js "https://videa.hu/player?v=d5OOor9NDgsG1pTi"
//node script.js "https://vkvideo.ru/video-234646183_456239019"

const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');

const url = process.argv[2];

if (!url) {
  console.error('Adj meg egy URL-t! Pl: node script.js "https://..."');
  process.exit(1);
}

const ytdlpPath = path.join(__dirname, 'yt-dlp.exe');
const ytdlp = fs.existsSync(ytdlpPath) ? `"${ytdlpPath}"` : 'yt-dlp';

const cmd = `${ytdlp} -f "bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/best" --get-url "${url}"`;

console.log('Kinyerés folyamatban...');

exec(cmd, { timeout: 30000 }, (error, stdout, stderr) => {
  if (error || !stdout.trim()) {
    console.error('Hiba:', stderr || error?.message);
    process.exit(1);
  }

  const lines = stdout.trim().split('\n').map(l => l.trim()).filter(Boolean);
  const directUrl = lines[0];

  console.log('\n✓ Direkt link:\n');
  console.log(directUrl);
  console.log('\n--- Másold be az src attribútumba ---');
});
