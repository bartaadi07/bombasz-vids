/**
 * BOMBASZ VIDS — Tartalom adatbázis
 * 
 * ═══════════════════════════════════════════════════════════════════════
 *  ÚJ TARTALOM HOZZÁADÁSA:
 * 
 *  1. Adj hozzá egy új bejegyzést a CONTENT_DATA objektumhoz (egyedi kulcs)
 *  2. Töltsd ki a szükséges mezőket (lásd a példákat lentebb)
 *  3. A kártya HTML-t add hozzá az index.html-be (cards-grid szekción belül)
 * 
 *  TÍPUSOK:
 *    - "film"    → egyetlen videó link (playUrl)
 *    - "series"  → több epizód (episodes tömb)
 * 
 *  SZEKCIÓK (index.html-ben data-section attribútum):
 *    - "sajat"   → Saját Fordítások szekció
 *    - "egyeb"   → Egyéb szekció
 * ═══════════════════════════════════════════════════════════════════════
 */

const CONTENT_DATA = {

  // ─── SAJÁT FORDÍTÁSOK ────────────────────────────────────────────────

  csm: {
    type: 'film',           // 'film' | 'series'
    section: 'sajat',
    title: 'Chainsaw Man the Movie: Reze Arc',
    subTitle: '',
    badges: ['Film', 'Anime', 'Akció'],
    year: '2025',
    duration: '~90 perc',
    studio: 'MAPPA',
    desc: 'peak.',
    heroClass: 'hero-csm',
    posterClass: 'poster-csm-detail',
    posterText: 'CHAINSAW\nMAN',
    coverFile: 'chainsaw',
    subs: [
      {
        lang: 'Magyar',
        note: 'fordító: bartaadi',
        files: [
          { label: 'SRT', href: 'srt/chainsaw.srt' },
        ]
      }
    ],
    sourceLabel: 'nyaa.si · videó forrás',
    sourceHref: 'https://nyaa.si/view/2052191',
    // film típusnál:
    playUrl: 'https://videa.hu/player?v=d5OOor9NDgsG1pTi',
    playTitle: 'Chainsaw Man',
    trackSrc: 'vtt/chainsaw.vtt',
  },

  // ─── EGYÉB ──────────────────────────────────────────────────────────

  eva: {
    type: 'film',
    section: 'egyeb',
    title: 'The End of Evangelion',
    subTitle: 'Neon Genesis Evangelion',
    badges: ['Film', 'Anime', 'Dráma'],
    year: '1997',
    duration: '87 perc',
    studio: 'Gainax / Production I.G',
    desc: 'Nem az én feliratom — időzítés javítva. Ha te vagy az eredeti fordító, keress fel és megjelöllek.',
    heroClass: 'hero-eva',
    posterClass: 'poster-eva-detail',
    posterText: 'END OF\nEVANGELION',
    coverFile: 'evangelion',
    subs: [
      {
        lang: 'Magyar',
        note: 'Fordító: ismeretlen',
        files: [
          { label: 'SRT', href: 'srt/end.of.evangelion.srt' },
        ]
      }
    ],
    sourceLabel: 'nyaa.si · videó forrás',
    sourceHref: 'https://nyaa.si/view/1408436',
    playUrl: '//videa.hu/player?v=PgRnentyDxzjqCps',
    playTitle: 'End of Evangelion',
    trackSrc: 'vtt/end.of.evangelion.vtt',
  },

  // ─── PÉLDA: 1 részes sorozat ────────────────────────────────────────

  // dungeon_meshi: {
  //   type: 'series',
  //   section: 'sajat',
  //   title: 'Dungeon Meshi',
  //   subTitle: 'Delicious in Dungeon',
  //   badges: ['Sorozat', 'Anime', 'Fantasy'],
  //   year: '2024',
  //   duration: '24 perc / ep.',
  //   studio: 'Trigger',
  //   desc: 'Laios és csapata elszántan ereszkedik le a dungeon mélyébe, hogy megmentsék húgát — útközben viszont csak a szörnyeket megeszik.',
  //   heroClass: 'hero-dunmeshi',
  //   posterClass: 'poster-dunmeshi-detail',
  //   posterText: 'DUNGEON\nMESHI',
  //   coverFile: 'dunmeshi',
  //   subs: [
  //     {
  //       lang: 'Magyar',
  //       note: 'fordító: bartaadi',
  //       files: [
  //         { label: 'SRT', href: 'srt/dunmeshi-ep01.srt' },
  //       ]
  //     }
  //   ],
  //   sourceLabel: 'nyaa.si · videó forrás',
  //   sourceHref: 'https://nyaa.si/',
  //   episodes: [
  //     { ep: 1, title: 'Hot Pot / Tűzlizárda', playUrl: 'https://videa.hu/player?v=PÉLDALINK1', trackSrc: 'vtt/dunmeshi-ep01.vtt' },
  //   ],
  // },

  // ─── PÉLDA: Többrészes sorozat ──────────────────────────────────────

  deathnote: {
    type: 'series',
    section: 'egyeb',
    title: 'Death Note',
    subTitle: 'Death Note',
    badges: ['Sorozat', 'Anime', 'Mind-Game'],
    year: '2006',
    duration: '24 perc / ep.',
    studio: 'Madhouse',
    desc: '',
    heroClass: 'hero-deathnote',
    posterClass: 'poster-deathnote-detail',
    posterText: 'DEATH\nNOTE',
    coverFile: 'deathnote',
    subs: [
      {
        lang: 'Magyar',
        note: '',
        files: [
        ,
        ]
      }
    ],
    sourceLabel: 'nyaa.si · videó forrás',
    sourceHref: 'https://nyaa.si/view/1866355',
    episodes: [
      { ep: 1,  title: '1. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_1'},
      { ep: 2,  title: '2. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_2'},
      { ep: 3,  title: '3. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_3'},
      { ep: 4,  title: '4. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_4'},
      { ep: 5,  title: '5. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_5'},
      { ep: 6,  title: '6. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_6'},
      { ep: 7,  title: '7. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_7'},
      { ep: 8,  title: '8. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_8'},
      { ep: 9,  title: '9. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_9'},
      { ep: 10,  title: '10. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_10'},
      { ep: 11,  title: '11. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_11'},
      { ep: 12,  title: '12. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_12'},
      { ep: 13,  title: '13. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_13'},
      { ep: 14,  title: '14. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_14'},
      { ep: 15,  title: '15. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_15'},
      { ep: 16,  title: '16. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_16'},
      { ep: 17,  title: '17. rész',         playUrl: 'http://indavideo.hu/video/n3m_j4t3k_s_17'},
      { ep: 18,  title: '18. rész',         playUrl: 'http://indavideo.hu/video/borotvalkozik_hozzaolvaszt_szilszkin_elorejon_talalatet_HZAX'},
      { ep: 19,  title: '19. rész',         playUrl: 'http://indavideo.hu/video/beterit_rongylabda_kifesulkodik_daktilus_Ve85'},
      { ep: 20,  title: '20. rész',         playUrl: 'http://indavideo.hu/video/megall_csipofajas_vetomagkosar_pirofoszforsav_H2LN'},
      { ep: 21,  title: '21. rész',         playUrl: 'http://indavideo.hu/video/keszsegeskedik_belefajdul_visszaedesget_ragyalogol_sPZq'},
      { ep: 22,  title: '22. rész',         playUrl: 'http://indavideo.hu/video/bedug_egyenesites_hajoallas_uratlan_kiszivodik_n8ND'},
      { ep: 23,  title: '23. rész',         playUrl: 'http://indavideo.hu/video/ezust_vakmetszes_szetkinalgat_bardo_nwI8'},
      { ep: 24,  title: '24. rész',         playUrl: 'http://indavideo.hu/video/lycsokkenes_moha_gyarovezet_kihangol_korbeepul_maganjogi_AH59'},
      { ep: 25,  title: '25. rész',         playUrl: 'http://indavideo.hu/video/lykor_olto_radiobemondo_maradhat_sormeres_regresszios_S5V2'},
      { ep: 26,  title: '26. rész',         playUrl: 'http://indavideo.hu/video/uro_nepoktatas_fodel_tojik_abroncshal_felborithatatlan_MP1P'},
      { ep: 27,  title: '27. rész',         playUrl: 'http://indavideo.hu/video/csoszeru_szekrekedeses_vakcinatermelo_artalmatlan_1xlO'},
      { ep: 28,  title: '28. rész',         playUrl: 'http://indavideo.hu/video/arazshalo_kenyszeritett_izkoz_fenymasolo_feljelenik_BrUl'},
      { ep: 29,  title: '29. rész',         playUrl: 'http://indavideo.hu/video/turboszivattyu_diurnista_elteres_csofoglalat_hgSV'},
      { ep: 30,  title: '30. rész',         playUrl: 'http://indavideo.hu/video/bizomanyi_specialis_belerekeszt_odamotyog_S5Zt'},
      { ep: 31,  title: '31. rész',         playUrl: 'http://indavideo.hu/video/fsag_barmit_legazol_bolydit_szeretettei_fenykepeszeti_Rqhx'},
      { ep: 32,  title: '32. rész',         playUrl: 'http://indavideo.hu/video/y_kiperdul_agyonkombinal_argentin_felgombsator_gezenguz_KAIE'},
      { ep: 33,  title: '33. rész',         playUrl: 'http://indavideo.hu/video/eldusulas_enfelolem_megtukrozodik_kitamogat_konyomtatas_vThO'},
      { ep: 34,  title: '34. rész',         playUrl: 'http://indavideo.hu/video/molettes_kigyulladva_hamuzsirgyar_foldmunka_QHpk'},
      { ep: 35,  title: '35. rész',         playUrl: 'http://indavideo.hu/video/utogetes_begetes_rajzpadlas_engesztel_hatar_LQpA'},
      { ep: 36,  title: '36. rész',         playUrl: 'http://indavideo.hu/video/atvitazik_kileltaroz_furikazik_oldalzsak_aerodinamikai_SKU8'},
      { ep: 37,  title: '37. rész',         playUrl: 'http://indavideo.hu/video/szenpad_csuromvizes_zizzent_konzervalo_D1Go'},

    ],
  },

  /* ════════════════════════════════════════════════════════════════════
   *  SOROZAT PÉLDA — másold be és módosítsd
   *
   *  example_series: {
   *    type: 'series',
   *    section: 'sajat',          // vagy 'egyeb'
   *    title: 'Sorozat Neve',
   *    subTitle: 'Eredeti cím',
   *    badges: ['Sorozat', 'Anime', 'Akció'],
   *    year: '2024',
   *    duration: '24 perc / ep.',
   *    studio: 'Stúdió neve',
   *    desc: 'Rövid leírás a sorozatról.',
   *    heroClass: 'hero-example',    // CSS class hero háttérhez (adj hozzá style.css-ben)
   *    posterClass: 'poster-example-detail',
   *    posterText: 'SOROZAT\nNEVE',
   *    coverFile: 'example',         // covers/example.jpg
   *    subs: [
   *      {
   *        lang: 'Magyar',
   *        note: 'fordító: bartaadi',
   *        files: [
   *          { label: 'SRT (összes)', href: 'srt/example.zip' },
   *        ]
   *      }
   *    ],
   *    sourceLabel: 'nyaa.si · forrás',
   *    sourceHref: 'https://nyaa.si/...',
   *    // series típusnál episodes tömb:
   *    episodes: [
   *      { ep: 1,  title: '1. rész',    playUrl: 'https://videa.hu/player?v=...', trackSrc: 'vtt/example-ep01.vtt' },
   *      { ep: 2,  title: '2. rész',    playUrl: 'https://videa.hu/player?v=...', trackSrc: 'vtt/example-ep02.vtt' },
   *      { ep: 3,  title: '3. rész',    playUrl: 'https://videa.hu/player?v=...', trackSrc: 'vtt/example-ep03.vtt' },
   *      // ... tovább
   *    ],
   *  },
   * ════════════════════════════════════════════════════════════════════ */

};

// ─── Hero és poster stílusok ─────────────────────────────────────────
// Ha új tartalmat adsz hozzá, add hozzá a hero és poster CSS-t a style.css-be is!
const HERO_STYLES = {
  'hero-csm':      `background: linear-gradient(160deg, #0a0002 0%, #200407 30%, #3e080d 60%, #5c0c12 80%, #140103 100%);`,
  'hero-eva':      `background: linear-gradient(160deg, #010209 0%, #020818 30%, #05102e 60%, #090e38 80%, #020410 100%);`,
  'hero-dunmeshi': `background: linear-gradient(160deg, #020a04 0%, #041a08 30%, #073d14 60%, #0a5a1c 80%, #021006 100%);`,
  'hero-mob':      `background: linear-gradient(160deg, #080212 0%, #140326 30%, #280550 60%, #1a0438 80%, #050110 100%);`,
};

const POSTER_STYLES = {
  'poster-csm-detail':      `background: linear-gradient(160deg, #0a0002, #3a0608, #5c0a10);`,
  'poster-eva-detail':      `background: linear-gradient(160deg, #010209, #060d2e, #0a133e);`,
  'poster-dunmeshi-detail': `background: linear-gradient(160deg, #020a04, #063a10, #0a5218);`,
  'poster-mob-detail':      `background: linear-gradient(160deg, #080212, #1a0440, #280560);`,
};

// ─── Detail overlay megnyitása ───────────────────────────────────────
function openDetail(id) {
  const d = CONTENT_DATA[id];
  if (!d) return;

  // Hero háttér
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

  document.getElementById('detailOverlay').dataset.currentId = id;

  // Badges
  document.getElementById('detailBadges').innerHTML = d.badges.map((b, i) =>
    `<span class="detail-badge${i === 0 ? ' accent' : ''}">${b}</span>`
  ).join('');

  document.getElementById('detailTitle').textContent = d.title;
  document.getElementById('detailSubTitle').textContent = d.subTitle || '';
  document.getElementById('detailDesc').textContent = d.desc;

  // Meta
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

  // Poster
  const posterEl = document.getElementById('detailPoster');
  posterEl.innerHTML = `
    <img src="covers/${d.coverFile}.jpg" alt="${d.title}" class="dpost-img"
         onerror="this.style.display='none'; this.nextElementSibling.style.removeProperty('display')">
    <div class="dpost-placeholder" style="${POSTER_STYLES[d.posterClass] || ''}; display:none">
      <div class="dpost-art">${d.posterText.replace('\n', '<br>')}</div>
    </div>
  `;

  // Play gomb / epizódok
  const playBtn = document.getElementById('detailPosterPlay');
  const episodesSection = document.getElementById('detailEpisodesSection');
  const episodesEl = document.getElementById('detailEpisodes');

  if (d.type === 'series' && d.episodes && d.episodes.length > 0) {
    // Sorozat: elrejtjük a play gombot, megjelenítjük az epizód listát
    playBtn.style.display = 'none';
    episodesSection.style.display = 'block';
    episodesEl.innerHTML = d.episodes.map((ep, i) => `
      <button class="episode-btn" onclick="playEpisode('${id}', ${i})" title="${ep.title}">
        <span class="ep-num">${String(ep.ep).padStart(2, '0')}</span>
        <span class="ep-title">${ep.title}</span>
        <svg class="ep-play-icon" viewBox="0 0 24 24"><polygon points="6,3 20,12 6,21"/></svg>
      </button>
    `).join('');
  } else {
    // Film: play gomb
    playBtn.style.display = '';
    playBtn.onclick = () => openPlayerFromDetail(id);
    episodesSection.style.display = 'none';
  }

  // Feliratok
  document.getElementById('detailSubs').innerHTML = d.subs.map(s => `
    <div class="detail-sub-row">
      <span class="detail-sub-lang">${s.lang}</span>
      <span class="detail-sub-note">${s.note}</span>
      <div class="detail-sub-btns">
        ${s.files.map(f => `<a class="detail-sub-dl" href="${f.href}" download>${f.label}</a>`).join('')}
      </div>
    </div>
  `).join('');

  // Forrás
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

// ─── Sorozat epizód lejátszása ───────────────────────────────────────
function playEpisode(id, epIndex) {
  const d = CONTENT_DATA[id];
  if (!d || !d.episodes) return;
  const ep = d.episodes[epIndex];
  if (!ep) return;

  const tpl = document.createElement('template');
  tpl.className = 'video-tracks';
  if (ep.trackSrc) {
    tpl.innerHTML = `<track kind="subtitles" src="${ep.trackSrc}" srclang="hu" label="Magyar" default>`;
  }

  const fakeBtn = {
    getAttribute: (attr) => {
      if (attr === 'data-url') return ep.playUrl;
      if (attr === 'data-title') return `${d.title} – ${ep.title}`;
      return null;
    },
    closest: () => ({ querySelector: () => tpl })
  };

  openPlayer(fakeBtn);
}

// ─── Film lejátszása a detail nézetből ──────────────────────────────
function openPlayerFromDetail(id) {
  const d = CONTENT_DATA[id];
  if (!d) return;

  const tpl = document.createElement('template');
  tpl.className = 'video-tracks';
  if (d.trackSrc) {
    tpl.innerHTML = `<track kind="subtitles" src="${d.trackSrc}" srclang="hu" label="Magyar" default>`;
  }

  const fakeBtn = {
    getAttribute: (attr) => {
      if (attr === 'data-url') return d.playUrl;
      if (attr === 'data-title') return d.title;
      return null;
    },
    closest: () => ({ querySelector: () => tpl })
  };

  openPlayer(fakeBtn);
}

// ─── History / keyboard kezelés ─────────────────────────────────────
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
  if (hash && CONTENT_DATA[hash]) {
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