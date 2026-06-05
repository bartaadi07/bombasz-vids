const DETAIL_DATA = {
  csm: {
    title: 'Chainsaw Man the Movie: Reze Arc',
    subTitle: '',
    badges: ['Film', 'Anime', 'Akció'],
    year: '2025',
    duration: '~90 perc',
    studio: 'MAPPA',
    desc: 'Órák kérdése és elérhető lesz jobb minőségben.',
    heroClass: 'hero-csm',
    posterClass: 'poster-csm-detail',
    posterText: 'CHAINSAW\nMAN',
    coverFile: 'chainsaw',
    subs: [
      {
        lang: 'Magyar',
        note: 'fordító: bartaadi',
        files: [
          { label: 'SRT letöltés', href: 'srt/chainsaw.srt' },
        ]
      }
    ],
    sourceLabel: 'nyaa.si · videó forrás',
    sourceHref: 'https://nyaa.si/view/2052191',
    playUrl: 'https://videa.hu/player?v=dNRXuspKNqfPuiBq',
    playTitle: 'Chainsaw Man',
    trackSrc: 'vtt/chainsaw.vtt',
    srtHref: 'srt/chainsaw.srt',
  },
  eva: {
    title: 'The End of Evangelion',
    subTitle: 'Neon Genesis Evangelion',
    badges: ['Film', 'Anime', 'Dráma'],
    year: '1997',
    duration: '87 perc',
    studio: 'Gainax / Production I.G',
    desc: 'Nem az én feliratom — időzítés javítva. Ha te vagy az eredeti fordító, keress fel és megjelöllek. (Órák kérdése és elérhető lesz jobb minőségben.)',
    heroClass: 'hero-eva',
    posterClass: 'poster-eva-detail',
    posterText: 'END OF\nEVANGELION',
    coverFile: 'evangelion',
    subs: [
      {
        lang: 'Magyar',
        note: 'Fordító: ismeretlen',
        files: [
          { label: 'SRT letöltés', href: 'srt/end.of.evangelion.srt' },
        ]
      }
    ],
    sourceLabel: 'nyaa.si · videó forrás',
    sourceHref: 'https://nyaa.si/view/1408436',
    playUrl: '//videa.hu/player?v=xbyFed1D3UsrQgNR',
    playTitle: 'End of Evangelion',
    trackSrc: 'vtt/end.of.evangelion.vtt',
    srtHref: 'srt/end.of.evangelion.srt',
  }
};

const HERO_STYLES = {
  'hero-csm': `background: linear-gradient(160deg, #0a0002 0%, #200407 30%, #3e080d 60%, #5c0c12 80%, #140103 100%);`,
  'hero-eva': `background: linear-gradient(160deg, #010209 0%, #020818 30%, #05102e 60%, #090e38 80%, #020410 100%);`,
};

const POSTER_STYLES = {
  'poster-csm-detail': `background: linear-gradient(160deg, #0a0002, #3a0608, #5c0a10);`,
  'poster-eva-detail': `background: linear-gradient(160deg, #010209, #060d2e, #0a133e);`,
};

function openDetail(id) {
  const d = DETAIL_DATA[id];
  if (!d) return;

  const heroArt = document.getElementById('detailHeroArt');
  const heroBase = HERO_STYLES[d.heroClass] || '';
  heroArt.style.cssText = heroBase;
  const heroImg = new Image();
  heroImg.onload = () => {
    heroArt.style.cssText = `background-image: url('covers/${d.coverFile}.jpg'); background-size: cover; background-position: center top; filter: blur(3px) brightness(0.35); transform: scale(1.06);`;
    heroArt.parentElement.style.overflow = 'hidden';
  };
  heroImg.onerror = () => { heroArt.style.cssText = heroBase; };
  heroImg.src = `covers/${d.coverFile}.jpg`;

  const posterPlayBtn = document.getElementById('detailPosterPlay');
  posterPlayBtn.onclick = () => openPlayerFromDetail(id);

  document.getElementById('detailOverlay').dataset.currentId = id;

  const badgesEl = document.getElementById('detailBadges');
  badgesEl.innerHTML = d.badges.map((b, i) =>
    `<span class="detail-badge${i === 0 ? ' accent' : ''}">${b}</span>`
  ).join('');

  document.getElementById('detailTitle').textContent = d.title;
  document.getElementById('detailSubTitle').textContent = d.subTitle;
  document.getElementById('detailDesc').textContent = d.desc;

  document.getElementById('detailMeta').innerHTML = `
    <div class="detail-meta-item">
      <span class="detail-meta-label">Év</span>
      <span class="detail-meta-value">${d.year}</span>
    </div>
    <div class="detail-meta-item">
      <span class="detail-meta-label">Hossz</span>
      <span class="detail-meta-value">${d.duration}</span>
    </div>
    <div class="detail-meta-item">
      <span class="detail-meta-label">Stúdió</span>
      <span class="detail-meta-value">${d.studio}</span>
    </div>
  `;

  const posterEl = document.getElementById('detailPoster');
  posterEl.innerHTML = `
    <img src="covers/${d.coverFile}.jpg" alt="${d.title}" class="dpost-img"
         onerror="this.style.display='none'; this.nextElementSibling.style.removeProperty('display')">
    <div class="dpost-placeholder" style="${POSTER_STYLES[d.posterClass] || ''}; display:none">
      <div class="dpost-art">${d.posterText.replace('\n', '<br>')}</div>
    </div>
  `;

  document.getElementById('detailSubs').innerHTML = d.subs.map(s => `
    <div class="detail-sub-row">
      <span class="detail-sub-lang">${s.lang}</span>
      <span class="detail-sub-note">${s.note}</span>
      <div class="detail-sub-btns">
        ${s.files.map(f => `<a class="detail-sub-dl" href="${f.href}" download>${f.label}</a>`).join('')}
      </div>
    </div>
  `).join('');

  document.getElementById('detailSource').innerHTML = `
    <a class="detail-source-link" href="${d.sourceHref}" target="_blank" rel="noopener">
      <svg viewBox="0 0 24 24"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
      ${d.sourceLabel}
    </a>
  `;

  const overlay = document.getElementById('detailOverlay');
  overlay.classList.add('active');
  document.body.style.overflow = 'hidden';
  overlay.scrollTop = 0;

  if (!history.state || history.state.detail !== id) {
    history.pushState({ detail: id }, '', '#' + id);
  }
}

function closeDetail(pushBack) {
  const overlay = document.getElementById('detailOverlay');
  overlay.classList.remove('active');
  document.body.style.overflow = '';
  if (pushBack !== false && history.state && history.state.detail) {
    history.back();
  }
}

window.addEventListener('popstate', function(e) {
  if (e.state && e.state.detail) {
    openDetail(e.state.detail);
  } else {
    const overlay = document.getElementById('detailOverlay');
    overlay.classList.remove('active');
    document.body.style.overflow = '';
  }
});

window.addEventListener('DOMContentLoaded', function() {
  const hash = location.hash.replace('#', '');
  if (hash && DETAIL_DATA[hash]) {
    history.replaceState({ detail: hash }, '', '#' + hash);
    openDetail(hash);
  }
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Escape') {
    const overlay = document.getElementById('detailOverlay');
    if (overlay.classList.contains('active')) closeDetail();
  }
});

function openPlayerFromDetail(id) {
  const d = DETAIL_DATA[id];
  if (!d) return;

  const tpl = document.createElement('template');
  tpl.className = 'video-tracks';
  tpl.innerHTML = `<track kind="subtitles" src="${d.trackSrc}" srclang="hu" label="Magyar" default>`;

  const fakeBtn = {
    getAttribute: (attr) => {
      if (attr === 'data-url') return d.playUrl;
      if (attr === 'data-title') return d.playTitle;
      return null;
    },
    closest: () => ({ querySelector: () => tpl })
  };

  openPlayer(fakeBtn);
}
