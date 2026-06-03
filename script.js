let _subtitleOn = false;
let _subtitleInterval = null;
let _currentVideo = null;

let _subBottom = parseInt(localStorage.getItem('sub_bottom') ?? '8');
let _subSize   = parseInt(localStorage.getItem('sub_size')   ?? '100');

async function openPlayer(btn) {
  const videoUrl  = btn.getAttribute('data-url');
  const title     = btn.getAttribute('data-title');
  const card      = btn.closest('.card');
  const trackTpl  = card ? card.querySelector('template.video-tracks') : null;

const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:3000' 
  : 'https://api.bombasz.hu';
  // Modal megnyitás + loading
  document.getElementById('playerModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  const container = document.getElementById('playerContainer');
  container.innerHTML = '<div class="player-loading"><div class="loading-spinner"></div><span>Betöltés…</span></div>';

try {
    const res  = await fetch(API_BASE + '/api/resolve?url=' + encodeURIComponent(videoUrl));
    const data = await res.json();

    if (!data.proxyUrl) throw new Error(data.error || 'Ismeretlen hiba');

    buildVideoPlayer(container, API_BASE + data.proxyUrl, trackTpl);
  } catch (err) {
    container.innerHTML = `<div class="player-loading"><span style="color:#f66">Hiba: ${err.message}</span></div>`;
    console.error('openPlayer hiba:', err);
  }
}

function buildVideoPlayer(container, src, trackTpl) {
  const wrapper = document.createElement('div');
  wrapper.className = 'custom-player';
  wrapper.innerHTML = `
    <video id="mainVideo" src="${src}" playsinline></video>

    <div class="cp-overlay" id="cpOverlay">
      <div class="cp-center-btn" id="cpCenterBtn">
        <svg class="icon-play"  viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>
        <svg class="icon-pause" viewBox="0 0 24 24" style="display:none"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>
      </div>
    </div>

    <div class="cp-controls" id="cpControls">
      <div class="cp-progress-wrap" id="cpProgressWrap">
        <div class="cp-progress-bg"></div>
        <div class="cp-progress-fill" id="cpFill"></div>
        <div class="cp-progress-thumb" id="cpThumb"></div>
      </div>
      <div class="cp-bottom">
        <div class="cp-left">
          <button class="cp-btn" id="cpPlayBtn">
            <svg class="icon-play"  viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>
            <svg class="icon-pause" viewBox="0 0 24 24" style="display:none"><rect x="5" y="3" width="4" height="18"/><rect x="15" y="3" width="4" height="18"/></svg>
          </button>
          <div class="cp-volume-wrap">
            <button class="cp-btn" id="cpMuteBtn">
              <svg class="icon-vol"  viewBox="0 0 24 24"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><path d="M15.54 8.46a5 5 0 010 7.07"/><path d="M19.07 4.93a10 10 0 010 14.14"/></svg>
              <svg class="icon-mute" viewBox="0 0 24 24" style="display:none"><polygon points="11,5 6,9 2,9 2,15 6,15 11,19"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
            </button>
            <input class="cp-volume" id="cpVol" type="range" min="0" max="1" step="0.05" value="1">
          </div>
          <span class="cp-time" id="cpTime">0:00 / 0:00</span>
        </div>
        <div class="cp-right">
          <button class="cp-btn cp-btn-cc" id="cpCC" style="display:none" title="Felirat be/ki">CC</button>
          <button class="cp-btn cp-btn-sub-settings" id="cpSubSettings" style="display:none" title="Felirat beállítások">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>
          </button>
          <button class="cp-btn" id="cpFSBtn" title="Teljes képernyő">
            <svg class="icon-fs-exp" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 00-2 2v3M21 8V5a2 2 0 00-2-2h-3M8 21H5a2 2 0 01-2-2v-3M16 21h3a2 2 0 002-2v-3"/></svg>
            <svg class="icon-fs-col" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display:none"><path d="M8 3v3a2 2 0 01-2 2H3M21 8h-3a2 2 0 01-2-2V3M8 21v-3a2 2 0 00-2-2H3M21 16h-3a2 2 0 00-2 2v3"/></svg>
          </button>
          <button class="cp-btn cp-btn-close" id="cpClose" title="Bezárás">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
      </div>

      <div class="cp-sub-panel" id="cpSubPanel" style="display:none">
        <div class="cp-sub-row">
          <span class="cp-sub-label">Pozíció</span>
          <input class="cp-sub-slider" id="cpSubPos" type="range" min="2" max="50" value="${_subBottom}">
          <span class="cp-sub-val" id="cpSubPosVal">${_subBottom}%</span>
        </div>
        <div class="cp-sub-row">
          <span class="cp-sub-label">Méret</span>
          <input class="cp-sub-slider" id="cpSubSz" type="range" min="50" max="200" value="${_subSize}">
          <span class="cp-sub-val" id="cpSubSzVal">${_subSize}%</span>
        </div>
      </div>
    </div>

    <div class="subtitle-overlay" id="cpSubOverlay"></div>
  `;

  container.appendChild(wrapper);

  const video        = wrapper.querySelector('#mainVideo');
  const overlay      = wrapper.querySelector('#cpOverlay');
  const controls     = wrapper.querySelector('#cpControls');
  const centerBtn    = wrapper.querySelector('#cpCenterBtn');
  const playBtn      = wrapper.querySelector('#cpPlayBtn');
  const muteBtn      = wrapper.querySelector('#cpMuteBtn');
  const volSlider    = wrapper.querySelector('#cpVol');
  const timeEl       = wrapper.querySelector('#cpTime');
  const fill         = wrapper.querySelector('#cpFill');
  const thumb        = wrapper.querySelector('#cpThumb');
  const progressWrap = wrapper.querySelector('#cpProgressWrap');
  const fsBtn        = wrapper.querySelector('#cpFSBtn');
  const closeBtn     = wrapper.querySelector('#cpClose');
  const ccBtn        = wrapper.querySelector('#cpCC');
  const subSettings  = wrapper.querySelector('#cpSubSettings');
  const subPanel     = wrapper.querySelector('#cpSubPanel');
  const subPosSlider = wrapper.querySelector('#cpSubPos');
  const subSzSlider  = wrapper.querySelector('#cpSubSz');
  const subPosVal    = wrapper.querySelector('#cpSubPosVal');
  const subSzVal     = wrapper.querySelector('#cpSubSzVal');
  const subOverlay   = wrapper.querySelector('#cpSubOverlay');

  _currentVideo = video;

  // ── VTT track-ek beillesztése ─────────────────────────────────────────────
  if (trackTpl) {
    trackTpl.content.querySelectorAll('track').forEach(t => video.appendChild(t.cloneNode(true)));
  }

  // ── Felirat pozíció / méret ───────────────────────────────────────────────
  function applySubStyle() {
    subOverlay.style.bottom   = _subBottom + '%';
    subOverlay.style.fontSize = (_subSize / 100 * 1.1) + 'rem';
  }
  applySubStyle();

  subPosSlider.addEventListener('input', () => {
    _subBottom = parseInt(subPosSlider.value);
    subPosVal.textContent = _subBottom + '%';
    applySubStyle();
    localStorage.setItem('sub_bottom', _subBottom);
  });
  subSzSlider.addEventListener('input', () => {
    _subSize = parseInt(subSzSlider.value);
    subSzVal.textContent = _subSize + '%';
    applySubStyle();
    localStorage.setItem('sub_size', _subSize);
  });

  subSettings.addEventListener('click', e => {
    e.stopPropagation();
    const open = subPanel.style.display !== 'none';
    subPanel.style.display = open ? 'none' : 'flex';
    subSettings.classList.toggle('active', !open);
    if (!open) showControls();
  });

  // ── Play / Pause ──────────────────────────────────────────────────────────
  function setPlayIcons(playing) {
    wrapper.querySelectorAll('.icon-play') .forEach(i => i.style.display = playing ? 'none'  : 'block');
    wrapper.querySelectorAll('.icon-pause').forEach(i => i.style.display = playing ? 'block' : 'none');
  }
  function togglePlay() { video.paused ? video.play() : video.pause(); }

  video.addEventListener('play',  () => setPlayIcons(true));
  video.addEventListener('pause', () => setPlayIcons(false));
  video.addEventListener('ended', () => setPlayIcons(false));

  overlay.addEventListener('click', e => {
    if (e.target === overlay || e.target === centerBtn || centerBtn.contains(e.target)) togglePlay();
  });
  playBtn.addEventListener('click', togglePlay);
  closeBtn.addEventListener('click', closePlayer);

  // Hibakezelés — ha nem tudja lejátszani, konzolra írja az okot
  video.addEventListener('error', () => {
    const err = video.error;
    const codes = { 1:'ABORTED', 2:'NETWORK', 3:'DECODE', 4:'SRC_NOT_SUPPORTED' };
    console.error('[video] hiba:', codes[err?.code] || err?.code, err?.message);
  });

  // play() csak akkor ha már van elegendő adat
  video.addEventListener('canplay', () => {
    video.play().catch(e => console.warn('[video] play() elutasítva:', e.message));
  }, { once: true });

  // ── Progress ──────────────────────────────────────────────────────────────
  function fmtTime(s) {
    const totalMin = Math.floor(s / 60);
    const sec      = String(Math.floor(s % 60)).padStart(2, '0');
    if (totalMin >= 60) {
      const h   = Math.floor(totalMin / 60);
      const min = String(totalMin % 60).padStart(2, '0');
      return `${h}:${min}:${sec}`;
    }
    return `${totalMin}:${sec}`;
  }

  const _storageKey = 'playpos_' + encodeURIComponent(src);
  video.addEventListener('loadedmetadata', () => {
    const saved = parseFloat(localStorage.getItem(_storageKey) || '0');
    if (saved > 5 && saved < video.duration - 5) video.currentTime = saved;
  });
  let _saveTimer;
  video.addEventListener('timeupdate', () => {
    clearTimeout(_saveTimer);
    _saveTimer = setTimeout(() => {
      if (video.currentTime > 0) localStorage.setItem(_storageKey, video.currentTime);
    }, 2000);
  });

  video.addEventListener('timeupdate', () => {
    if (!video.duration) return;
    const pct = video.currentTime / video.duration * 100;
    fill.style.width = pct + '%';
    thumb.style.left = pct + '%';
    timeEl.textContent = `${fmtTime(video.currentTime)} / ${fmtTime(video.duration)}`;
  });

  let seeking = false;
  function doSeek(clientX) {
    const rect = progressWrap.getBoundingClientRect();
    const pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    video.currentTime = pct * video.duration;
  }
  progressWrap.addEventListener('mousedown',  e => { seeking = true; doSeek(e.clientX); });
  document.addEventListener('mousemove',      e => { if (seeking) doSeek(e.clientX); });
  document.addEventListener('mouseup',        () => { seeking = false; });
  progressWrap.addEventListener('touchstart', e => { seeking = true; doSeek(e.touches[0].clientX); }, { passive: true });
  document.addEventListener('touchmove',      e => { if (seeking) doSeek(e.touches[0].clientX); }, { passive: true });
  document.addEventListener('touchend',       () => { seeking = false; });

  // ── Hang ──────────────────────────────────────────────────────────────────
  muteBtn.addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('volumechange', () => {
    const muted = video.muted || video.volume === 0;
    muteBtn.querySelector('.icon-vol') .style.display = muted ? 'none'  : 'block';
    muteBtn.querySelector('.icon-mute').style.display = muted ? 'block' : 'none';
    if (!muted) volSlider.value = video.volume;
  });
  volSlider.addEventListener('input', () => { video.volume = parseFloat(volSlider.value); video.muted = false; });

  // ── Controls auto-hide ────────────────────────────────────────────────────
  let hideTimer;
  function showControls() {
    controls.classList.add('visible');
    overlay.classList.add('visible');
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => {
      if (!video.paused && subPanel.style.display === 'none') {
        controls.classList.remove('visible');
        overlay.classList.remove('visible');
      }
    }, 2800);
  }
  wrapper.addEventListener('mousemove',  showControls);
  wrapper.addEventListener('touchstart', showControls, { passive: true });
  video.addEventListener('pause', () => {
    controls.classList.add('visible');
    overlay.classList.add('visible');
    clearTimeout(hideTimer);
  });
  showControls();

  // ── Fullscreen ────────────────────────────────────────────────────────────
  function updateFSIcons(fs) {
    fsBtn.querySelector('.icon-fs-exp').style.display = fs ? 'none'  : 'block';
    fsBtn.querySelector('.icon-fs-col').style.display = fs ? 'block' : 'none';
  }
fsBtn.addEventListener('click', toggleFullscreen);
document.addEventListener('fullscreenchange', () => {
  const fs = !!document.fullscreenElement;
  updateFSIcons(fs);
  document.getElementById('playerModalInner').classList.toggle('fullscreen', fs);
  const so = document.getElementById('cpSubOverlay');
  if (so) {
    if (fs) document.getElementById('playerModalInner').appendChild(so);
    else wrapper.appendChild(so);
  }

  // JAVÍTÁS: Mobil elforgatás kezelése
  if (fs) {
    // Ha teljes képernyőre lépett, elforgatjuk fekvőbe
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('landscape').catch(err => {
        console.warn("A tájolás zárolása nem sikerült (pl. nem mobil vagy nincs HTTPS):", err);
      });
    }
  } else {
    // Ha kilépett, feloldjuk a zárolást, hogy visszaálljon az eredeti állapot
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  }
});

  // ── VTT felirat logika ────────────────────────────────────────────────────
  if (video.textTracks.length > 0) {
    function initSubtitles() {
      const tt = video.textTracks[0];
      if (!tt || !tt.cues) return false;
      tt.mode = 'showing';

      subOverlay.style.fontSize = (_subSize / 100 * 1.1) + 'rem';
      ccBtn.style.display       = 'flex';
      subSettings.style.display = 'flex';
      ccBtn.classList.add('active');
      _subtitleOn = true;

      clearInterval(_subtitleInterval);
      _subtitleInterval = setInterval(() => {
        const t  = video.textTracks[0];
        const so = document.getElementById('cpSubOverlay');
        if (!so || !t || !_subtitleOn) { if (so) so.innerHTML = ''; return; }
        const active = t.activeCues;
        if (active && active.length > 0) {
          const text = active[0].text.replace(/<[^>]+>/g, '');
          so.innerHTML = text
            ? text.split('\n').map(l => `<span>${l}</span>`).join('<br>')
            : '';
        } else {
          so.innerHTML = '';
        }
      }, 100);
      return true;
    }

    const firstTrackEl = video.querySelector('track');
    if (firstTrackEl) {
      firstTrackEl.addEventListener('load',  () => initSubtitles());
      firstTrackEl.addEventListener('error', e => console.warn('VTT hiba:', e));
    }
    video.addEventListener('loadedmetadata', () => {
      if (!initSubtitles()) setTimeout(initSubtitles, 500);
    });

    ccBtn.addEventListener('click', toggleSubtitle);
  }
}

// ── Bezárás ───────────────────────────────────────────────────────────────────
function closePlayer() {
  if (document.fullscreenElement) document.exitFullscreen();
  clearInterval(_subtitleInterval);
  _subtitleInterval = null;
  _currentVideo     = null;
  _subtitleOn       = false;

  document.getElementById('playerContainer').innerHTML = '';
  document.getElementById('playerModal').classList.remove('active');
  document.getElementById('playerModalInner').classList.remove('fullscreen');
  document.body.style.overflow = '';
}

function toggleSubtitle() {
  _subtitleOn = !_subtitleOn;
  const ccBtn = document.getElementById('playerContainer').querySelector('.cp-btn-cc');
  if (ccBtn) ccBtn.classList.toggle('active', _subtitleOn);
  const so = document.getElementById('cpSubOverlay');
  if (!_subtitleOn && so) so.innerHTML = '';
}

function toggleFullscreen() {
  const el = document.getElementById('playerModalInner');
  if (!document.fullscreenElement) el.requestFullscreen().catch(() => {});
  else document.exitFullscreen();
}

// ── Globális eventek ──────────────────────────────────────────────────────────
document.getElementById('playerModal').addEventListener('click', function(e) {
  if (e.target === this) closePlayer();
});

document.addEventListener('keydown', function(e) {
  if (!document.getElementById('playerModal').classList.contains('active')) return;
  const v = _currentVideo;
  if (e.key === 'Escape')           { closePlayer(); return; }
  if (!v) return;
  if (e.key === ' ' || e.key === 'k') { e.preventDefault(); v.paused ? v.play() : v.pause(); }
  if (e.key === 'ArrowRight')         { e.preventDefault(); v.currentTime = Math.min(v.duration, v.currentTime + 5); }
  if (e.key === 'ArrowLeft')          { e.preventDefault(); v.currentTime = Math.max(0, v.currentTime - 5); }
  if (e.key === 'm')                  { v.muted = !v.muted; }
  if (e.key === 'f')                  { toggleFullscreen(); }
  if (e.key === 'c') {
    const cc = document.getElementById('playerContainer').querySelector('.cp-btn-cc');
    if (cc && cc.style.display !== 'none') toggleSubtitle();
  }
});
// Függvény a teljes képernyő és a fekvő tájolás bekapcsolásához
async function goFullscreenLandscape() {
  const element = document.documentElement; // Az egész oldal (vagy pl. egy specifikus <video> elem)

  try {
    // 1. Belépés teljes képernyős módba
    if (element.requestFullscreen) {
      await element.requestFullscreen();
    } else if (element.webkitRequestFullscreen) { /* Safari / iOS */
      await element.webkitRequestFullscreen();
    }

    // 2. Kijelző elforgatása fekvő (landscape) módba és zárolása
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
    }
    
  } catch (error) {
    console.error("Nem sikerült a váltás:", error);
  }
}

// Függvény a kilépéshez és a zárolás feloldásához
async function exitFullscreenLandscape() {
  try {
    if (document.exitFullscreen) {
      await document.exitFullscreen();
    }

    // Zárolás feloldása, hogy visszaálljon az eredeti működés
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch (error) {
    console.error("Hiba a kilépés során:", error);
  }
}