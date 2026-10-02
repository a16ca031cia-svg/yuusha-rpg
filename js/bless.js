'use strict';
// ===== 祝福（その探索の間だけ有効な強化）と覚醒 =====
// ・祭壇の部屋に入る／守護者を倒す／階層の主を倒すと、自動で1つ獲得（選択画面で止めない）
// ・同じ祝福をもう一度得るとLvが上がる（最大Lv3）。帰還・力尽きるとすべて消える（レベル・装備は残る）
// ・決まった2つがそろうと「覚醒」：短く派手な演出のあと、特別な効果が加わる
// ・祝福から出た攻撃からさらに祝福が出る時は「世代」を数え、3世代までで止める。さらに1秒あたりの発生数にも上限
(function () {
  const R = () => Math.random();
  G.BLESS = {
    echo: { n: '雷の残響', tag: 'thunder', ic: '響', col: '#9fdcff', d: l => `雷が伝わり終えた所から、弱い雷がもう一度走る（威力${40 + 15 * l}%）` },
    strike: { n: '雷鳴の刃', tag: 'thunder', ic: '鳴', col: '#fff36a', d: l => `通常攻撃が当たると${15 + 7 * l}%で敵に落雷（周りも巻き込む）` },
    seed: { n: '氷の種', tag: 'ice', ic: '種', col: '#bfeaff', d: l => `凍った敵を倒すと氷片が飛び散り、周りの敵を凍らせる` },
    nova: { n: '霜の波動', tag: 'ice', ic: '霜', col: '#e8f8ff', d: l => `${7 - l}秒ごとに周りへ冷気が広がり、敵を凍らせる` },
    zanshin: { n: '残心', tag: 'blade', ic: '残', col: '#ffc0c0', d: l => `倒した敵の位置に、少し遅れて追加の斬撃（威力${100 + 60 * l}%）` },
    critx: { n: '会心の極意', tag: 'blade', ic: '極', col: '#ffe27a', d: l => `会心の一撃が十字の斬撃になり、周りの敵も斬る` },
    bomb: { n: '爆裂連鎖', tag: 'boom', ic: '爆', col: '#ffa050', d: l => `倒した敵が${20 + 10 * l}%で爆発。爆発で倒れた敵も爆発する` },
    gale: { n: '疾風の刃', tag: 'boom', ic: '風', col: '#c8ffd8', d: l => `敵を倒すと、近くの敵へ風の刃が${l}本飛ぶ` },
    guard: { n: '守護の反撃', tag: 'guard', ic: '護', col: '#8fe3ff', d: l => `バリアが張られ、壊れると周りに衝撃波` },
    moon: { n: '吸血の月', tag: 'guard', ic: '月', col: '#ff7a8a', d: l => `敵を倒すたびにHPが${(1.2 * l).toFixed(1)}%回復` },
    stride: { n: '狩人の歩み', tag: 'gold', ic: '歩', col: '#a8f060', d: l => `歩いた距離に応じて、次の技の威力が上がる（最大+${35 * l}%）` },
    gold: { n: '黄金の加護', tag: 'gold', ic: '金', col: '#ffd84d', d: l => `コインが${100 + 25 * l}%。強敵を倒すとコインが弾ける` },
  };
  G.AWAKEN = [
    { id: 'raitei', n: '雷帝の怒り', need: ['echo', 'strike'], col: '#fff36a', d: '雷で倒した敵から、次の敵へ落雷が走る' },
    { id: 'hyoso', n: '氷葬', need: ['seed', 'nova'], col: '#bfeaff', d: '氷片が凍った敵に当たると、その敵も砕け散る' },
    { id: 'kenki', n: '剣鬼', need: ['zanshin', 'critx'], col: '#ff8a8a', d: '会心で倒すと、次の敵へ一瞬で斬り込む' },
    { id: 'fudo', n: '不動の構え', need: ['guard', 'moon'], col: '#8fe3ff', d: '衝撃波で大きく押し返し、バリアがすぐに戻る' },
  ];
  // ホームで決める「祝福の方針」：その系統が出やすくなる
  G.BLESS_POL = { auto: 'おまかせ', thunder: '雷を優先', ice: '氷を優先', blade: '斬撃を優先', boom: '爆発・風を優先', guard: '生存重視', gold: 'コイン・移動' };
  const CHAR_TAG = { thunder: 'thunder', ice: 'ice', samurai: 'blade', hero: 'blade' };
  const B = G.bless = {};

  const run = () => G.S && G.S.run;
  B.raw = () => (run() && run().bless) || {};
  // 効果に使うLv：固有効果「共鳴の指輪」なら、持っている祝福がすべて1段階強い
  B.list = () => {
    const L = B.raw(), H = G.hero;
    if (!(H && H.st && H.st.uq && H.st.uq.resonance)) return L;
    const o = {}; for (const k in L) o[k] = L[k] + 1; return o;
  };
  B.lv = id => B.list()[id] || 0;
  B.awake = id => !!(run() && (run().awk || []).includes(id));
  B.src = { b_echo: '雷の残響', b_strike: '雷鳴の刃', b_seed: '氷の種', b_nova: '霜の波動', b_zan: '残心', b_critx: '会心の極意', b_bomb: '爆裂連鎖', b_gale: '疾風の刃', b_guard: '守護の反撃', b_raitei: '雷帝の怒り', b_kenki: '剣鬼' };

  // ---------------------------------------------------------- 獲得
  function pick() {
    const L = B.raw(), pol = G.S.settings.blessPol || 'auto', ct = CHAR_TAG[G.S.cur] || 'blade';
    const owned = Object.keys(L), w = [];
    for (const id in G.BLESS) {
      const b = G.BLESS[id], lv = L[id] || 0; if (lv >= 3) continue;
      let v = 1;
      if (pol !== 'auto' && b.tag === pol) v *= 4.5;
      if (b.tag === ct) v *= 1.8;
      if (lv) v *= 1.5; // 持っているものはLvが上がりやすい
      // 覚醒の相方を持っていれば出やすく（強い組み合わせにたどり着けるように）
      for (const a of G.AWAKEN) if (a.need.includes(id) && a.need.some(o => o !== id && owned.includes(o)) && !B.awake(a.id)) v *= 2.6;
      w.push([id, v]);
    }
    if (!w.length) return null;
    let s = 0; for (const [, v] of w) s += v; let r = R() * s;
    for (const [id, v] of w) { r -= v; if (r <= 0) return id; }
    return w[0][0];
  }
  // where：獲得した理由（「祝福の祭壇」など）
  B.gain = function (where, n) {
    const rr = run(); if (!rr) return;
    rr.bless = rr.bless || {}; rr.awk = rr.awk || [];
    const got = [];
    for (let i = 0; i < (n || 1); i++) { const id = pick(); if (!id) break; rr.bless[id] = (rr.bless[id] || 0) + 1; got.push(id); }
    const H = G.hero;
    if (!got.length) { // すべて最大：代わりにコイン
      G.gainCoins && G.gainCoins(G.COIN.chest(G.W.f), H.x, H.y - 10, true); G.ui.toast('祝福はすべて最大！ 代わりにコイン'); return;
    }
    const id = got[got.length - 1], b = G.BLESS[id], lv = rr.bless[id];
    G.fxAdd({ k: 'lvup', x: H.x, y: H.y, dur: 1.1 }); G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: 46, col: b.col, dur: .7 });
    G.light(H.x, H.y, 110, 1, b.col); G.burst(H.x, H.y - 14, 24, [b.col, '#ffffff'], 90, .7, 1, -40);
    G.sfx('learn');
    G.ui.callout({ text: '祝福 ' + b.n + (lv > 1 ? ' Lv' + lv : ''), sub: (where ? where + '：' : '') + b.d(lv), tone: 'gold', prio: 3, dur: 1.9, size: .62, flash: .2 });
    if (got.length > 1) G.ui.toast('祝福を' + got.length + 'つ獲得：' + got.map(g => G.BLESS[g].n).join('・'));
    checkAwaken();
    B.refreshHud();
  };
  function checkAwaken() {
    const rr = run(), L = B.raw();
    for (const a of G.AWAKEN) {
      if (rr.awk.includes(a.id) || !a.need.every(k => L[k])) continue;
      rr.awk.push(a.id);
      setTimeout(() => awakenFx(a), 1300); // 祝福の表示のあとに
    }
  }
  function awakenFx(a) {
    const H = G.hero; if (!H) return;
    G.ui.callout({ text: '覚醒!! ' + a.n, sub: a.d, tone: 'pink', prio: 5, dur: 2.4, size: .9, flash: .7, flashCol: a.col, rays: true });
    G.slowmo(.6, .25); G.shake(6); G.music.jingle && G.music.jingle('lvup');
    for (let i = 0; i < 3; i++) G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: 40 + i * 30, col: a.col, dur: .6 + i * .2 });
    G.burst(H.x, H.y - 14, 60, [a.col, '#ffffff', '#fff6c0'], 160, 1, 1, -60);
    const s = G.runStats(); s.awakened = (s.awakened || []).concat(a.n);
    B.refreshHud();
  }

  // ---------------------------------------------------------- 連鎖の制御（世代と、1秒あたりの発生数）
  let budget = 40;
  const spend = () => { if (budget < 1) return false; budget -= 1; return true; };
  const gen = o => (o && o.gen) || 0;
  const near = (x, y, r, skip) => G.W.enemies.filter(e => !e.dead && e !== skip && G.enemySeen(e) && G.dist(x, y, e.x, e.y) <= r + e.r);
  const nearest = (x, y, r, skip) => { let b = null, bd = r; for (const e of G.W.enemies) { if (e.dead || e === skip || !G.enemySeen(e)) continue; const d = G.dist(x, y, e.x, e.y); if (d < bd) { bd = d; b = e; } } return b; };
  const atk = () => G.hero.st.atk;
  // 少し遅れて起こる効果（残心など）
  const later = [];
  const delay = (t, fn) => later.push({ t, fn });

  // ---------------------------------------------------------- 命中した時
  B.onHit = function (e, dmg, o, crit) {
    const L = B.list(); if (!run()) return;
    const g = gen(o); if (g >= 3) return;
    if (L.strike && o.src === 'atk' && R() < .15 + .07 * L.strike && spend()) {
      const x = e.x, y = e.y;
      G.fxAdd({ k: 'strike', x, y, dur: .4, seed: R() * 999 }); G.light(x, y, 70, .4, '#fff6a0'); G.sfx('zap');
      for (const t of near(x, y, 22 + 4 * L.strike)) G.hitEnemy(t, atk() * (1 + .5 * L.strike), { src: 'b_strike', gen: g + 1, canCrit: true, ka: 0, kb: 30, noEl: true });
    }
    if (L.critx && crit && (o.src === 'atk' || o.src === 'skill' || o.src === 'follow') && spend()) {
      G.fxAdd({ k: 'xslash', x: e.x, y: e.y - 8, ang: .78, r: 22, dur: .25, lv: 8 }); G.fxAdd({ k: 'xslash', x: e.x, y: e.y - 8, ang: -.78, r: 22, dur: .25, lv: 8 });
      for (const t of near(e.x, e.y, 26 + 4 * L.critx, e)) G.hitEnemy(t, dmg * (.35 + .2 * L.critx), { src: 'b_critx', gen: g + 1, canCrit: false, ka: 0, kb: 40, noEl: true });
    }
  };
  // ---------------------------------------------------------- 倒した時（o＝とどめの攻撃）
  B.onKill = function (e, o) {
    const L = B.list(), H = G.hero; if (!run()) return;
    o = o || {}; const g = gen(o), x = e.x, y = e.y;
    if (L.moon) { const v = H.st.maxHp * .012 * L.moon; G.healHero && G.healHero(v); if (R() < .5) G.burst(H.x, H.y - 16, 3, ['#ff7a8a', '#ffd0d8'], 30, .4, 1, -20); }
    if (L.gold && e.elite && G.gainCoins) G.gainCoins(G.COIN.elite(G.W.f) * .6 * L.gold, x, y, true);
    if (g >= 3) return;
    // 氷の種：凍った敵を倒すと氷片
    if (L.seed && e.diedFrozen && spend()) {
      G.fxAdd({ k: 'pillar', x, y, r: 6, h: 18, dur: .45 }); G.burst(x, y - 8, 16, ['#e8f8ff', '#9fdcff', '#ffffff'], 110, .5, 1); G.sfx('freeze');
      for (const t of near(x, y, 34 + 6 * L.seed, e)) {
        const shatter = B.awake('hyoso') && t.frozen > 0; // 氷葬：凍った敵は砕ける
        if (t.frozen <= 0 && !t.boss) { t.frozen = 1 + .3 * L.seed; t.atk = false; }
        G.hitEnemy(t, atk() * (.8 + .4 * L.seed) * (shatter ? 4 : 1), { src: 'b_seed', gen: g + 1, canCrit: shatter, ka: Math.atan2(t.y - y, t.x - x), kb: 50, noEl: true });
      }
    }
    // 残心：遅れて追加の斬撃
    if (L.zanshin && spend()) delay(.22, () => {
      G.fxAdd({ k: 'xslash', x, y: y - 8, ang: R() * Math.PI, r: 26, dur: .28, lv: 10 }); G.sfx('slash2');
      for (const t of near(x, y, 24 + 4 * L.zanshin)) G.hitEnemy(t, atk() * (1 + .6 * L.zanshin), { src: 'b_zan', gen: g + 1, canCrit: true, ka: 0, kb: 30, noEl: true });
    });
    // 爆裂連鎖：ときどき爆発、爆発で倒れた敵は必ず爆発
    if (L.bomb && (o.src === 'b_bomb' || o.src === 'boom' || R() < .2 + .1 * L.bomb) && spend()) {
      const r = 22 + 6 * L.bomb;
      G.fxAdd({ k: 'boom', x, y: y - 4, r, lv: 3 + L.bomb, dur: .5 }); G.light(x, y, r * 2.2, .4, '#ffa050'); G.sfx('boom'); G.shake(1.5);
      for (const t of near(x, y, r, e)) G.hitEnemy(t, atk() * (.8 + .3 * L.bomb), { src: 'b_bomb', gen: g + 1, canCrit: false, ka: Math.atan2(t.y - y, t.x - x), kb: 70, noEl: true });
    }
    // 疾風の刃：近くの敵へ風の刃
    if (L.gale && spend()) {
      const ts = near(x, y, 130, e).sort((a, b) => G.dist(x, y, a.x, a.y) - G.dist(x, y, b.x, b.y)).slice(0, L.gale);
      for (const t of ts) { const a = Math.atan2(t.y - y, t.x - x); G.W.projs.push({ k: 'wave', src: 'b_gale', gen: g + 1, x, y: y - 8, vx: Math.cos(a) * 230, vy: Math.sin(a) * 230, ang: a, life: .7, t: 0, r: 6, dmg: atk() * (.7 + .25 * L.gale), hit: new Set(), col: '#c8ffd8', kb: 40, one: true }); }
    }
    // 覚醒：雷帝の怒り（雷で倒した敵から次の敵へ落雷）
    if (B.awake('raitei') && /chain|b_echo|b_strike|b_raitei/.test(o.src || '') && spend()) {
      const t = nearest(x, y, 100, e);
      if (t) delay(.12, () => { if (t.dead) return; G.fxAdd({ k: 'strike', x: t.x, y: t.y, dur: .4, seed: R() * 999 }); G.sfx('zap'); for (const u of near(t.x, t.y, 24)) G.hitEnemy(u, atk() * 2.2, { src: 'b_raitei', gen: g + 1, canCrit: true, ka: 0, kb: 30, noEl: true }); });
    }
    // 覚醒：剣鬼（会心で倒すと次の敵へ斬り込む）
    if (B.awake('kenki') && o.crit && spend()) {
      const t = nearest(x, y, 110, e);
      if (t) delay(.08, () => {
        if (t.dead) return; const a = Math.atan2(t.y - y, t.x - x);
        for (let i = 0; i < 4; i++) G.fxAdd({ k: 'wind', x: G.lerp(x, t.x, i / 4), y: G.lerp(y, t.y, i / 4) - 8, ang: a, len: 18, dur: .25 });
        G.fxAdd({ k: 'xslash', x: t.x, y: t.y - 8, ang: a + 1.57, r: 30, dur: .3, lv: 12 }); G.sfx('slash2');
        G.hitEnemy(t, atk() * 3, { src: 'b_kenki', gen: g + 1, canCrit: true, ka: a, kb: 60, noEl: true });
      });
    }
  };
  // ---------------------------------------------------------- 雷が伝わり終えた時
  B.onBoltEnd = function (f) {
    const L = B.list(); if (!L.echo || (f.gen || 0) >= 2 || !spend()) return;
    const last = f.pts[f.pts.length - 1];
    const from = (last.e && !last.e.dead) ? last.e : nearest(last.x, last.y + 8, 60);
    if (from) delay(.1, () => { if (!from.dead) G.chainLightning(from, 2 + L.echo, 2 + L.echo, f.dmg * (.4 + .15 * L.echo), 'b_echo', (f.gen || 0) + 1); });
  };
  // ---------------------------------------------------------- バリアが壊れた時
  B.onShieldBreak = function () {
    const L = B.list(), H = G.hero; if (!L.guard || !spend()) return;
    const fudo = B.awake('fudo'), r = 56 + 8 * L.guard;
    G.fxAdd({ k: 'ring', x: H.x, y: H.y, r, col: '#8fe3ff', dur: .5 }); G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: r * .6, col: '#ffffff', dur: .35 });
    G.sfx('boom'); G.shake(3); G.light(H.x, H.y, r * 2, .5, '#8fe3ff');
    for (const t of near(H.x, H.y, r)) G.hitEnemy(t, atk() * (1.5 + L.guard), { src: 'b_guard', gen: 1, canCrit: true, ka: Math.atan2(t.y - H.y, t.x - H.x), kb: fudo ? 320 : 160, noEl: true });
    if (fudo) { H.shield = Math.max(H.shield, H.st.maxHp * (.12 + .04 * L.guard)); G.fxAdd({ k: 'shieldUp', dur: .5 }); } // 不動の構え：すぐにバリアが戻る
  };
  // 技を使う時：狩人の歩み（歩いた距離で威力アップ）
  B.skillMul = function () {
    const L = B.list(), H = G.hero; if (!L.stride) return 1;
    const m = 1 + Math.min(1, (H.strideD || 0) / 500) * .35 * L.stride; H.strideD = 0;
    if (m > 1.15) { G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: 26, col: '#a8f060', dur: .35 }); }
    return m;
  };
  B.coinMul = () => 1 + .25 * B.lv('gold');

  // ---------------------------------------------------------- 毎フレーム
  let novaT = 3, guardT = 0, lx = null, ly = null;
  B.newFloor = () => { later.length = 0; lx = null; novaT = 3; }; // 階が変わったら、前の階の遅れた効果は捨てる
  B.reset = () => { later.length = 0; pend.length = 0; novaT = 3; guardT = 0; lx = null; lastKey = '_'; };
  // 少し後で祝福を得る（ゲーム内の時間で数える。階が変わっても消えない）
  const pend = [];
  B.gainSoon = (where, n, t) => pend.push({ where, n, t });
  B.tick = function (dt) {
    budget = Math.min(40, budget + dt * 40);
    for (let i = later.length - 1; i >= 0; i--) { const d = later[i]; d.t -= dt; if (d.t <= 0) { later.splice(i, 1); if (run() && G.W && !G.W.home) d.fn(); } }
    for (let i = pend.length - 1; i >= 0; i--) { const p = pend[i]; p.t -= dt; if (p.t <= 0 && !G.trans) { pend.splice(i, 1); if (run()) B.gain(p.where, p.n); } }
    const H = G.hero, L = B.list(); if (!run() || !H || H.dead || !G.W || G.W.home) { lx = null; return; }
    // 歩いた距離
    if (lx != null) H.strideD = (H.strideD || 0) + Math.min(20, Math.hypot(H.x - lx, H.y - ly)); lx = H.x; ly = H.y;
    if (L.stride && (H.strideD || 0) > 250 && R() < dt * 6) G.burst(H.x, H.y - 4, 1, ['#a8f060'], 20, .4, 1, -20);
    // 霜の波動
    if (L.nova) {
      novaT -= dt;
      if (novaT <= 0) {
        const ts = near(H.x, H.y, 62 + 8 * L.nova);
        if (ts.length) {
          novaT = 7 - L.nova;
          G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: 62 + 8 * L.nova, col: '#e8f8ff', dur: .55 }); G.sfx('freeze'); G.light(H.x, H.y, 120, .4, '#bfeaff');
          for (const t of ts) { if (t.frozen <= 0) { t.frozen = (1 + .3 * L.nova) * (t.boss ? .3 : 1); t.atk = false; } G.hitEnemy(t, atk() * .6 * L.nova, { src: 'b_nova', gen: 1, canCrit: false, ka: 0, kb: 20, noEl: true }); }
        } else novaT = .5;
      }
    }
    // 守護の反撃：バリアを持っていなくても、祝福でときどき張られる
    if (L.guard && !H.st.barrier) {
      guardT -= dt;
      if (guardT <= 0) { guardT = 9 - L.guard; const v = H.st.maxHp * (.08 + .04 * L.guard); if (H.shield < v * .9) { H.shield = v; G.fxAdd({ k: 'shieldUp', dur: .5 }); G.sfx('shield'); } }
    }
  };

  // ---------------------------------------------------------- 画面の表示（状態の枠の中に祝福を並べる）
  let lastKey = '';
  B.refreshHud = function () {
    const el = document.getElementById('blessRow'); if (!el) return;
    const L = B.list(), key = JSON.stringify(L) + (run() && run().awk || []).join();
    if (key === lastKey) return; lastKey = key;
    const ids = Object.keys(L);
    el.innerHTML = ids.length ? ids.map(id => { const b = G.BLESS[id], aw = G.AWAKEN.some(a => a.need.includes(id) && B.awake(a.id)); return `<span class="bl ${aw ? 'aw' : ''}" style="--c:${b.col}" title="${b.n} Lv${L[id]}">${b.ic}<i>${L[id]}</i></span>`; }).join('') : '';
    el.classList.toggle('hidden', !ids.length);
  };
})();
