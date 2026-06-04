let _subtitleOn = false;
let _subtitleInterval = null;
let _currentVideo = null;

let _subBottom = parseInt(localStorage.getItem('sub_bottom') ?? '8');
let _subSize   = parseInt(localStorage.getItem('sub_size')   ?? '100');

// Aktuális quality state
let _currentQuality = null;
let _availableQualities = [];
let _currentVideoUrl = null;
let _currentTrackTpl = null;
let _currentApiBase  = null;

// Indavideo stream-ek kinyerése böngészőben (magyar IP → magasabb minőség)
function guessHeightFromUrl(url) {
  const m = url.match(/[_\-\/](\d{3,4})[_\-\.]?(?:p|\.mp4)/i);
  if (m) return parseInt(m[1]);
  if (/1080/.test(url)) return 1080;
  if (/720/.test(url)) return 720;
  if (/480/.test(url)) return 480;
  if (/360/.test(url)) return 360;
  if (/hd/i.test(url)) return 720;
  if (/sd/i.test(url)) return 360;
  return 0;
}

function parseIndavideoStreams(html) {
  const streams = [];
  const m1 = html.match(/"videoUrls"\s*:\s*(\[[^\]]+\])/);
  if (m1) {
    try {
      JSON.parse(m1[1]).forEach(u => {
        if (u && typeof u === "string" && u.startsWith("http"))
          streams.push({ url: u, height: guessHeightFromUrl(u) });
      });
    } catch(e) {}
  }
  const m2 = html.match(/PLAYER_FLASH_PARAMS\s*=\s*(\{[\s\S]*?\});/);
  if (m2) {
    try {
      const fp = JSON.parse(m2[1]);
      ["videoUrls","video_urls","files"].forEach(k => {
        if (Array.isArray(fp[k])) fp[k].forEach(item => {
          const u = typeof item === "string" ? item : (item.url || item.src || item.file);
          if (u && u.startsWith("http") && !streams.find(s => s.url === u))
            streams.push({ url: u, height: guessHeightFromUrl(u) });
        });
      });
    } catch(e) {}
  }
  // Nyers CDN URL-ek
  const cdnRe = /https?:\/\/[^\s"'<]*(?:iinda\.hu|indavideocdn\.hu)[^\s"'<]*\.mp4[^\s"'<]*/g;
  for (const m of html.matchAll(cdnRe)) {
    const u = m[0].replace(/\u0026/g, "&").replace(/\\/g, "");
    if (!streams.find(s => s.url === u)) streams.push({ url: u, height: guessHeightFromUrl(u) });
  }
  return streams.sort((a, b) => b.height - a.height);
}

async function resolveIndavideoInBrowser(pageUrl, API_BASE) {
  const slugM = pageUrl.match(/indavideo\.hu\/video\/([^/?#]+)/);
  if (!slugM) return null;
  const slug = slugM[1];

  // 1. Próba: közvetlen böngésző fetch az indavideo API-ra (magyar IP → magas minőség)
  // Az indavideo Next.js frontend ezeket az endpointokat használja
  const apiEndpoints = [
    `https://indavideo.hu/api/video/${slug}`,
    `https://indavideo.hu/_next/data/latest/video/${slug}.json`,
  ];
  for (const endpoint of apiEndpoints) {
    try {
      const r = await fetch(endpoint, {
        headers: { 'Accept': 'application/json', 'X-Requested-With': 'XMLHttpRequest' },
        credentials: 'omit',
      });
      if (!r.ok) continue;
      const data = await r.json();
      const streams = extractStreamsFromJson(data);
      if (streams && streams.length > 0) {
        console.log('[indavideo-browser] API siker:', endpoint, '→', streams.map(s => s.height + 'p'));
        return streams;
      }
    } catch(e) {
      console.warn('[indavideo-browser] API hiba:', endpoint, e.message);
    }
  }

  // 2. Próba: közvetlen embed oldal fetch a böngészőből (ha CORS engedi)
  const embedUrl = `https://embed.indavideo.hu/player/video/${slug}`;
  try {
    const r = await fetch(embedUrl, {
      headers: { 'Referer': 'https://indavideo.hu/', 'Accept': 'text/html,*/*' },
      credentials: 'omit',
    });
    if (r.ok) {
      const html = await r.text();
      const streams = parseIndavideoStreams(html);
      if (streams.length > 0) {
        console.log('[indavideo-browser] embed siker →', streams.map(s => s.height + 'p'));
        return streams;
      }
    }
  } catch(e) {
    console.warn('[indavideo-browser] embed CORS blokkolt:', e.message);
  }

  // 3. Próba: szerver proxy az embed HTML-ért (utolsó lehetőség — szerver IP-vel megy, de jobb mint semmi)
  try {
    const r = await fetch(API_BASE + '/api/indavideo-embed-proxy?url=' +
      encodeURIComponent(embedUrl));
    if (r.ok) {
      const html = await r.text();
      const streams = parseIndavideoStreams(html);
      if (streams.length > 0) {
        console.log('[indavideo-browser] szerver proxy →', streams.map(s => s.height + 'p'));
        return streams;
      }
      console.warn('[indavideo-browser] szerver proxy HTML-ben nincs stream');
    }
  } catch(e) {
    console.warn('[indavideo-browser] szerver proxy hiba:', e.message);
  }

  return null;
}

function extractStreamsFromJson(data) {
  const streams = [];
  function scan(obj) {
    if (!obj || typeof obj !== 'object') return;
    for (const key of ['video_urls', 'videoUrls', 'video_files', 'videoFiles', 'urls', 'files']) {
      if (Array.isArray(obj[key])) {
        obj[key].forEach(item => {
          const u = typeof item === 'string' ? item : (item.url || item.src || item.file || item.video_url);
          if (u && typeof u === 'string' && u.startsWith('http') && !streams.find(s => s.url === u))
            streams.push({ url: u, height: guessHeightFromUrl(u) });
        });
      }
    }
    for (const v of Object.values(obj)) {
      if (v && typeof v === 'object' && !Array.isArray(v)) scan(v);
    }
  }
  scan(data);
  return streams.length > 0 ? streams.sort((a, b) => b.height - a.height) : null;
}

async function openPlayer(btn) {
  const videoUrl  = btn.getAttribute('data-url');
  const title     = btn.getAttribute('data-title');
  const card      = btn.closest('.card');
  const trackTpl  = card ? card.querySelector('template.video-tracks') : null;

  const API_BASE = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:3000'
    : 'https://api.bombasz.hu';

  _currentVideoUrl = videoUrl;
  _currentTrackTpl = trackTpl;
  _currentApiBase  = API_BASE;
  _currentQuality  = null;
  _availableQualities = [];

  document.getElementById('playerModal').classList.add('active');
  document.body.style.overflow = 'hidden';

  history.pushState({ playerOpen: true }, '');

  const container = document.getElementById('playerContainer');
  container.innerHTML = '<div class="player-loading"><div class="loading-spinner"></div><span>Betöltés…</span></div>';

  try {
    const isIndavideo = /indavideo\.hu/i.test(videoUrl);

    if (isIndavideo) {
      // Böngésző oldali kinyerés (magyar IP → magasabb minőség)
      container.innerHTML = '<div class="player-loading"><div class="loading-spinner"></div><span>Indavideo stream kinyerése…</span></div>';
      const browserStreams = await resolveIndavideoInBrowser(videoUrl, API_BASE);

      if (browserStreams && browserStreams.length > 0) {
        // Siker: felépítjük a quality listát direktben
        _availableQualities = browserStreams.map(s => ({
          height:    s.height,
          label:     s.height ? s.height + 'p' : 'Legjobb',
          directUrl: s.url,
        }));
        _currentQuality = String(_availableQualities[0].height || 'best');

        container.innerHTML = '<div class="player-loading"><div class="loading-spinner"></div><span>Videó betöltése (' + _currentQuality + 'p)…</span></div>';

        const bestStream = browserStreams[0];
        const streamUrl  = API_BASE + '/api/stream?direct=' + encodeURIComponent(bestStream.url);
        buildVideoPlayer(container, streamUrl, trackTpl);
        return;
      }
      // Fallback: ha a böngésző oldali kinyerés sikertelen, normál flow
      console.warn('[indavideo-browser] sikertelen, szerver fallback');
    }

    // Normál flow (videa.hu és minden más, + indavideo fallback)
    const fmtRes  = await fetch(API_BASE + '/api/formats?url=' + encodeURIComponent(videoUrl));
    const fmtData = await fmtRes.json();

    if (fmtData.error) throw new Error(fmtData.error);

    _availableQualities = fmtData.qualities || [];
    _currentQuality = _availableQualities.length > 0 ? String(_availableQualities[0].height || 'best') : 'best';

    container.innerHTML = '<div class="player-loading"><div class="loading-spinner"></div><span>Videó betöltése (' + _currentQuality + 'p)…</span></div>';

    await loadPlayerWithQuality(container, videoUrl, _currentQuality, trackTpl, API_BASE);
  } catch (err) {
    container.innerHTML = `<div class="player-loading"><span style="color:#f66">Hiba: ${err.message}</span></div>`;
    console.error('openPlayer hiba:', err);
  }
}

async function loadPlayerWithQuality(container, videoUrl, quality, trackTpl, API_BASE) {
  // Ha az _availableQualities tartalmaz directUrl-t (indavideo böngésző kinyerés), azt használjuk
  const qEntry = _availableQualities.find(q => String(q.height) === String(quality));
  if (qEntry && qEntry.directUrl) {
    const streamUrl = API_BASE + '/api/stream?direct=' + encodeURIComponent(qEntry.directUrl);
    buildVideoPlayer(container, streamUrl, trackTpl);
    return;
  }

  const qParam = quality && quality !== 'best' ? '&quality=' + encodeURIComponent(quality) : '';
  const res    = await fetch(API_BASE + '/api/resolve?url=' + encodeURIComponent(videoUrl) + qParam);
  const data   = await res.json();

  if (!data.proxyUrl) throw new Error(data.error || 'Ismeretlen hiba');

  buildVideoPlayer(container, API_BASE + data.proxyUrl, trackTpl);
}

async function switchQuality(newQuality) {
  if (!_currentVideoUrl || newQuality === _currentQuality) return;
  _currentQuality = newQuality;

  const container = document.getElementById('playerContainer');
  const video     = container.querySelector('#mainVideo');
  const savedTime = video ? video.currentTime : 0;
  const wasPaused = video ? video.paused : true;

  // Betöltés jelzés megőrizve, ne ugorjon
  const loadingDiv = document.createElement('div');
  loadingDiv.className = 'player-loading quality-switch-loading';
  loadingDiv.innerHTML = '<div class="loading-spinner"></div><span>Minőségváltás: ' + newQuality + 'p…</span>';
  container.appendChild(loadingDiv);

  try {
    // Ha van directUrl (indavideo böngésző kinyerés), azt használjuk
    const qEntry = _availableQualities.find(q => String(q.height) === String(newQuality));
    let streamUrl;
    if (qEntry && qEntry.directUrl) {
      streamUrl = _currentApiBase + '/api/stream?direct=' + encodeURIComponent(qEntry.directUrl);
    } else {
      const qParam = newQuality && newQuality !== 'best' ? '&quality=' + encodeURIComponent(newQuality) : '';
      const res    = await fetch(_currentApiBase + '/api/resolve?url=' + encodeURIComponent(_currentVideoUrl) + qParam);
      const data   = await res.json();
      if (!data.proxyUrl) throw new Error(data.error || 'Ismeretlen hiba');
      streamUrl = _currentApiBase + data.proxyUrl;
    }

    container.innerHTML = '';
    buildVideoPlayer(container, streamUrl, _currentTrackTpl, savedTime, wasPaused);
  } catch (err) {
    loadingDiv.remove();
    console.error('switchQuality hiba:', err);
    alert('Minőségváltás sikertelen: ' + err.message);
  }
}

function buildVideoPlayer(container, src, trackTpl, resumeTime, resumePlaying) {
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
          <div class="cp-quality-wrap" id="cpQualityWrap" style="display:none">
            <button class="cp-btn cp-btn-quality" id="cpQualityBtn" title="Minőség">
              <span id="cpQualityLabel">HD</span>
            </button>
            <div class="cp-quality-menu" id="cpQualityMenu"></div>
          </div>
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

  if (trackTpl) {
    trackTpl.content.querySelectorAll('track').forEach(t => video.appendChild(t.cloneNode(true)));
  }

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
  closeBtn.addEventListener('click', () => closePlayer(false));

  overlay.addEventListener('dblclick', e => {
    e.preventDefault();
    toggleFullscreen();
  });


  video.addEventListener('error', () => {
    const err = video.error;
    const codes = { 1:'ABORTED', 2:'NETWORK', 3:'DECODE', 4:'SRC_NOT_SUPPORTED' };
    console.error('[video] hiba:', codes[err?.code] || err?.code, err?.message);
  });

  video.addEventListener('canplay', () => {
    if (resumeTime && resumeTime > 0) {
      video.currentTime = resumeTime;
    }
    if (resumePlaying === false) {
      // ha szüneteltetve volt, ne indítsuk el
    } else {
      video.play().catch(e => console.warn('[video] play() elutasítva:', e.message));
    }
  }, { once: true });

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

  muteBtn.addEventListener('click', () => { video.muted = !video.muted; });
  video.addEventListener('volumechange', () => {
    const muted = video.muted || video.volume === 0;
    muteBtn.querySelector('.icon-vol') .style.display = muted ? 'none'  : 'block';
    muteBtn.querySelector('.icon-mute').style.display = muted ? 'block' : 'none';
    if (!muted) volSlider.value = video.volume;
  });
  volSlider.addEventListener('input', () => { video.volume = parseFloat(volSlider.value); video.muted = false; });

  wrapper.addEventListener('wheel', e => {
    e.preventDefault(); 
    const step = 0.05;  
    if (e.deltaY < 0) {
      video.volume = Math.min(1, video.volume + step); 
    } else {
      video.volume = Math.max(0, video.volume - step); 
    }
    video.muted = false; 
  }, { passive: false });

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

    if (fs) {
      if (screen.orientation && screen.orientation.lock) {
        screen.orientation.lock('landscape').catch(err => {
          console.warn("Képernyő zárolása elutasítva (HTTPS szükséges):", err.message);
        });
      }
    } else {
      if (screen.orientation && screen.orientation.unlock) {
        screen.orientation.unlock();
      }
    }
  });

  // ─── Minőségválasztó ────────────────────────────────────────────────
  const qualityWrap  = wrapper.querySelector('#cpQualityWrap');
  const qualityBtn   = wrapper.querySelector('#cpQualityBtn');
  const qualityLabel = wrapper.querySelector('#cpQualityLabel');
  const qualityMenu  = wrapper.querySelector('#cpQualityMenu');

  if (_availableQualities && _availableQualities.length > 1) {
    qualityWrap.style.display = 'flex';

    // Aktuális minőség felirat
    const curQ = _currentQuality;
    qualityLabel.textContent = (curQ && curQ !== 'best') ? curQ + 'p' : 'Legjobb';

    // Menü elemek összeállítása
    qualityMenu.innerHTML = _availableQualities.map(q => {
      const qStr   = String(q.height || 'best');
      const active = qStr === curQ ? ' active' : '';
      const lbl    = q.height ? q.height + 'p' : 'Legjobb';
      const badge  = q.height === _availableQualities[0].height ? ' <span class="q-max-badge">MAX</span>' : '';
      return `<button class="cp-quality-item${active}" data-q="${qStr}">${lbl}${badge}</button>`;
    }).join('');

    // Menü megnyitás/zárás
    let menuOpen = false;
    qualityBtn.addEventListener('click', e => {
      e.stopPropagation();
      menuOpen = !menuOpen;
      qualityMenu.classList.toggle('open', menuOpen);
      qualityBtn.classList.toggle('active', menuOpen);
      if (menuOpen) showControls();
    });

    // Minőség kiválasztása
    qualityMenu.addEventListener('click', e => {
      const item = e.target.closest('.cp-quality-item');
      if (!item) return;
      const q = item.dataset.q;
      menuOpen = false;
      qualityMenu.classList.remove('open');
      qualityBtn.classList.remove('active');
      switchQuality(q);
    });

    // Kattintás máshova → zárja a menüt
    document.addEventListener('click', function closeQMenu() {
      if (menuOpen) {
        menuOpen = false;
        qualityMenu.classList.remove('open');
        qualityBtn.classList.remove('active');
      }
    });
  }

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

function closePlayer(fromPopState = false) {
  if (document.fullscreenElement) document.exitFullscreen();
  clearInterval(_subtitleInterval);
  _subtitleInterval = null;
  _currentVideo     = null;
  _subtitleOn       = false;

  document.getElementById('playerContainer').innerHTML = '';
  document.getElementById('playerModal').classList.remove('active');
  document.getElementById('playerModalInner').classList.remove('fullscreen');
  document.body.style.overflow = '';

  if (!fromPopState && history.state && history.state.playerOpen) {
    history.back();
  }
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

document.getElementById('playerModal').addEventListener('click', function(e) {
  if (e.target === this) closePlayer(false);
});

window.addEventListener('popstate', function(e) {
  const modal = document.getElementById('playerModal');
  if (modal && modal.classList.contains('active')) {
    closePlayer(true); 
  }
});

document.addEventListener('keydown', function(e) {
  if (!document.getElementById('playerModal').classList.contains('active')) return;
  const v = _currentVideo;
  if (e.key === 'Escape')             { closePlayer(false); return; }
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
document.addEventListener('contextmenu', function(e) {
  e.preventDefault();
});

document.addEventListener('keydown', function(e) {
  
  if (e.key === 'F12') {
    e.preventDefault();
    return false;
  }

  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'u') {
    e.preventDefault();
    return false;
  }

  const isDevToolsCombo = (e.ctrlKey || e.metaKey) && e.shiftKey && ['i', 'j', 'c'].includes(e.key.toLowerCase());
  const isMacDevToolsCombo = e.metaKey && e.altKey && ['i', 'j', 'c'].includes(e.key.toLowerCase());

  if (isDevToolsCombo || isMacDevToolsCombo) {
    e.preventDefault();
    return false;
  }
});