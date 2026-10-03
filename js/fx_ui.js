'use strict';
// ===== 画面の演出（見た目の気持ちよさ） =====
// タイトルの背景（仲間のイラスト・光の筋・舞い上がる火の粉）、ホームの光の粒、数字のカウントアップ、
// 総合力アップの表示、画面外の階段の矢印、技が使えるようになった瞬間の光、大きな被ダメージの赤い閃光、ミッション達成の通知
(function () {
  const ui = G.ui, $ = id => document.getElementById(id);
  const ART = c => 'img/chars/' + c + '_art.webp';
  const sparks = (n, cls) => Array.from({ length: n }, () => `<i class="${cls}" style="left:${(Math.random() * 100).toFixed(1)}%;animation-delay:${(-Math.random() * 8).toFixed(2)}s;animation-duration:${(5 + Math.random() * 5).toFixed(2)}s;--s:${(.6 + Math.random() * .9).toFixed(2)};--dx:${((Math.random() - .5) * 60).toFixed(0)}px"></i>`).join('');

  // ---------------------------------------------------------- タイトル
  function titleBg() {
    const t = $('title'); if (!t) return;
    const bg = document.createElement('div'); bg.className = 'tBg';
    bg.innerHTML = `<div class="tRays"></div><img class="tArt l" src="${ART('thunder')}" alt=""><img class="tArt r" src="${ART('samurai')}" alt=""><img class="tArt c" src="${ART('ice')}" alt=""><div class="tFog"></div><div class="tEmbers">${sparks(28, 'em')}</div>`;
    t.insertBefore(bg, t.firstChild);
    const logo = t.querySelector('.tMain'); if (logo) { logo.dataset.t = logo.textContent; logo.classList.add('shine'); }
  }

  // ---------------------------------------------------------- ホームの光の粒
  function homeMotes() {
    const hub = $('hub'); if (!hub) return;
    const m = document.createElement('div'); m.className = 'hubMotes'; m.innerHTML = sparks(18, 'mote');
    const shade = hub.querySelector('.hubShade'); if (shade) shade.after(m); else hub.prepend(m); // 暗い幕の上・キャラやボタンの下
  }

  // ---------------------------------------------------------- 数字のカウントアップ（コイン・総合力）
  // 表示中の数字を、目標の数字まで少しずつ近づける。増えた時は光らせる
  const rolls = new Map();
  function roll(el, target, fmt, dt) {
    if (!el) return;
    let r = rolls.get(el); if (!r) { r = { v: target, shown: '' }; rolls.set(el, r); }
    if (target < r.v || !isFinite(r.v)) r.v = target; // 減った時（ガチャで使った等）はすぐ合わせる
    else if (target > r.v) { r.v += Math.max(1, (target - r.v) * Math.min(1, dt * 7)); if (target - r.v < 1) r.v = target; el.classList.add('rolling'); }
    if (r.v === target) el.classList.remove('rolling');
    const s = fmt(Math.round(r.v)); if (s !== r.shown) { r.shown = s; el.textContent = s; }
  }
  // 総合力が上がった時：ホームで「UP!」が浮かぶ
  let lastPow = 0;
  function powUp(pow) {
    if (lastPow && pow > lastPow * 1.0005) {
      const b = $('hbPow'); if (b) { const f = document.createElement('span'); f.className = 'powFloat'; f.textContent = '▲UP'; b.parentNode.appendChild(f); setTimeout(() => f.remove(), 1400); b.classList.remove('powGlow'); void b.offsetWidth; b.classList.add('powGlow'); }
    }
    lastPow = pow;
  }

  // ---------------------------------------------------------- 画面外の階段を矢印で案内（探索が終わったら）
  function stairsArrow() {
    const a = $('stArrow'), W = G.W, S = G.S;
    if (!W || W.home || S.mode !== 'dungeon' || !W.D || !W.complete || G.trans) { a.classList.remove('on'); return; }
    const st = W.D.stairs, T = G.TILE, sx = st.tx * T + 8, sy = st.ty * T + 8, c = G.cam;
    const dx = sx - c.x, dy = sy - c.y, hw = G.VW / 2 - 14, hh = G.VH / 2 - 14;
    if (Math.abs(dx) < hw && Math.abs(dy) < hh) { a.classList.remove('on'); return; } // 画面の中に見えている
    const k = Math.min(hw / Math.max(1e-6, Math.abs(dx)), hh / Math.max(1e-6, Math.abs(dy))), px = dx * k, py = dy * k;
    const sc = innerWidth / G.VW;
    a.style.left = (innerWidth / 2 + px * sc) + 'px'; a.style.top = (innerHeight / 2 + py * sc) + 'px';
    a.style.setProperty('--a', Math.atan2(dy, dx) + 'rad'); a.classList.add('on');
  }

  // ---------------------------------------------------------- 技が使えるようになった瞬間の光
  const wasReady = {};
  function skillReady() {
    const H = G.hero; if (!H || !H.cds) return;
    document.querySelectorAll('#skills .sk[data-id]').forEach(d => {
      const id = d.dataset.id, ready = !(H.cds[id] > 0);
      if (ready && wasReady[id] === false) { d.classList.remove('readyFlash'); void d.offsetWidth; d.classList.add('readyFlash'); }
      wasReady[id] = ready;
    });
  }

  // ---------------------------------------------------------- 大きなダメージを受けた時の赤い閃光
  let lastHp = 0;
  function hurtFlash() {
    const H = G.hero; if (!H || !H.st || G.S.mode !== 'dungeon') { lastHp = 0; return; }
    if (lastHp && H.hp < lastHp - H.st.maxHp * .12) { const f = $('hurtFlash'); f.classList.remove('on'); void f.offsetWidth; f.classList.add('on'); }
    lastHp = H.hp;
  }

  // ---------------------------------------------------------- 探索中にデイリーミッションを達成した時の通知
  const doneSeen = {};
  function missionDone() {
    if (!G.S || !G.DAILY || !G.daily) return;
    const d = G.daily(), key = d.day;
    for (const m of G.DAILY) {
      const k = key + m.id;
      if (G.dailyDone(m) && !d.claimed[m.id]) { if (doneSeen[k] === false) { ui.toast('★ミッション達成！「' + m.n + '」　ホームで受け取れます'); G.sfx('pickup', 2); } doneSeen[k] = true; }
      else if (doneSeen[k] === undefined) doneSeen[k] = false;
    }
  }

  // ---------------------------------------------------------- 毎フレーム
  const update0 = ui.update;
  ui.update = function (dt) {
    update0(dt);
    const S = G.S, H = G.hero; if (!S) return;
    roll($('hbCoin'), S.coins, v => v.toLocaleString(), dt);
    if (S.mode === 'home' && H && H.st) powUp(G.powerOf(H.st));
    stairsArrow(); skillReady(); hurtFlash(); missionDone(); floorClear();
  };

  // ---------------------------------------------------------- ボス階に入った時の「WARNING」
  const enter0 = G.enterFloor;
  G.enterFloor = function (f, snap) {
    const r = enter0.apply(this, arguments);
    if (!snap && f % 5 === 0) {
      const K = G.W && G.W.boss && G.W.boss.bk ? G.bossKindAt(f) : null;
      const w = $('bossWarn'); w.querySelector('.bwSub').innerHTML = K ? 'B' + f + 'F　<b>' + K.n + '</b> が待ち受けている<br><span class="bwD">' + K.d + '</span>' : 'B' + f + 'F　階層の主が待ち受けている';
      clearTimeout(w._t0); clearTimeout(w._to);
      w._t0 = setTimeout(() => { // 階の名前の表示が終わってから
        w.classList.remove('on'); void w.offsetWidth; w.classList.add('on'); G.sfx('alarm');
        w._to = setTimeout(() => w.classList.remove('on'), 2600);
      }, 1600);
    }
    return r;
  };
  // ---------------------------------------------------------- 階層の探索が終わった時の「CLEAR!」
  let wasComplete = true;
  function floorClear() {
    const W = G.W; if (!W || W.home || G.S.mode !== 'dungeon') { wasComplete = true; return; }
    if (W.complete && !wasComplete) { ui.callout({ text: 'CLEAR!', sub: '階段へ向かいます', tone: 'gold', prio: 1, dur: 1.1, size: .7 }); G.say && G.say('clear'); }
    wasComplete = !!W.complete;
  }

  function build() {
    titleBg(); homeMotes();
    // ホームのキャラをタップした所からキラキラが弾ける
    const ch = $('hbChar');
    if (ch) ch.addEventListener('pointerdown', e => {
      const r = ch.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
      for (let i = 0; i < 7; i++) {
        const s = document.createElement('i'), a = Math.random() * Math.PI * 2, d = 30 + Math.random() * 40;
        s.className = 'tapStar'; s.textContent = Math.random() < .5 ? '✦' : '♥';
        s.style.cssText = `left:${x}px;top:${y}px;--tx:${(Math.cos(a) * d).toFixed(0)}px;--ty:${(Math.sin(a) * d - 20).toFixed(0)}px;color:${['#ffe36a', '#ff9ad5', '#9fe0ff', '#fff'][i % 4]}`;
        ch.appendChild(s); setTimeout(() => s.remove(), 750);
      }
    });
    // 出撃ボタンとガチャのバナーに、ときどき光が走る
    for (const id of ['hbGo', 'hbGacha']) { const el = $(id); if (el) { const s = document.createElement('i'); s.className = 'sweep'; el.appendChild(s); } }
    const a = document.createElement('div'); a.id = 'stArrow'; a.innerHTML = '<b>▲</b><span>階段</span>'; document.body.appendChild(a);
    const f = document.createElement('div'); f.id = 'hurtFlash'; document.body.appendChild(f);
    const bw = document.createElement('div'); bw.id = 'bossWarn'; bw.innerHTML = '<div class="bwBand top"></div><div class="bwMain">WARNING</div><div class="bwSub"></div><div class="bwBand bot"></div>'; document.body.appendChild(bw);
  }
  build();
})();
