'use strict';
// ===== ゲーム本体：状態・勇者AI・戦闘・戦利品 =====
(function () {
  const T = G.TILE, R = () => G.rng.next();
  let S, W, H;
  const sync = () => { S = G.S; W = G.W; H = G.hero; };
  G.sync = sync;

  // ------------------------------------------------------------ 状態
  G.newState = function () {
    return {
      v: 1, level: 1, exp: 0, hpFrac: 1, gold: 0, maxFloor: 0, lastFloor: 0, items: [], nextId: 1,
      equip: { weapon: null, head: null, body: null, feet: null, acc1: null, acc2: null },
      learned: [], skillSet: [null, null, null], skillOff: {}, // skillOff：使わない設定にした技（覚えた技は基本すべて自動で使う）
      autoSell: { on: false, maxRarity: 0, slots: { weapon: true, head: true, body: true, feet: true, acc: true }, maxAffixLv: 99, keep: [] },
      settings: { vol: .6, bgm: .5, fx: 2, dmgNum: true, shake: true, speed: 1, waitHome: false },
      mode: 'home', run: null, stats: { kills: 0, deaths: 0, runs: 0 }, rngS: 0, homeMsg: '',
      // ガチャ・キャラクター：共通のコイン・素材・天井、選択中のキャラ、キャラごとの育成状況
      coins: 0, mats: { forge: 0, soul: 0 }, pity: 0, gachaSeq: 1, gachaLast: null, autoDis: { on: false, maxRar: 1 },
      cur: 'hero', chars: { hero: { own: true, star: 1 } },
      daily: null, login: { last: '', streak: 0 },
      newsSeen: 0, // 読んだお知らせの一番新しい番号
    };
  };
  G.initNewGame = function () {
    G.S = G.newState(); sync();
    G.itemMap = new Map();
    const rng = new G.RNG(12345);
    const sw = G.genItem(1, rng, { slot: 'weapon', rar: 0, base: 0 });
    const bd = G.genItem(1, rng, { slot: 'body', rar: 0, base: 0 });
    for (const it of [sw, bd]) { it.nw = false; G.addItemRaw(it); }
    S.equip.weapon = sw.id; S.equip.body = bd.id;
  };

  // ------------------------------------------------------------ 装備品
  G.itemMap = new Map();
  G.rebuildItemMap = () => { G.itemMap.clear(); for (const it of G.S.items) G.itemMap.set(it.id, it); };
  G.itemById = id => G.itemMap.get(id);
  G.addItemRaw = it => { G.S.items.push(it); G.itemMap.set(it.id, it); };
  G.isEquipped = id => { for (const s of G.SLOTS) if (G.S.equip[s] === id) return s; return null; };
  G.itemMaxAf = it => it.af.reduce((m, a) => Math.max(m, a.lv), 0);
  G.itemScore = it => {
    const s = it.st;
    let v = (s.atk || 0) * 3 + (s.def || 0) * 2.2 + (s.hp || 0) * .35 + (s.aspd || 0) * 120 + (s.mspd || 0) * 150 + (s.crit || 0) * 400;
    for (const a of it.af) v += a.lv * (6 + it.f * 1.2);
    if (it.set) v += 10 + it.f * 1.5; // セット装備は少し高く評価
    return Math.round(v);
  };
  G.itemValue = it => Math.round((8 + it.f * 3) * (1 + it.rar * 1.3) * (1 + it.af.reduce((s, a) => s + a.lv, 0) * .12));
  function itemName(it) {
    if (!it.af.length) return it.b;
    let top = it.af[0]; for (const a of it.af) if (a.lv > top.lv) top = a;
    let nm = G.AFX[top.k].a + it.b;
    if (it.set) nm = G.SETS[it.set].n + '・' + nm; // セット装備は名前の頭にセット名
    return it.rar === 4 ? '【極】' + nm : nm;
  }
  G.genItem = function (f, rng, o) {
    o = o || {}; rng = rng || G.rng;
    const slot = o.slot || rng.weighted([['weapon', 22], ['head', 17], ['body', 17], ['feet', 16], ['acc', 28]]);
    const bases = G.BASES[slot].filter(b => (b.min || 1) <= f);
    const b = o.base != null ? G.BASES[slot][o.base] : rng.pick(bases);
    const luck = (G.hero && G.hero.st) ? G.hero.st.luck : 1;
    const wts = [Math.max(12, 58 - 1.4 * f), 28 + .25 * f, (9 + .45 * f) * luck, (2.4 + .22 * f) * luck, (.45 + .07 * f) * luck];
    let rar = o.rar != null ? o.rar : rng.weighted(wts.map((w, i) => [i, w]));
    if (o.minRar) rar = Math.max(rar, o.minRar);
    const r = () => rng.range(.9, 1.1);
    const st = {};
    if (slot === 'weapon') { st.atk = (5 + 2.4 * f) * b.atk * r(); st.aspd = b.aspd || 0; }
    if (slot === 'head') { st.def = (1.5 + .7 * f) * b.def * r(); st.hp = (6 + 3 * f) * b.hp * r(); }
    if (slot === 'body') { st.def = (3 + 1.2 * f) * b.def * r(); st.hp = (10 + 5 * f) * b.hp * r(); }
    if (slot === 'feet') { st.def = (1 + .5 * f) * b.def * r(); st.mspd = b.mspd || 0; }
    if (slot === 'acc') {
      if (b.atk) st.atk = (1 + .8 * f) * r();
      if (b.hp) st.hp = (5 + 2.5 * f) * r();
      if (b.crit) st.crit = +(.02 + .001 * f).toFixed(3);
      if (b.def) st.def = (1 + .4 * f) * r();
    }
    for (const k of ['atk', 'def', 'hp']) if (st[k] != null) st[k] = Math.max(1, Math.round(st[k]));
    const pool = rng.shuffle(G.AFFIX_POOL[slot].slice());
    const maxL = 1 + Math.floor(f / 4), af = [];
    for (let i = 0; i < rar; i++) {
      let lv = 1 + Math.floor(Math.pow(rng.next(), 1.5) * maxL);
      if (rar >= 3 && rng.chance(.35)) lv++;
      if (rar === 4 && rng.chance(.35)) lv++;
      af.push({ k: pool[i], lv });
    }
    // セット装備：レア以上でまれに付く（勇者の証はエピック以上だけ）
    let set = null;
    if (rar >= 2 && rng.chance([0, 0, .3, .45, .6][rar])) set = rng.pick(Object.keys(G.SETS).filter(k => !G.SETS[k].rare || rar >= 3));
    const it = { id: G.S.nextId++, slot, b: b.n, rar, f, st, af, fav: false, t: Date.now(), nw: true };
    if (set) it.set = set;
    it.name = itemName(it);
    return it;
  };

  // ------------------------------------------------------------ 能力値
  G.calcStats = function (equip, level) {
    const L = level || G.S.level;
    const st = { hp: 90 + 14 * (L - 1), atk: 9 + 2.2 * (L - 1), def: 2 + .9 * (L - 1), aspd: 1.9, mspd: 112, crit: .05, critd: 1.5 };
    let aspdPct = 0, mspdPct = 0;
    const fx = {}, sets = {};
    for (const s of G.SLOTS) {
      const id = equip[s]; if (id == null) continue;
      const it = G.itemById(id); if (!it) continue;
      const b = it.st, em = 1 + .1 * (it.enh || 0); // 強化：+1ごとに基礎性能+10%
      st.hp += (b.hp || 0) * em; st.atk += (b.atk || 0) * em; st.def += (b.def || 0) * em; st.crit += b.crit || 0;
      aspdPct += b.aspd || 0; mspdPct += b.mspd || 0;
      for (const a of it.af) fx[a.k] = (fx[a.k] || 0) + a.lv; // 同じ効果のレベルは合算
      if (it.set) sets[it.set] = (sets[it.set] || 0) + 1;
    }
    // セット効果：揃えた数に応じて付与効果のレベルを足し、割合の上昇はあとでまとめて掛ける
    const P = {};
    for (const k in sets) for (const need in G.SETS[k].b) if (sets[k] >= +need) {
      const bn = G.SETS[k].b[need];
      for (const a in bn.fx || {}) fx[a] = (fx[a] || 0) + bn.fx[a];
      for (const p in bn.pct || {}) P[p] = (P[p] || 0) + bn.pct[p];
    }
    const l = k => fx[k] || 0;
    st.hp *= 1 + .06 * l('vit'); st.atk *= 1 + .06 * l('str');
    st.def = (st.def + l('grd')) * (1 + .08 * l('grd'));
    st.aspd *= 1 + aspdPct + Math.min(1.5, .05 * l('haste'));
    st.crit = Math.min(.85, st.crit + Math.min(.7, .025 * l('crit')));
    st.critd += .12 * l('critd');
    st.reach = 20 * (1 + Math.min(1, .06 * l('reach')));
    st.area = 1 + Math.min(1.5, .08 * l('area'));
    st.mspd *= 1 + mspdPct + Math.min(1, .05 * l('swift'));
    st.cdr = Math.min(.6, .05 * l('cdr')); st.spow = 1 + .1 * l('spow');
    st.recast = l('recast') ? Math.min(.6, .05 + .04 * l('recast')) : 0;
    st.expMul = 1 + .08 * l('learn'); st.luck = 1 + .08 * l('luck');
    st.regen = l('regen') ? Math.min(.05, .004 + .003 * l('regen')) : 0;
    st.barrier = l('barrier') ? Math.min(.8, .08 + .04 * l('barrier')) : 0; st.barrierLv = l('barrier');
    st.leech = l('leech') ? Math.min(.2, .01 + .008 * l('leech')) : 0;
    st.chainLv = l('chain'); st.chainCh = Math.min(.6, .2 + .03 * st.chainLv); st.chainN = G.CHAIN_N(st.chainLv); st.chainDmg = .4 + .08 * st.chainLv;
    st.followLv = l('follow'); st.followCh = Math.min(.9, .35 + .05 * st.followLv); st.followN = 1 + Math.floor(st.followLv / 3); st.followDmg = .3 + .06 * st.followLv;
    st.boomLv = l('boom'); st.boomR = Math.min(80, 22 + 4 * st.boomLv); st.boomDmg = .5 + .15 * st.boomLv;
    st.burnLv = l('burn'); st.burnCh = Math.min(.8, .25 + .05 * st.burnLv); st.burnDps = .15 + .05 * st.burnLv;
    st.poisonLv = l('poison'); st.poisonCh = Math.min(.9, .3 + .05 * st.poisonLv); st.poisonDps = .08 + .03 * st.poisonLv;
    st.frostLv = l('frost'); st.frostCh = Math.min(.4, .08 + .02 * st.frostLv); st.frostDur = Math.min(3, .8 + .1 * st.frostLv);
    // キャラごとの能力の倍率と限界突破（★）
    const ch = G.CHARS[G.S.cur] || G.CHARS.hero, cb = ch.base, sm = G.STAR_STAT[G.curStar()];
    st.hp *= cb.hp * sm; st.atk *= cb.atk * sm; st.def *= cb.def * sm; st.aspd *= cb.aspd; st.crit += cb.crit || 0; st.critd += cb.critd || 0;
    if (ch.ranged) { st.ranged = true; st.reach = 105 * (1 + Math.min(.5, .03 * l('reach'))); } // 遠距離の通常攻撃
    // セット効果の割合上昇
    st.hp *= 1 + (P.hp || 0); st.atk *= 1 + (P.atk || 0); st.def *= 1 + (P.def || 0); st.aspd *= 1 + (P.aspd || 0); st.mspd *= 1 + (P.mspd || 0);
    st.crit = Math.min(.9, st.crit + (P.crit || 0)); st.critd += P.critd || 0; st.cdr = Math.min(.7, st.cdr + (P.cdr || 0)); st.spow += P.spow || 0; st.expMul += P.expMul || 0;
    st.maxHp = Math.round(st.hp); st.atk = Math.round(st.atk * 10) / 10; st.def = Math.round(st.def * 10) / 10;
    st.fx = fx; st.sets = sets;
    return st;
  };
  // 技の強さ（技レベルと進化段階から）：威力倍率・再使用時間・範囲・連撃数
  G.skillInfo = function (id, L, st) {
    st = st || (G.hero && G.hero.st);
    const sk = G.SKILLS[id], lv = G.skillLvAt(id, L || G.S.level), stage = G.skillStageOf(lv), k = Math.max(0, lv - 1);
    return {
      lv, stage, name: G.skillEvo(id).names[stage], kind: sk.kind || id, el: sk.el || null, ex: G.starExtra(G.curStar()),
      mult: sk.mult * (1 + .08 * k + .3 * stage) * G.starSkillMul(G.curStar()), // ★3・★5で技も強化
      cd: Math.max(.8, sk.cd * (1 - Math.min(.3, .02 * k)) * (1 - (st ? st.cdr : 0))),
      area: 1 + .03 * k + .15 * stage + .15 * G.starExtra(G.curStar()),
    };
  };
  // 技の進化の名前と強化内容（キャラ専用技は動きの種類（kind）の強化内容を使う）
  G.skillEvo = id => { const sk = G.SKILLS[id], base = G.SKILL_EVO[sk.kind || id]; return { names: sk.evo || base.names, up: base.up }; };
  // 総合力：攻撃の強さ（DPS）×打たれ強さ（実質HP）×技・追加効果の強さ。レベル・装備・セット・技の進化で伸びる
  G.powerOf = function (st, L) {
    L = L || G.S.level;
    const dps = st.atk * st.aspd * (1 + Math.min(.9, st.crit) * (st.critd - 1));
    let procs = 0; for (const k of ['chain', 'follow', 'boom', 'burn', 'poison', 'frost']) procs += st.fx[k] || 0;
    let sk = 0;
    for (const id of G.charSkills()) {
      if (!G.skillLvAt(id, L) || (G.S.skillOff || {})[id]) continue;
      const I = G.skillInfo(id, L, st); sk += I.mult * st.spow / I.cd * (1 + I.stage * .5);
    }
    const ehp = st.maxHp * (1 + st.def / 40) * (1 + (st.regen || 0) * 20 + (st.barrier || 0) * .5 + (st.leech || 0) * 3);
    return Math.round(dps * (1 + procs * .06 + sk * .6) * ehp);
  };
  // 装備変更時：HP割合を維持して再計算
  G.recalc = function () {
    sync(); if (!H) return;
    const ratio = H.st ? H.hp / H.st.maxHp : 1;
    H.st = G.calcStats(S.equip);
    H.hp = Math.max(1, Math.min(H.st.maxHp, ratio * H.st.maxHp));
    if (!H.st.barrier) H.shield = 0; else H.shield = Math.min(H.shield, H.st.barrier * H.st.maxHp);
  };

  // ------------------------------------------------------------ 勇者
  G.makeHero = function () {
    G.hero = {
      x: 0, y: 0, vx: 0, vy: 0, dvx: 0, dvy: 0, face: 1, r: 5, hp: 1, st: null, act: null, atkCd: 0, combo: 0, cds: {},
      shield: 0, shieldT: 2, target: null, goal: null, path: null, pi: 0, pathKey: -1, pathHero: -1, thinkT: 0, exT: -1,
      flash: 0, hurtT: 0, hitstop: 0, dead: false, deadT: 0, stuckT: 0, lastX: 0, lastY: 0,
      anim: { t: 0, walk: 0, mv: 0, swA: -.75, armA: 1, hop: 0, lean: 0, hy: 0, blinkT: 2, blink: 0 },
      cape: [], after: [], afterT: 0,
    };
    sync();
    H.st = G.calcStats(S.equip);
    H.hp = H.st.maxHp * G.clamp(S.hpFrac, .01, 1);
  };
  function resetCape() {
    H.cape = [];
    for (let i = 0; i < 5; i++) { const x = H.x - H.face * 3.5 - H.face * i * .8, y = H.y - 15 + i * 3; H.cape.push({ x, y, px: x, py: y }); }
  }
  G.resetCape = () => { sync(); resetCape(); };

  // ------------------------------------------------------------ 地形判定
  const tileOf = (x, y) => Math.floor(y / T) * W.D.W + Math.floor(x / T);
  G.tileOf = (x, y) => tileOf(x, y);
  function solid(px, py) {
    const D = W.D, tx = Math.floor(px / T), ty = Math.floor(py / T);
    if (tx < 0 || ty < 0 || tx >= D.W || ty >= D.H) return true;
    return D.tiles[ty * D.W + tx] !== 1;
  }
  function boxHit(x, y, r) { const ry = r * .6; return solid(x - r, y - ry) || solid(x + r, y - ry) || solid(x - r, y + ry) || solid(x + r, y + ry); }
  function moveBody(e, dx, dy) {
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 5));
    const sx = dx / steps, sy = dy / steps; let hit = false;
    for (let i = 0; i < steps; i++) {
      if (sx) { if (!boxHit(e.x + sx, e.y, e.r)) e.x += sx; else hit = true; }
      if (sy) { if (!boxHit(e.x, e.y + sy, e.r)) e.y += sy; else hit = true; }
    }
    return hit;
  }
  function losPx(x0, y0, x1, y1) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 6);
    for (let i = 1; i < n; i++) if (solid(x0 + dx * i / n, y0 + dy * i / n)) return false;
    return true;
  }
  function clearWalk(x0, y0, x1, y1, r) {
    const dx = x1 - x0, dy = y1 - y0, n = Math.ceil(Math.hypot(dx, dy) / 4);
    for (let i = 1; i <= n; i++) if (boxHit(x0 + dx * i / n, y0 + dy * i / n, r)) return false;
    return true;
  }
  G.losPx = (a, b, c, d) => losPx(a, b, c, d);

  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  function bfsHero(sx, sy) {
    const D = W.D, dist = W.dist, q = W.q, Wd = D.W;
    dist.fill(-1);
    const s = sy * Wd + sx; if (D.tiles[s] !== 1) return;
    let h = 0, t = 0; dist[s] = 0; q[t++] = s;
    while (h < t) {
      const c = q[h++], cx = c % Wd, cy = (c / Wd) | 0;
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= Wd || ny >= D.H) continue;
        const ni = ny * Wd + nx;
        if (D.tiles[ni] !== 1 || dist[ni] >= 0) continue;
        if (dx && dy && (D.tiles[cy * Wd + nx] !== 1 || D.tiles[ny * Wd + cx] !== 1)) continue;
        dist[ni] = dist[c] + 1; q[t++] = ni;
      }
    }
  }
  // 勇者の現在タイルから目標タイルまでの経路
  function pathFromHero(tx, ty) {
    const D = W.D, Wd = D.W, dist = W.dist;
    let c = ty * Wd + tx;
    if (dist[c] < 0) return null;
    const out = [];
    let guard = 0;
    while (dist[c] > 0 && guard++ < 999) {
      out.push(c);
      const cx = c % Wd, cy = (c / Wd) | 0;
      let best = -1, bd = dist[c];
      for (let k = 0; k < 8; k++) {
        const dx = DIRS[k][0], dy = DIRS[k][1], nx = cx + dx, ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= Wd || ny >= D.H) continue;
        const ni = ny * Wd + nx;
        if (dist[ni] < 0 || dist[ni] >= bd) continue;
        if (dx && dy && (D.tiles[cy * Wd + nx] !== 1 || D.tiles[ny * Wd + cx] !== 1)) continue;
        bd = dist[ni]; best = ni;
      }
      if (best < 0) break;
      c = best;
    }
    out.reverse();
    return out.map(i => ({ x: (i % Wd) * T + 8, y: ((i / Wd) | 0) * T + 8 }));
  }
  function losTile(x0, y0, tx, ty) {
    const D = W.D, x1 = tx * T + 8, y1 = ty * T + 8, dx = x1 - x0, dy = y1 - y0;
    const n = Math.ceil(Math.hypot(dx, dy) / 5), target = ty * D.W + tx;
    for (let i = 1; i < n; i++) {
      const px = x0 + dx * i / n, py = y0 + dy * i / n;
      const ti = Math.floor(py / T) * D.W + Math.floor(px / T);
      if (ti === target) return true;
      if (D.tiles[ti] !== 1) return false;
    }
    return true;
  }
  function revealAround(i) {
    const D = W.D, cx = i % D.W, cy = (i / D.W) | 0;
    for (let j = -1; j <= 1; j++) for (let k = -1; k <= 1; k++) {
      const nx = cx + k, ny = cy + j; if (nx < 0 || ny < 0 || nx >= D.W || ny >= D.H) continue;
      const ni = ny * D.W + nx; if (D.tiles[ni] !== 1) { W.explored[ni] = 1; W.vis[ni] = 1; }
    }
  }
  G.onTileChange = function (force) {
    sync();
    const D = W.D, tx = Math.floor(H.x / T), ty = Math.floor(H.y / T), ti = ty * D.W + tx;
    if (ti === W.heroTile && !force) return;
    W.heroTile = ti;
    bfsHero(tx, ty);
    const rid = D.roomId[ti];
    if (rid >= 0 && !W.roomSeen[rid]) {
      W.roomSeen[rid] = 1;
      const r = D.rooms[rid];
      for (let j = r.y - 1; j <= r.y + r.h; j++) for (let k = r.x - 1; k <= r.x + r.w; k++) W.explored[j * D.W + k] = 1;
      if (r.mh && !force) {
        // モンスターハウス：部屋の敵が一斉に目覚める
        let n = 0;
        for (const e of W.enemies) {
          if (e.dead) continue;
          const ex = Math.floor(e.x / T), ey = Math.floor(e.y / T);
          if (ex >= r.x && ex < r.x + r.w && ey >= r.y && ey < r.y + r.h) { e.awake = true; e.cd = .4 + R() * .8; e.hopT = .3 + R() * .25; n++; }
        }
        if (n >= 6) { G.ui.toast('モンスターハウスだ！'); G.shake(3); G.sfx('alarm'); W.mhActive = r; }
      }
    }
    W.vis.fill(0);
    const RAD = 7;
    for (let dy = -RAD; dy <= RAD; dy++) for (let dx = -RAD; dx <= RAD; dx++) {
      if (dx * dx + dy * dy > RAD * RAD + 2) continue;
      const nx = tx + dx, ny = ty + dy; if (nx < 0 || ny < 0 || nx >= D.W || ny >= D.H) continue;
      if (!losTile(H.x, H.y - 4, nx, ny)) continue;
      const i = ny * D.W + nx; W.vis[i] = 1; W.explored[i] = 1;
      if (D.tiles[i] === 1) revealAround(i);
    }
    W.fogDirty = true; W.miniDirty = true;
  };

  // ------------------------------------------------------------ 冒険の流れ
  function newWorld(D) {
    const n = D.W * D.H;
    G.W = {
      D, f: D.f, enemies: [], chests: [], drops: [], projs: [], fx: [], parts: [], nums: [], booms: [], follows: [], lights: [],
      explored: new Uint8Array(n), vis: new Uint8Array(n), dist: new Int16Array(n), q: new Int32Array(n),
      roomSeen: new Uint8Array(D.rooms.length), heroTile: -1, chunks: new Map(), fogCv: G.canvas(D.W, D.H),
      fogDirty: true, miniDirty: true, complete: false, time: 0, boss: null,
    };
    sync();
  }
  function mkEnemy(type, x, y, o) {
    o = o || {};
    const d = G.ENEMY[type], f = W.f, tier = W.D.tier;
    const mult = o.boss ? 14 : o.elite ? 3.5 : 1, am = o.boss ? 1.7 : o.elite ? 1.4 : 1;
    const e = {
      type, d, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: o.boss ? Math.min(11, d.r * 1.6) : d.r,
      maxHp: Math.round(d.hp * G.fHp(f) * mult), atkV: d.atk * G.fAtk(f) * am,
      exp: Math.round(d.exp * G.fExp(f) * (o.boss ? 14 : o.elite ? 3 : 1)), elite: !!o.elite, boss: !!o.boss, tier,
      awake: false, cd: .5 + R(), atk: false, atkT: 0, atkDone: false, flash: 0, hitstop: 0, frozen: 0, burn: null, poison: null,
      dead: false, deadT: 0, t: R() * 10, face: R() < .5 ? 1 : -1, wx: x, wy: y, wanderT: R() * 3, spd: d.spd * 1.25 * (o.boss ? .9 : 1) * (0.92 + R() * .16),
      name: (G.TIER_PREFIX[tier] || '') + d.n, lunge: 0, shake: 0, hpShow: 0,
    };
    if (o.boss) e.name = '階層の主 ' + e.name;
    e.hp = o.hp != null ? Math.min(o.hp, e.maxHp) : e.maxHp;
    if (boxHit(e.x, e.y, e.r)) { e.x = Math.floor(x / T) * T + 8; e.y = Math.floor(y / T) * T + 8; }
    return e;
  }
  G.enterFloor = function (f, snap) {
    sync();
    const run = S.run; run.floor = f;
    const D = G.genFloor(f, G.floorSeed(run.seed, f));
    newWorld(D);
    if (snap) {
      W.explored = G.unpackBits(snap.explored, D.W * D.H);
      if (snap.roomSeen) snap.roomSeen.forEach((v, i) => { if (i < W.roomSeen.length) W.roomSeen[i] = v; });
      for (const e of snap.enemies) W.enemies.push(mkEnemy(e.t, e.x, e.y, { hp: e.hp, elite: e.el, boss: e.bo }));
      D.chests.forEach((c, i) => W.chests.push({ x: c.x, y: c.y, mimic: c.mimic, opened: !!(snap.chests && snap.chests[i]), hidden: c.mimic && !!(snap.chests && snap.chests[i]), openT: 1 }));
      for (const d of snap.drops || []) W.drops.push({ it: d.it, x: d.x, y: d.y, z: 0, vz: 0, vx: 0, vy: 0, t: 1 });
      H.x = snap.hx; H.y = snap.hy; H.cds = snap.cds || {}; H.shield = snap.shield || 0; H.ult = snap.ult || 0;
      if (boxHit(H.x, H.y, H.r)) { H.x = D.start.tx * T + 8; H.y = D.start.ty * T + 8; }
    } else {
      for (const e of D.enemies) W.enemies.push(mkEnemy(e.type, e.x, e.y, e));
      for (const c of D.chests) W.chests.push({ x: c.x, y: c.y, mimic: c.mimic, opened: false, openT: 0 });
      H.x = D.start.tx * T + 8; H.y = D.start.ty * T + 10;
    }
    W.boss = W.enemies.find(e => e.boss) || null;
    // この階の敵スプライト・色違いを事前生成（初遭遇時のカクつき防止。暗転中に行う）
    if (W.boss) G.enemySpr(W.boss.type, D.tier, true);
    for (const type in G.ENEMY) {
      const sp = G.enemySpr(type, D.tier);
      if (G.tintFor) for (const s of sp.frames) G.tintFor(s, '#7fe04a');
    }
    H.vx = H.vy = 0; H.act = null; H.target = null; H.goal = null; H.path = null; H.exT = -1; H.dead = false;
    resetCape();
    G.cam.x = H.x; G.cam.y = H.y;
    G.prepareChunks(W, H.x, H.y); // 地形の塊を事前生成（暗転中）
    G.onTileChange(true);
    // 最深記録の更新を告知
    if (f > S.maxFloor && S.maxFloor > 0 && !snap) setTimeout(() => { G.ui.toast('最深記録更新！ B' + f + 'F'); G.sfx('learn'); }, 1400);
    if (f > S.maxFloor) S.maxFloor = f;
    S.lastFloor = f;
    const rs = G.runStats(); if (!snap) rs.floorT = 0;
    if (!snap) G.ui && G.ui.banner('B' + f + 'F', D.theme.n + (f % 5 === 0 ? '　― 階層の主が待つ ―' : ''));
    G.save();
  };
  G.setupHome = function () {
    sync();
    newWorld(G.genHome());
    W.explored.fill(1); W.vis.fill(1); W.home = true;
    H.x = 7 * T + 4; H.y = 6 * T + 10; H.face = 1; H.vx = H.vy = 0; H.act = null; H.dead = false; H.target = null; H.goal = null;
    H.hp = H.st.maxHp; H.shield = 0; H.cds = {}; H.flash = 0;
    W.fire = { x: 9 * T + 4, y: 6 * T + 10 };
    resetCape();
    G.cam.x = H.x + 8; G.cam.y = H.y - 8;
    G.prepareChunks(W, H.x, H.y);
    W.fogDirty = true;
    G.homeT = 3.5; H.ult = 0; H.act = null; // ホームに戻ると必殺技ゲージはリセット
    G.music.play('home');
  };
  G.depart = function (resume) {
    sync();
    if (G.trans) return;
    G.sfx('depart');
    G.manualStart = false;
    const rr = resume && G.resumeRun; G.resumeRun = null;
    G.transition(() => {
      S.mode = 'dungeon';
      if (rr) { S.run = rr; G.enterFloor(rr.floor, rr.snap); } // 中断した挑戦の続きから
      else {
        S.stats.runs++;
        S.run = { seed: (R() * 4294967296) >>> 0, floor: 1, rs: { kills: 0, items: 0, best: 0, t: 0, floorT: 0 } };
        H.hp = H.st.maxHp; H.cds = {}; H.shield = 0; H.ult = 0; // 出撃開始時は必殺技ゲージ0
        G.enterFloor(1);
      }
      G.ui.onMode();
    });
  };
  G.goHome = function (msg) {
    sync();
    G.transition(() => {
      // 今回の挑戦の戦績を記録してホームで表示
      const rs = S.run && S.run.rs;
      S.lastRun = rs ? { floor: W.f, kills: rs.kills, items: rs.items, best: rs.best, t: Math.round(rs.t), coins: rs.coins || 0 } : null;
      S.mode = 'home'; S.run = null; S.homeMsg = msg || '';
      G.setupHome();
      G.ui.onMode();
      G.save();
    }, 1.4);
  };
  // 途中帰還：探索をやめてホームへ。今の階の様子を残しておき、ホームの「続きから出撃」で同じ階から再開できる
  G.retreat = function () {
    sync();
    if (S.mode !== 'dungeon' || G.trans || !S.run || H.dead || W.home) return;
    G.save(); // 今の階の様子（snap）を記録
    const run = S.run, f = W.f;
    G.sfx('depart');
    G.transition(() => {
      const rs = run.rs;
      S.lastRun = rs ? { floor: f, kills: rs.kills, items: rs.items, best: rs.best, t: Math.round(rs.t), coins: rs.coins || 0 } : null;
      S.mode = 'home'; S.homeMsg = 'B' + f + 'F から帰還した（続きから再出撃できます）';
      G.resumeRun = run; G.manualStart = true; // 帰ってきた時は自動で出撃しない
      G.setupHome();
      G.ui.onMode();
      G.save();
    }, 1.0);
  };
  G.descend = function () {
    sync();
    if (G.trans) return;
    G.sfx('stairs'); G.music.jingle('clear');
    const nf = W.f + 1, ft = Math.round(G.runStats().floorT); G.dailyAdd('floors', 1);
    G.ui.toast('B' + W.f + 'F 踏破　' + Math.floor(ft / 60) + ':' + String(ft % 60).padStart(2, '0'));
    G.transition(() => { G.enterFloor(nf); }, 1.0);
  };
  G.transition = function (fn, dur) { G.trans = { t: 0, dur: dur || 1.0, fn, fired: false }; };
  G.snapshotRun = function () {
    sync();
    return {
      explored: G.packBits(W.explored), roomSeen: Array.from(W.roomSeen),
      enemies: W.enemies.filter(e => !e.dead).map(e => ({ t: e.type, x: Math.round(e.x), y: Math.round(e.y), hp: Math.ceil(e.hp), el: e.elite ? 1 : 0, bo: e.boss ? 1 : 0 })),
      chests: W.chests.map(c => c.opened ? 1 : 0), drops: W.drops.map(d => ({ x: Math.round(d.x), y: Math.round(d.y), it: d.it })),
      hx: Math.round(H.x), hy: Math.round(H.y), cds: H.cds, shield: H.shield, ult: H.ult || 0,
    };
  };

  // ------------------------------------------------------------ 演出ヘルパー
  G.cam = { x: 0, y: 0 };
  G.combo = { n: 0, t: 0, best: 0, pop: 0, burst: 0, burstT: 0 };
  const dummyRs = { kills: 0, items: 0, best: 0, t: 0, floorT: 0 };
  G.runStats = () => { const r = G.S.run; if (!r) return dummyRs; return r.rs || (r.rs = { kills: 0, items: 0, best: 0, t: 0, floorT: 0 }); };
  G.shakeA = 0;
  const fxCap = () => [120, 350, 800][G.S.settings.fx];
  G.part = function (x, y, vx, vy, life, col, size, grav, drag) {
    if (!W || W.parts.length >= fxCap()) return;
    W.parts.push({ x, y, vx, vy, t: 0, life, col, s: size || 1, g: grav || 0, dr: drag == null ? 2 : drag });
  };
  G.burst = function (x, y, n, cols, spd, life, size, grav) {
    const k = [.4, .75, 1][G.S.settings.fx];
    n = Math.ceil(n * k);
    for (let i = 0; i < n; i++) {
      const a = R() * Math.PI * 2, s = spd * (.3 + R() * .7);
      G.part(x, y, Math.cos(a) * s, Math.sin(a) * s * .75 - (grav ? spd * .3 : 0), life * (.6 + R() * .6), cols[(R() * cols.length) | 0], size, grav);
    }
  };
  // 見た目だけのエフェクトは上限を設ける（ダメージを運ぶ雷は常に処理する）
  G.fxAdd = o => { if (W) { o.t = 0; if (o.dmg != null || W.fx.length < [60, 110, 160][G.S.settings.fx]) W.fx.push(o); } return o; };
  G.light = (x, y, r, dur, col) => { if (W) { if (W.lights.length > 14) W.lights.shift(); W.lights.push({ x, y, r, t: 0, dur, col }); } };
  G.shake = a => { if (G.S.settings.shake) G.shakeA = Math.max(G.shakeA, a); };
  // 一瞬のスロー（見せ場で時間をゆっくりにする）：t 秒間、速さ k 倍
  G.slowT = 0; G.slowK = 1;
  G.slowmo = (t, k) => { G.slowT = Math.max(G.slowT, t); G.slowK = Math.min(G.slowT > t ? G.slowK : 1, k); };
  G.num = function (x, y, v, kind, owner) {
    if (!W || !G.S.settings.dmgNum) return;
    // 同じ相手・同じ種類の数値は0.3秒まとめて1つに（画面を数字で覆わない）
    for (const n of W.nums) if (n.o === owner && owner && n.k === kind && n.t < .3) { n.v += v; n.t = Math.min(n.t, .08); n.pop = 1; return; }
    if (W.nums.length > 30) W.nums.shift();
    // 近くに新しい数字があれば上へずらして重ならないようにする
    let stack = 0;
    for (const n of W.nums) if (n.t < .35 && Math.abs(n.x - x) < 14 && Math.abs(n.y - y) < 10) stack++;
    W.nums.push({ x: x + (R() - .5) * 6, y: y - Math.min(3, stack) * 7, v, k: kind, o: owner, t: 0, pop: 1, dx: (R() - .5) * 14 });
  };
  G.popText = function (x, y, text, col, size) { G.fxAdd({ k: 'text', x, y, text, col, size: size || 9, dur: 1.3 }); };

  // ------------------------------------------------------------ 経験値・レベル
  function gainExp(v) {
    S.exp += Math.round(v * H.st.expMul);
    const L0 = S.level;
    let up = false;
    while (S.exp >= G.expNeed(S.level)) { S.exp -= G.expNeed(S.level); S.level++; up = true; }
    if (up) {
      G.recalc();
      H.hp = Math.min(H.st.maxHp, H.hp + H.st.maxHp * .3);
      G.fxAdd({ k: 'lvup', x: H.x, y: H.y, dur: 1.1 });
      H.cheerT = .8; // 剣を掲げて喜ぶ
      G.ui.callout({ text: 'LEVEL UP!', sub: 'Lv ' + S.level + '　総合力 ' + G.fmtBig(G.powerOf(H.st)), tone: 'gold', prio: 3, dur: 1.6, size: 1.1, flash: .45, flashCol: '#fff4c0' });
      G.slowmo(.25, .35); G.shake(3);
      G.light(H.x, H.y, 120, .8, '#fff0b0');
      G.burst(H.x, H.y - 14, 26, ['#fff6c0', '#ffd84d', '#ffffff'], 70, .9, 1, -40);
      G.sfx('lvup');
      checkLearn();
      // 技の成長：技Lvが上がった技を知らせ、進化した技は大きく演出する
      const evo = [], ups = [];
      for (const id of S.learned) {
        const a = G.skillLvAt(id, L0), b = G.skillLvAt(id, S.level);
        if (b > a && a > 0) { if (G.skillStageOf(b) > G.skillStageOf(a)) evo.push([id, G.skillStageOf(a), G.skillStageOf(b)]); else ups.push(G.skillInfo(id).name + ' 技Lv' + b); }
      }
      if (ups.length) setTimeout(() => G.ui.toast(ups.join('　')), 1700);
      evo.forEach(([id, s0, s1], i) => setTimeout(() => {
        const N = G.skillEvo(id).names;
        G.ui.callout({ text: '技が進化!!', sub: N[s0] + ' → ' + N[s1], tone: s1 === 2 ? 'pink' : 'blue', prio: 3.5, dur: 2, size: 1.1, flash: .5, flashCol: s1 === 2 ? '#ffd0f0' : '#d0f0ff' });
        G.sfx('learn'); G.ui.refreshSkills();
      }, 1700 + i * 2100));
      G.save();
    }
  }
  function checkLearn() {
    for (const id of G.charSkills()) {
      const sk = G.SKILLS[id];
      if (S.level >= sk.lv && !S.learned.includes(id)) {
        S.learned.push(id);
        setTimeout(() => { G.ui.toast('新しい技「' + sk.n + '」を習得！自動で使います'); G.sfx('learn'); }, 900);
        G.ui.refreshSkills();
      }
    }
  }
  G.checkLearn = () => { sync(); checkLearn(); };
  // 使う技：覚えた技すべて（OFFにしたものを除く）。強い技（習得レベルが高い順）から条件を試す
  G.activeSkills = () => G.charSkills().filter(id => G.S.learned.includes(id) && !(G.S.skillOff || {})[id]).sort((a, b) => G.SKILLS[b].lv - G.SKILLS[a].lv);

  // ------------------------------------------------------------ 戦闘
  function heal(v, show) {
    if (H.dead || v <= 0) return;
    const before = H.hp;
    H.hp = Math.min(H.st.maxHp, H.hp + v);
    if (show && H.hp - before >= 1) G.num(H.x, H.y - 36, H.hp - before, 'heal', H);
  }
  function hurtHero(amount, sx, sy) {
    if (H.dead || G.trans) return;
    let dmg = amount * 60 / (60 + H.st.def) * (.9 + R() * .2);
    dmg = Math.max(1, dmg);
    if (H.shield > 0) {
      const ab = Math.min(H.shield, dmg); H.shield -= ab; dmg -= ab;
      G.fxAdd({ k: 'shieldHit', x: H.x, y: H.y, dur: .25 });
      if (dmg <= 0) { G.sfx('shield'); return; }
    }
    H.hp -= dmg; H.flash = .12; H.hurtT = .3; H.calmT = 0;
    G.num(H.x, H.y - 36, dmg, 'hurt', H);
    G.sfx('hurt');
    if (sx != null) { const a = Math.atan2(H.y - sy, H.x - sx); moveBody(H, Math.cos(a) * 2, Math.sin(a) * 2); }
    if (H.hp <= 0) heroDie();
  }
  function heroDie() {
    H.hp = 0; H.dead = true; H.deadT = 0; H.act = null;
    S.stats.deaths++;
    G.sfx('die'); G.shake(5); G.music.stop(.8); setTimeout(() => G.music.jingle('die'), 300);
    G.burst(H.x, H.y - 14, 30, ['#cc3b2e', '#8c2420', '#f1e7cd', '#c9a26b'], 80, 1, 1, 120);
    G.ui.toast('勇者は力尽きた… B' + W.f + 'F');
    G.save();
  }
  // BGMの切り替え：ボス戦・モンスターハウスは激しい曲、それ以外はエリアごとのダンジョン曲
  function updMusic(dt) {
    G.musicT = (G.musicT || 0) - dt;
    if (G.musicT > 0) return;
    G.musicT = .4;
    if (!W || W.home || H.dead || G.trans) return;
    const bossOn = W.boss && W.boss.awake && !W.boss.dead;
    let danger = bossOn;
    if (!danger && W.mhActive) {
      const r = W.mhActive; let n = 0;
      for (const e of W.enemies) {
        if (e.dead || !e.awake) continue;
        const ex = Math.floor(e.x / T), ey = Math.floor(e.y / T);
        if (ex >= r.x - 1 && ex <= r.x + r.w && ey >= r.y - 1 && ey <= r.y + r.h) n++;
      }
      if (n >= 3) danger = true; else W.mhActive = null;
    }
    if (bossOn && !W.roared) { W.roared = true; G.sfx('roar'); G.shake(4); G.ui.banner('階層の主 出現', W.boss.name.replace('階層の主 ', '')); G.light(W.boss.x, W.boss.y, 120, 1, '#ff6040'); }
    if (danger) G.music.play('boss');
    else G.music.play('dungeon', Math.floor((W.f - 1) / 5));
  }
  function wake(e) {
    if (e.awake) return;
    e.awake = true;
    for (const o of W.enemies) if (!o.awake && !o.dead && G.dist(o.x, o.y, e.x, e.y) < 90) { o.awake = true; o.cd = .3 + R() * .8; }
  }
  // 敵へのダメージ。proc=true の攻撃だけが付与効果を発動（派生攻撃からの無限再発動を防ぐ）
  function hitEnemy(e, base, o) {
    if (e.dead) return 0;
    let dmg = base, crit = false;
    if (o.canCrit !== false && R() < H.st.crit) { dmg *= H.st.critd; crit = true; }
    dmg *= (.92 + R() * .16) * (e.d.armor || 1);
    dmg = Math.max(1, dmg);
    e.hp -= dmg; e.hpShow = 2.5;
    wake(e);
    if (o.src !== 'burn' && o.src !== 'poison') {
      e.flash = .09; e.hitstop = crit ? .09 : .055; e.shake = .12;
      if (o.kb) { const res = e.boss ? .15 : e.d.heavy ? .3 : 1; e.kx += Math.cos(o.ka) * o.kb * res; e.ky += Math.sin(o.ka) * o.kb * res; }
    }
    const kind = crit ? 'crit' : o.src === 'atk' ? 'n' : o.src;
    if (crit && (o.src === 'atk' || o.src === 'skill')) { G.shake(1.2); G.sfx('crit'); }
    // インパクト線（命中方向へ放射状に走る）
    if (o.src === 'atk' || o.src === 'skill' || o.src === 'follow') G.fxAdd({ k: 'impact', x: e.x, y: e.y - (e.boss ? 14 : 7), ang: o.ka || 0, crit, dur: crit ? .2 : .13, seed: R() * 99 });
    G.num(e.x, e.y - (e.boss ? 44 : 22), dmg, kind, e);
    if (o.proc) procs(e);
    // 属性（キャラ専用技）：雷＝連鎖、氷＝凍結、居合＝追加の斬撃。通常攻撃にもキャラの属性が弱めに乗る
    const ult = H.act && H.act.k === 'ult';
    let el = o.el !== undefined ? o.el : (o.src === 'skill' && H.act ? H.act.el : null), ch = 1;
    if (!el && o.src === 'atk') { el = ELP[G.S.cur]; ch = .5; }
    const ex = G.starExtra(G.curStar());
    if (el && !e.dead && !o.noEl) {
      if (el === 'chain' && R() < .35 * ch) chainLightning(e, 2 + ex, 2 + 2 * ex, dmg * .35, 'chain');
      else if (el === 'freeze' && R() < .4 * ch && e.frozen <= 0) { e.frozen = (1.1 + .3 * ex) * (e.boss ? .3 : 1); e.atk = false; G.burst(e.x, e.y - 9, 8, ['#e8f8ff', '#9fdcff', '#ffffff'], 50, .45, 1); }
      else if (el === 'slash' && R() < .5 * ch) W.follows.push({ e, n: 1 + ex, t: .08, dmg: dmg * .3, x: e.x, y: e.y });
    }
    // 必殺技ゲージ：攻撃・技の命中でたまる（必殺技そのものでは増えない）
    if ((o.src === 'atk' || o.src === 'skill') && !ult) H.ult = Math.min(G.ULT.max, (H.ult || 0) + G.ULT.perHit);
    if (e.hp <= 0) killEnemy(e);
    return dmg;
  }
  G.hitEnemy = (e, b, o) => { sync(); return hitEnemy(e, b, o); };
  const ELP = { thunder: 'chain', ice: 'freeze', samurai: 'slash' }; // キャラの通常攻撃に乗る属性
  function procs(e) {
    const st = H.st;
    if (st.chainLv && R() < st.chainCh) chainLightning(e, st.chainLv, st.chainN, st.atk * st.chainDmg, 'chain');
    if (st.followLv && R() < st.followCh) W.follows.push({ e, n: st.followN, t: .07, dmg: st.atk * st.followDmg, x: e.x, y: e.y });
    if (st.burnLv && R() < st.burnCh && !e.dead) { e.burn = { t: 3, dps: st.atk * st.burnDps, tick: .4, lv: st.burnLv }; }
    if (st.poisonLv && R() < st.poisonCh && !e.dead) {
      const p = e.poison || (e.poison = { st: 0, t: 0, dps: 0, tick: .5, lv: st.poisonLv });
      p.st = Math.min(5, p.st + 1); p.t = 4; p.dps = st.atk * st.poisonDps; p.lv = st.poisonLv;
    }
    if (st.frostLv && R() < st.frostCh && !e.dead && e.frozen <= 0) {
      e.frozen = st.frostDur * (e.boss ? .35 : 1); e.atk = false;
      G.sfx('freeze');
      G.burst(e.x, e.y - 9, 10, ['#e8f8ff', '#9fdcff', '#ffffff'], 50, .5, 1);
    }
  }
  // 連鎖雷：最初に当たった敵から、近い順に最大n体へ伝わる
  function chainLightning(from, lv, n, dmg, src) {
    const pts = [{ x: from.x, y: from.y - 8, e: null }];
    const used = new Set([from]);
    let cur = from;
    const range = 64 + Math.min(40, lv * 4);
    for (let i = 0; i < n; i++) {
      let best = null, bd = range;
      for (const o of W.enemies) {
        if (o.dead || used.has(o)) continue;
        const d = G.dist(cur.x, cur.y, o.x, o.y);
        if (d < bd && W.vis[tileOf(o.x, o.y)] && losPx(cur.x, cur.y - 6, o.x, o.y - 6)) { bd = d; best = o; } // 壁越し・視界外には連鎖しない
      }
      if (!best) break;
      used.add(best); pts.push({ x: best.x, y: best.y - 8, e: best }); cur = best;
    }
    G.fxAdd({ k: 'bolt', pts, lv, dur: .32 + pts.length * .035, hop: .035, done: 0, dmg, src, seed: R() * 1000 });
    G.sfx('zap');
  }
  G.chainLightning = (a, b, c, d, e) => { sync(); chainLightning(a, b, c, d, e); };
  function killEnemy(e) {
    if (e.dead) return;
    e.dead = true; e.deadT = 0; e.frozen = 0;
    S.stats.kills++; G.dailyAdd('kills', 1);
    const rs0 = G.runStats(); rs0.kills++;
    // コンボ：2.5秒以内の連続撃破で加算。経験値ボーナス（最大+50%）
    const cb = G.combo;
    cb.n = cb.t > 0 ? cb.n + 1 : 1; cb.t = 2.5; cb.best = Math.max(cb.best, cb.n); cb.pop = 1;
    cb.burst = (cb.burstT > 0 ? cb.burst : 0) + 1; cb.burstT = .35;
    rs0.best = Math.max(rs0.best, cb.n);
    // 一掃：0.35秒以内に5体以上まとめて倒した瞬間（画面いっぱいの文字・一瞬のスロー）
    if (cb.burst === 5) { G.ui.callout({ text: '一掃!!', sub: 'まとめて薙ぎ払った！', tone: 'red', prio: 3, dur: 1.4, size: 1.25, flash: .4, flashCol: '#ffd0a0' }); G.shake(5); G.slowmo(.3, .3); G.sfx('combo', 40); }
    gainExp(e.exp * (1 + Math.min(.5, (cb.n - 1) * .02)));
    // 敵の色の破片が弾け飛ぶ
    const cols = G.enemyColors(e.type, e.tier);
    G.burst(e.x, e.y - 9, e.boss ? 50 : 16, cols.concat(['#ffffff']), e.boss ? 140 : 95, .6, 2, 150);
    G.burst(e.x, e.y - 9, e.boss ? 20 : 6, ['#ffffff', '#fff4c0'], e.boss ? 120 : 70, .3, 1, 0);
    G.fxAdd({ k: 'pop', x: e.x, y: e.y - 9, r: e.boss ? 40 : e.elite ? 22 : 13, dur: .28, col: cols[0] });
    H.hitstop = Math.max(H.hitstop, e.elite || e.boss ? .08 : .03);
    if (e.elite) G.shake(3);
    G.sfx('kill', cb.n);
    if (cb.n % 10 === 0) {
      // コンボの節目：数が増えるほど文字が大きく・色が変わり、50・100では一瞬のスロー
      G.sfx('combo', cb.n);
      const n = cb.n, tier = n >= 100 ? ['伝説の連撃！！！', 'pink', 1.35] : n >= 50 ? ['止まらない！！', 'pink', 1.25] : n >= 30 ? ['エクセレント！', 'red', 1.15] : n >= 20 ? ['グレート！', 'orange', 1.05] : ['ナイス！', 'gold', .95];
      G.ui.callout({ text: n + ' COMBO!', sub: tier[0], tone: tier[1], prio: 2, dur: 1.2, size: tier[2], flash: n >= 30 ? .3 : 0, rays: true });
      G.shake(n >= 30 ? 4 : 2.5); if (n % 50 === 0) G.slowmo(.35, .3);
    }
    if (e.elite && !e.boss) G.ui.callout({ text: '強敵撃破!', sub: e.name || (e.d && e.d.n) || '', tone: 'orange', prio: 2, dur: 1.2, size: .9, flash: .25 });
    if (H.st.leech) heal(H.st.maxHp * H.st.leech, true);
    if (H.st.boomLv && !e.exploded) { e.exploded = true; W.booms.push({ x: e.x, y: e.y - 4, t: .06, r: H.st.boomR, dmg: H.st.atk * H.st.boomDmg, lv: H.st.boomLv }); }
    // ドロップ
    const luck = H.st.luck;
    // 報酬：装備は落とさず、ガチャコインを落とす（獲得した瞬間に所持数へ反映）
    if (e.boss) {
      gainCoins(G.COIN.boss(W.f), e.x, e.y, true);
      G.ui.callout({ text: '撃破!!', sub: '階層の主を討伐した', tone: 'red', prio: 4, dur: 2.3, size: 1.4, flash: .75 }); G.shake(8); G.slowmo(.8, .22); G.music.jingle('boss');
    } else if (e.type === 'mimic') gainCoins(G.COIN.mimic(W.f), e.x, e.y, true);
    else if (e.elite) gainCoins(G.COIN.elite(W.f), e.x, e.y, true);
    else if (R() < G.COIN.enemyCh * luck) gainCoins(G.COIN.enemy(W.f) * (.7 + R() * .6), e.x, e.y);
    if (!H.act || H.act.k !== 'ult') H.ult = Math.min(G.ULT.max, (H.ult || 0) + G.ULT.perKill); // 必殺技ゲージ（必殺技での撃破では増えない）
  }
  // ガチャコイン：獲得した時点で所持数に足す（死亡しても失わない）。金色の粒が勇者へ飛ぶ
  function gainCoins(n, x, y, big) {
    n = Math.max(1, Math.round(n));
    S.coins += n; const rs = G.runStats(); rs.coins = (rs.coins || 0) + n;
    G.popText(x, y - 26, '+' + n + '枚', '#ffd84d', big ? 10 : 7);
    G.burst(x, y - 10, big ? 18 : 5, ['#ffd84d', '#fff2a0', '#e8a830'], big ? 90 : 50, .5, 1, -20);
    if (big) G.sfx('pickup', 3); else G.sfx('sell');
    G.ui.coinPop && G.ui.coinPop(n);
  }
  G.gainCoins = (n, x, y, b) => { sync(); gainCoins(n, x, y, b); };
  function spawnDrop(it, x, y) {
    const a = R() * Math.PI * 2, s = 20 + R() * 40;
    W.drops.push({ it, x, y, z: 4, vz: 90 + R() * 50, vx: Math.cos(a) * s, vy: Math.sin(a) * s * .7, t: 0 });
  }

  // ------------------------------------------------------------ 戦利品
  G.isProtected = it => it.fav || G.isEquipped(it.id) != null || it.af.some(a => G.S.autoSell.keep.includes(a.k));
  G.autoSellMatch = it => {
    const a = G.S.autoSell;
    if (G.isProtected(it)) return false; // 保護条件を売却条件より優先
    if (it.rar > a.maxRarity) return false;
    if (!a.slots[it.slot]) return false;
    if (G.itemMaxAf(it) > a.maxAffixLv) return false;
    return true;
  };
  G.sellItems = function (ids) {
    sync();
    const set = new Set(ids); let g = 0, n = 0;
    S.items = S.items.filter(it => {
      if (!set.has(it.id) || it.fav || G.isEquipped(it.id) != null) return true;
      g += G.itemValue(it); n++; G.itemMap.delete(it.id); return false;
    });
    S.gold += g;
    if (n) G.sfx('sell');
    return { n, g };
  };
  G.gainItem = function (it) {
    sync();
    if (S.autoSell.on && G.autoSellMatch(it)) {
      const v = G.itemValue(it); S.gold += v;
      G.ui.loot(it, '自動売却 +' + v + 'G');
      return;
    }
    G.addItemRaw(it);
    G.ui.loot(it);
    if (S.settings.autoEquip) G.autoEquip(); // 設定がONなら拾った時点でおすすめに付け替え
    G.runStats().items++;
    // 所持上限：保護されていない最低評価品から売却
    if (S.items.length > G.INV_CAP) {
      const cand = S.items.filter(x => !x.fav && G.isEquipped(x.id) == null).sort((a, b) => G.itemScore(a) - G.itemScore(b));
      const over = S.items.length - G.INV_CAP;
      G.sellItems(cand.slice(0, over).map(x => x.id));
    }
    G.ui.invChanged();
  };
  G.equipItem = function (slot, id) {
    sync();
    const cur = G.isEquipped(id);
    if (cur && cur !== slot) S.equip[cur] = S.equip[slot]; // アクセサリー枠同士の入れ替え
    S.equip[slot] = id;
    const it = G.itemById(id); if (it) it.nw = false;
    G.recalc(); G.save();
  };
  // おすすめ装備（部位ごとに評価値が最も高いもの）。プレイヤーがボタンを押した時だけ適用する
  G.recommendEquip = function () {
    sync();
    const plan = Object.assign({}, S.equip), used = new Set();
    for (const slot of G.SLOTS) {
      const type = G.slotType(slot);
      let best = null, bs = -1;
      for (const it of S.items) {
        if (it.slot !== type || used.has(it.id)) continue;
        const s = G.itemScore(it); if (s > bs) { bs = s; best = it; }
      }
      if (best) { plan[slot] = best.id; used.add(best.id); }
    }
    const changes = G.SLOTS.filter(s => plan[s] !== S.equip[s]);
    return { plan, changes };
  };
  // 自動装着：おすすめ（部位ごとに評価値が最も高い装備）に付け替え、変わった部位を知らせる
  G.autoEquip = function () {
    const r = G.recommendEquip(); if (!r.changes.length) return 0;
    G.applyEquip(r.plan);
    const it = G.itemById(r.plan[r.changes[0]]);
    G.ui.toast(r.changes.length > 1 ? `おすすめ装備に${r.changes.length}部位付け替え` : `${it.name} を自動装着`);
    G.sfx('pickup', 3); G.ui.upgradeCheck && G.ui.upgradeCheck();
    return r.changes.length;
  };
  G.applyEquip = function (plan) {
    sync();
    Object.assign(S.equip, plan);
    for (const s of G.SLOTS) { const it = G.itemById(S.equip[s]); if (it) it.nw = false; }
    G.recalc(); G.save();
  };
  G.unequip = function (slot) { sync(); S.equip[slot] = null; G.recalc(); G.save(); };

  // ------------------------------------------------------------ キャラクター
  // 選択中のキャラの育成状況（レベル・経験値・習得技・技の使用設定・装備）は S の直下に置き、
  // 交代する時に S.chars[キャラ] と入れ替える（既存の処理をそのまま使えるように）
  G.curChar = () => G.CHARS[(G.S && G.S.cur) || 'hero'] || G.CHARS.hero;
  G.curStar = () => { const c = G.S && G.S.chars && G.S.chars[G.S.cur]; return G.clamp((c && c.star) || 1, 1, 5); };
  G.charSkills = () => G.curChar().skills;
  // 選択中のキャラの状態を S.chars へ書き戻す（保存の前と交代の前）
  G.storeCur = function () {
    sync(); const c = S.chars[S.cur] || (S.chars[S.cur] = { own: true, star: 1 });
    Object.assign(c, { level: S.level, exp: S.exp, learned: S.learned.slice(), skillOff: Object.assign({}, S.skillOff), equip: Object.assign({}, S.equip) });
  };
  // ホームでだけ交代できる（探索中・戦闘中は不可）
  G.switchChar = function (id) {
    sync();
    if (S.mode !== 'home' || G.trans) return '探索中はキャラを交代できません';
    const c = S.chars[id]; if (!c || !c.own) return 'まだ仲間になっていません';
    if (id === S.cur) return '';
    G.storeCur();
    const prevEquip = Object.assign({}, S.equip);
    S.cur = id;
    S.level = c.level || 1; S.exp = c.exp || 0;
    S.learned = (c.learned || []).filter(k => G.CHARS[id].skills.includes(k)); S.skillOff = Object.assign({}, c.skillOff);
    // 初めて使うキャラは、今の装備をそのまま使う（同じ装備を複数のキャラで使える）
    S.equip = Object.assign({ weapon: null, head: null, body: null, feet: null, acc1: null, acc2: null }, c.equip || prevEquip);
    for (const k of G.SLOTS) if (S.equip[k] != null && !G.itemById(S.equip[k])) S.equip[k] = null; // なくなった装備は外す
    S.hpFrac = 1;
    G.makeHero(); G.checkLearn(); G.setupHome(); G.storeCur();
    G.ui.refreshSkills(); G.ui.onMode(); G.save();
    return '';
  };
  // どれかのキャラが装備に使っている装備（分解・売却できない）
  G.usedByAny = function (id) {
    if (G.isEquipped(id) != null) return true;
    for (const k in G.S.chars) { if (k === G.S.cur) continue; const e = G.S.chars[k].equip; if (e) for (const s of G.SLOTS) if (e[s] === id) return true; }
    return false;
  };

  // ------------------------------------------------------------ 分解・強化
  G.disValue = it => G.DISMANTLE[it.rar] + it.af.reduce((s, a) => s + a.lv, 0) + (it.enh || 0) * 2;
  G.dismantle = function (ids) {
    sync();
    const set = new Set(ids); let m = 0, n = 0;
    S.items = S.items.filter(it => {
      if (!set.has(it.id) || it.fav || G.usedByAny(it.id)) return true; // お気に入り・装備中は分解しない
      m += G.disValue(it); n++; G.itemMap.delete(it.id); return false;
    });
    S.mats.forge += m;
    if (n) G.sfx('sell');
    return { n, m };
  };
  G.enhance = function (id) {
    sync();
    const it = G.itemById(id); if (!it) return '装備が見つかりません';
    if ((it.enh || 0) >= G.ENH_MAX) return 'これ以上強化できません';
    const c = G.enhCost(it); if (S.mats.forge < c) return '強化素材が足りません';
    S.mats.forge -= c; it.enh = (it.enh || 0) + 1;
    G.recalc(); G.save(); G.sfx('learn');
    return '';
  };

  // ------------------------------------------------------------ ガチャ
  // 1回の操作ぶんの「コイン消費・全抽選・獲得・天井の更新」をまとめて確定して保存してから演出する。
  // 演出を飛ばしても閉じても結果は変わらず、同じ処理を二度は適用しない
  // URで出るキャラの候補：まだ持っていないピックアップキャラがいればその中から（全員そろったら全員から）
  G.gachaURPool = function () {
    const all = G.CHAR_ORDER.filter(k => G.CHARS[k].gacha), notOwn = all.filter(k => !(G.S.chars[k] && G.S.chars[k].own));
    return notOwn.length ? notOwn : all;
  };
  G.gachaPull = function (n) {
    sync();
    const GC = G.GACHA, cost = n === 10 ? GC.ten : GC.single * n;
    if (S.mode !== 'home') return { err: 'ガチャはホームで引けます' };
    if (S.coins < cost) return { err: 'コインが足りません（必要 ' + cost.toLocaleString() + '枚）' };
    if (S.items.length + n > G.INV_CAP && !S.autoDis.on) return { err: '所持品がいっぱいです。分解して空きを作ってください（' + S.items.length + '/' + G.INV_CAP + '）' };
    S.coins -= cost;
    const res = [], floor = Math.max(1, S.maxFloor);
    for (let i = 0; i < n; i++) {
      // 天井：199回続けてURが出ていなければ、この回はUR確定
      let rr;
      if (S.pity >= GC.pity - 1) rr = 'UR';
      else { let x = G.rng.next(), acc = 0; rr = 'R'; for (const [k, p] of GC.rates) { acc += p; if (x < acc) { rr = k; break; } } }
      if (rr === 'UR') {
        S.pity = 0;
        const pool = G.gachaURPool(), id = pool[Math.floor(G.rng.next() * pool.length)];
        const c = S.chars[id] || (S.chars[id] = { own: false, star: 0 });
        let kind, before = c.own ? c.star : 0;
        if (!c.own) { c.own = true; c.star = 1; c.level = 1; c.exp = 0; kind = 'new'; }
        else if (c.star < 5) { c.star++; kind = 'star'; }
        else { S.mats.soul += G.SOUL_PER_DUP; kind = 'soul'; }
        res.push({ t: 'ur', c: id, kind, from: before, star: c.star, soul: kind === 'soul' ? G.SOUL_PER_DUP : 0 });
      } else {
        S.pity++;
        let rar = GC.equipRar[rr]; if (rr === 'SSR' && G.rng.next() < GC.ssrPlus) rar = 4;
        const it = G.genItem(floor, G.rng, { rar });
        if (S.autoDis.on && it.rar <= S.autoDis.maxRar) { // 自動分解：素材にして結果一覧に表示
          const m = G.disValue(it); S.mats.forge += m;
          res.push({ t: 'eq', rr, it, dis: m });
        } else { G.addItemRaw(it); res.push({ t: 'eq', rr, it, dis: 0 }); }
      }
    }
    G.dailyAdd('pulls', n);
    const rec = { id: S.gachaSeq++, n, cost, res, pity: S.pity, seen: false };
    S.gachaLast = rec;
    if (G.recalc) G.recalc(); // ★が上がったキャラが選択中なら能力に反映
    G.save(); if (G.cloud) G.cloud.flush();
    G.ui.invChanged && G.ui.invChanged();
    return rec;
  };
  G.gachaSeen = function (id) { sync(); if (S.gachaLast && S.gachaLast.id === id) { S.gachaLast.seen = true; G.save(); } };
  // 英雄の魂（★5の重複）：選択中のキャラに経験値を与える（1個で次のレベルの必要経験値の20%）
  // ------------------------------------------------------------ デイリーミッション・ログインボーナス
  const today = () => { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
  G.today = today;
  G.daily = function () { // 日付が変わっていたら新しい日のミッションにする
    const S0 = G.S, t = today();
    if (!S0.daily || S0.daily.day !== t) S0.daily = { day: t, kills: 0, floors: 0, ults: 0, pulls: 0, claimed: {} };
    return S0.daily;
  };
  G.dailyAdd = (k, n) => { if (!G.S) return; const d = G.daily(); d[k] = (d[k] || 0) + n; };
  G.dailyDone = m => (G.daily()[m.id] || 0) >= m.need;
  G.dailyClaim = function (id) {
    sync(); const d = G.daily();
    if (d.claimed[id]) return 0;
    let r = 0;
    if (id === 'all') { if (!G.DAILY.every(m => d.claimed[m.id])) return 0; r = G.DAILY_ALL; }
    else { const m = G.DAILY.find(x => x.id === id); if (!m || !G.dailyDone(m)) return 0; r = m.reward; }
    d.claimed[id] = true; S.coins += r; G.save(); return r;
  };
  G.loginReady = () => G.S.login && G.S.login.last !== today();
  G.loginClaim = function () {
    sync(); if (!G.loginReady()) return 0;
    const t = today(), y = new Date(Date.now() - 864e5), yd = y.getFullYear() + '-' + String(y.getMonth() + 1).padStart(2, '0') + '-' + String(y.getDate()).padStart(2, '0');
    S.login.streak = S.login.last === yd ? S.login.streak + 1 : 1; S.login.last = t;
    const r = G.LOGIN(S.login.streak); S.coins += r; G.save(); return r;
  };
  G.useSoul = function (k) {
    sync(); k = Math.min(k, S.mats.soul); if (k <= 0) return 0;
    S.mats.soul -= k; gainExp(G.expNeed(S.level) * .2 * k / H.st.expMul); G.save(); return k;
  };

  // ------------------------------------------------------------ 勇者AI
  function steer(px, py, stop) {
    const dx = px - H.x, dy = py - H.y, d = Math.hypot(dx, dy);
    if (d < (stop || 1.5)) { H.dvx = H.dvy = 0; return true; }
    const sp = H.st.mspd * (H.rush ? 1.6 : 1) * (stop ? Math.min(1, (d - stop) / 10 + .3) : 1);
    H.dvx = dx / d * sp; H.dvy = dy / d * sp;
    if (Math.abs(dx) > 2) H.face = dx > 0 ? 1 : -1;
    return false;
  }
  function goTo(px, py, stop) {
    if (clearWalk(H.x, H.y, px, py, H.r)) { H.path = null; return steer(px, py, stop); }
    const key = Math.floor(px / T) + Math.floor(py / T) * 4096;
    if (!H.path || H.pathKey !== key || H.pathHero !== W.heroTile) {
      H.path = pathFromHero(Math.floor(px / T), Math.floor(py / T)); H.pi = 0; H.pathKey = key; H.pathHero = W.heroTile;
    }
    if (!H.path || !H.path.length) return steer(px, py, stop);
    let look = 0;
    while (H.pi < H.path.length - 1 && look++ < 4 && clearWalk(H.x, H.y, H.path[H.pi + 1].x, H.path[H.pi + 1].y, H.r)) H.pi++;
    const p = H.path[H.pi];
    if (G.dist(H.x, H.y, p.x, p.y) < 3 && H.pi < H.path.length - 1) H.pi++;
    steer(H.path[H.pi].x, H.path[H.pi].y, 0);
    return false;
  }
  function think() {
    const D = W.D;
    // 1. 交戦・近くの敵
    let best = null, bs = 1e9;
    for (const e of W.enemies) {
      if (e.dead) continue;
      const ti = tileOf(e.x, e.y), pd = W.dist[ti];
      if (pd < 0) continue;
      const d = G.dist(H.x, H.y, e.x, e.y);
      if (!((W.vis[ti] && d < 180) || (e.awake && pd <= 14))) continue;
      let s = pd * 10 + d * .4; if (e === H.target) s -= 25;
      if (s < bs) { bs = s; best = e; }
    }
    if (best) { H.target = best; H.goal = { k: 'enemy' }; return; }
    H.target = null;
    // 2. 近くの戦利品・宝箱
    let lt = null, ld = 1e9;
    for (const dr of W.drops) { const pd = W.dist[tileOf(dr.x, dr.y)]; if (pd >= 0 && pd < ld && pd <= 14) { ld = pd; lt = dr; } }
    for (const c of W.chests) {
      if (c.opened) continue;
      const ti = tileOf(c.x, c.y); if (!W.explored[ti]) continue;
      const pd = W.dist[ti]; if (pd >= 0 && pd < ld && pd <= 14) { ld = pd; lt = c; }
    }
    if (lt) { H.goal = { k: 'loot', x: lt.x, y: lt.y + (lt.it ? 0 : 4) }; return; }
    // 3. 未探索エリア（目標を決めたら埋まるまで維持＝往復しない）
    if (H.exT >= 0 && (W.explored[H.exT] || W.dist[H.exT] < 0)) H.exT = -1;
    if (H.exT < 0) {
      let bd = 1e9, bi = -1;
      for (let i = 0; i < W.dist.length; i++) if (D.tiles[i] === 1 && !W.explored[i]) { const dd = W.dist[i]; if (dd >= 0 && dd < bd) { bd = dd; bi = i; } }
      H.exT = bi;
    }
    if (H.exT >= 0) { H.goal = { k: 'explore', x: (H.exT % D.W) * T + 8, y: ((H.exT / D.W) | 0) * T + 8 }; return; }
    // 4. 残った敵
    let re = null, rd = 1e9;
    for (const e of W.enemies) { if (e.dead) continue; const pd = W.dist[tileOf(e.x, e.y)]; if (pd >= 0 && pd < rd) { rd = pd; re = e; } }
    if (re) { H.target = re; H.goal = { k: 'enemy' }; return; }
    // 5. 残った戦利品
    lt = null; ld = 1e9;
    for (const dr of W.drops) { const pd = W.dist[tileOf(dr.x, dr.y)]; if (pd >= 0 && pd < ld) { ld = pd; lt = dr; } }
    for (const c of W.chests) { if (c.opened) continue; const pd = W.dist[tileOf(c.x, c.y)]; if (pd >= 0 && pd < ld) { ld = pd; lt = c; } }
    if (lt) { H.goal = { k: 'loot', x: lt.x, y: lt.y + (lt.it ? 0 : 4) }; return; }
    // 6. 探索完了 → 下り階段
    if (!W.complete) { W.complete = true; G.ui.toast('探索完了！ 階段へ向かう'); G.light(D.stairs.tx * T + 8, D.stairs.ty * T + 8, 90, 1.2, '#9fdcff'); }
    H.goal = { k: 'stairs', x: D.stairs.tx * T + 8, y: D.stairs.ty * T + 8 };
  }
  // 探索状況（HUD用）
  G.progress = function () {
    sync();
    if (!W || W.home) return null;
    const D = W.D;
    let left = 0; for (const e of W.enemies) if (!e.dead) left++;
    let ch = 0; for (const c of W.chests) if (!c.opened) ch++;
    let rs = 0; for (const v of W.roomSeen) rs += v;
    return { rooms: rs, roomsT: D.rooms.length, enemies: left, chests: ch, complete: W.complete };
  };

  // 技
  const SK = G.SKILLS;
  function countNear(x, y, r) { let n = 0; for (const e of W.enemies) if (!e.dead && G.dist(x, y, e.x, e.y) <= r + e.r) n++; return n; }
  function skillCond(id, tg) {
    const d = G.dist(H.x, H.y, tg.x, tg.y), kind = SK[id].kind || id, R0 = SK[id].r || (kind === 'spin' ? 36 : 60);
    switch (kind) {
      case 'dash': return d > 34 && d < 165 && clearWalk(H.x, H.y, tg.x, tg.y, 3);
      case 'combo': return d - tg.r <= H.st.reach + 2;
      case 'spin': { const r = R0 * H.st.area * G.skillInfo(id).area; return countNear(H.x, H.y, r) >= 2 || ((tg.boss || tg.elite) && d < r); }
      case 'wave': return d < 170 && d > 12 && losPx(H.x, H.y - 6, tg.x, tg.y - 4);
      case 'thunder': return d < 150 && losPx(H.x, H.y - 6, tg.x, tg.y - 4) && (countNear(tg.x, tg.y, 64) >= 2 || tg.elite || tg.boss);
      case 'quake': { const r = R0 * H.st.area * G.skillInfo(id).area; return countNear(H.x, H.y, r * .9) >= 3 || (tg.boss && d < r * .8); }
    }
    return false;
  }
  function trySkill() {
    const tg = H.target;
    if (!tg || tg.dead) return false;
    for (const id of G.activeSkills()) { // 強い技から順に、条件を満たしたものを使う
      if (!id || (H.cds[id] || 0) > 0) continue;
      if (skillCond(id, tg)) { castSkill(id, tg, false); return true; }
    }
    return false;
  }
  const localA = a => H.face === 1 ? a : Math.PI - a;
  const worldA = l => H.face === 1 ? l : Math.PI - l;
  function setFaceTo(a) { const c = Math.cos(a); if (Math.abs(c) > .3) H.face = c > 0 ? 1 : -1; }
  function castSkill(id, tg, recast) {
    const sk = SK[id];
    const I = G.skillInfo(id), st2 = I.stage; // 技レベル・進化段階
    if (!recast) H.cds[id] = I.cd;
    const ang = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(ang);
    const kind = I.kind, ex = I.ex;
    const durs = { dash: .24, combo: .42 * (1 + .35 * st2), spin: .34 * (1 + .5 * st2), wave: .26, thunder: .36 + .12 * st2, quake: .5 * (1 + .35 * st2) };
    // k＝動きの種類、sid＝技のID、el＝属性（キャラ専用技）、ex＝★3・★5の追加段階（連鎖数・範囲・斬撃数）
    H.act = { k: kind, sid: id, el: I.el, ex, col: sk.col, t: 0, dur: durs[kind], ang, tg, recast, dmg: H.st.atk * I.mult * H.st.spow, hit: new Set(), i: -1, done: false, stage: st2, area: I.area, n: 4 + 2 * st2 + (kind === 'combo' && sk.el === 'slash' ? 2 : 0) + ex * 2 };
    G.ui.skillFlash(id);
    if (recast) G.popText(H.x, H.y - 38, '再発動!', '#9fdcff', 8);
    if (kind === 'dash') G.sfx('dash');
  }
  // ------------------------------------------------------------ 必殺技
  // ゲージが満タンで、近くに攻撃できる敵がいれば自動で発動（いなければ満タンのまま次の戦闘で使う）
  function tryUlt() {
    if ((H.ult || 0) < G.ULT.max || H.act) return false;
    const tg = H.target;
    if (!tg || tg.dead || G.dist(H.x, H.y, tg.x, tg.y) > G.ULT.range || !losPx(H.x, H.y - 6, tg.x, tg.y - 6)) return false;
    castUlt(tg); return true;
  }
  function castUlt(tg) {
    H.ult = 0; G.dailyAdd('ults', 1);
    const id = S.cur, ex = G.starExtra(G.curStar()), ang = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(ang);
    const durs = { hero: 1.15, thunder: 1.5, ice: 1.6, samurai: 1.7 }, mult = { hero: 5, thunder: 2.2, ice: 1.6, samurai: 3.2 };
    H.act = { k: 'ult', c: id, t: 0, dur: durs[id] || 1.2, ang, tg, ex, dmg: H.st.atk * (mult[id] || 4) * H.st.spow * G.starSkillMul(G.curStar()), hit: new Set(), i: 0, done: false, list: null };
    G.ui.cutin && G.ui.cutin(id);           // 短いカットイン
    G.slowmo(.55, .2); G.shake(3); G.sfx('roar');
  }
  G.ultReady = () => (G.hero && (G.hero.ult || 0) >= G.ULT.max);
  function nearEnemies(r, max) {
    return W.enemies.filter(e => !e.dead && G.dist(H.x, H.y, e.x, e.y) < r && W.vis[tileOf(e.x, e.y)]).sort((p, q) => G.dist(H.x, H.y, p.x, p.y) - G.dist(H.x, H.y, q.x, q.y)).slice(0, max);
  }
  const ultHit = (e, dmg, ka, kb) => hitEnemy(e, dmg, { src: 'skill', proc: true, ka, kb: kb || 60, noEl: true });
  function updUlt(a, p, dt) {
    const A = H.anim;
    if (a.c === 'thunder') {
      // 雷の女剣士：雷をまとって敵の間を高速で斬り抜け → 最後に巨大な落雷、周囲へ連鎖
      if (!a.list) a.list = nearEnemies(170, 6 + a.ex * 2);
      const steps = a.list.length, step = Math.floor(p / .7 * steps);
      while (a.i < Math.min(step, steps)) {
        const e = a.list[a.i++]; if (e.dead) continue;
        const px = H.x, py = H.y, nx = e.x - Math.cos(a.ang) * 8, ny = e.y + 2;
        if (!boxHit(nx, ny, H.r)) { H.x = nx; H.y = ny; }
        H.afterReq = true; setFaceTo(Math.atan2(e.y - py, e.x - px));
        G.fxAdd({ k: 'bolt', pts: [{ x: px, y: py - 10 }, { x: H.x, y: H.y - 10 }], lv: 6, dur: .3, hop: .02, done: 0, dmg: 0, src: 'fx', seed: R() * 999 });
        ultHit(e, a.dmg, Math.atan2(e.y - py, e.x - px), 80); G.sfx('zap'); G.shake(2);
      }
      if (!a.done && p >= .75) {
        a.done = true;
        const tx = H.x + Math.cos(a.ang) * 10, ty = H.y;
        for (let k = 0; k < 3; k++) G.fxAdd({ k: 'strike', x: tx + (k - 1) * 14, y: ty + (k % 2) * 6, dur: .55, seed: R() * 999 });
        G.fxAdd({ k: 'ring', x: tx, y: ty, r: 90 * H.st.area, dur: .5, col: '#fff27a' }); G.light(tx, ty, 220, .5, '#fff6a0');
        G.ui.flash && G.ui.flash(.6, '#fff6c0'); G.shake(9); G.sfx('boom'); G.sfx('zap');
        for (const e of nearEnemies(95 * H.st.area, 99)) { ultHit(e, a.dmg * 2.2, Math.atan2(e.y - ty, e.x - tx), 120); if (!e.dead) chainLightning(e, 6 + a.ex * 2, 3 + a.ex * 2, a.dmg * .8, 'chain'); }
      }
    } else if (a.c === 'ice') {
      // 氷の魔法使い：広範囲を凍らせ → 巨大な氷柱を連続で突き上げ → 最後に氷を砕いて追加ダメージ
      A.raise = p < .85;
      const R1 = (150 + 30 * a.ex) * H.st.area;
      if (!a.done && p >= .08) {
        a.done = true; a.list = nearEnemies(R1, 99);
        G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: R1, dur: .6, col: '#e8f8ff' }); G.ui.flash && G.ui.flash(.5, '#d8f4ff'); G.sfx('freeze'); G.shake(4);
        for (const e of a.list) { e.frozen = Math.max(e.frozen, (2.4 + .4 * a.ex) * (e.boss ? .35 : 1)); e.atk = false; G.burst(e.x, e.y - 9, 6, ['#e8f8ff', '#9fdcff'], 40, .5, 1); }
      }
      if (a.list) {
        const pil = a.list.slice(0, 7 + a.ex * 3), step = Math.floor(G.clamp((p - .2) / .55, 0, 1) * pil.length);
        while (a.i < Math.min(step, pil.length)) {
          const e = pil[a.i++]; if (e.dead) continue;
          G.fxAdd({ k: 'pillar', x: e.x, y: e.y, r: 14 + 3 * a.ex, h: 64 + 10 * a.ex, dur: .9 }); G.sfx('freeze'); G.shake(3);
          ultHit(e, a.dmg * 1.4, -Math.PI / 2, 0);
        }
        if (!a.shat && p >= .88) {
          a.shat = true; G.shake(7); G.sfx('boom'); G.ui.flash && G.ui.flash(.45, '#e8f8ff');
          for (const e of a.list) { if (e.dead) continue; G.burst(e.x, e.y - 10, 14, ['#ffffff', '#bfeaff', '#7fc8ff'], 110, .6, 1, 80); ultHit(e, a.dmg * (e.frozen > 0 ? 1.8 : 1), Math.atan2(e.y - H.y, e.x - H.x), 90); e.frozen = 0; }
        }
      }
    } else if (a.c === 'samurai') {
      // 女侍：一瞬静止して納刀 → 高速の居合で前方を斬る → 遅れて無数の斬撃が走る
      if (p < .3) { H.dvx = H.dvy = 0; A.swA = localA(a.ang) + 2.6; }
      if (!a.done && p >= .3) {
        a.done = true;
        const tg = a.tg && !a.tg.dead ? a.tg : null; if (tg) a.ang = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(a.ang);
        const go = 70; let k = 0; for (; k < 14; k++) { const nx = H.x + Math.cos(a.ang) * go / 14, ny = H.y + Math.sin(a.ang) * go / 14; if (boxHit(nx, ny, H.r)) break; H.x = nx; H.y = ny; H.afterReq = true; }
        const l = localA(a.ang); slashFx(l - 1.9, l + 1.9, 70, .3, '#ff6a6a', .9);
        G.ui.flash && G.ui.flash(.55, '#ffd0d0'); G.shake(8); G.sfx('slash2'); G.sfx('dash');
        a.zone = { x: H.x, y: H.y, ang: a.ang };
        for (const e of W.enemies) { if (e.dead) continue; const d = G.dist(H.x, H.y, e.x, e.y); if (d < 110 && (d < 30 || Math.abs(G.angDiff(a.ang + Math.PI, Math.atan2(e.y - H.y, e.x - H.x))) < 1.1 || Math.abs(G.angDiff(a.ang, Math.atan2(e.y - H.y, e.x - H.x))) < .8)) ultHit(e, a.dmg * 1.5, a.ang, 90); }
      }
      if (a.zone && p >= .5) {
        const n = 14 + 6 * a.ex, step = Math.floor(G.clamp((p - .5) / .45, 0, 1) * n);
        while (a.i < step) {
          a.i++;
          const Z = a.zone, d = 10 + R() * 90, side = (R() - .5) * 70, back = a.ang + Math.PI;
          const x = Z.x + Math.cos(back) * d * .6 + Math.cos(a.ang) * d * .4 + Math.cos(a.ang + Math.PI / 2) * side * .5, y = Z.y + Math.sin(back) * d * .6 + Math.sin(a.ang) * d * .4 + Math.sin(a.ang + Math.PI / 2) * side * .5 - 8;
          G.fxAdd({ k: 'xslash', x, y, ang: R() * Math.PI, r: 14 + R() * 10, dur: .2, lv: 10 }); if (a.i % 3 === 0) G.sfx('slash2');
          for (const e of W.enemies) if (!e.dead && G.dist(x, y + 8, e.x, e.y) < 22) ultHit(e, a.dmg * .35, R() * 6, 20);
        }
      }
    } else {
      // 初期主人公：剣を振りかぶり、大きな衝撃波を放つ
      A.raise = p < .45; A.hop = p < .45 ? -Math.sin(p / .45 * Math.PI * .5) * 8 : 0;
      if (!a.done && p >= .45) {
        a.done = true; A.hop = 0;
        const tg = a.tg && !a.tg.dead ? a.tg : null; if (tg) a.ang = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(a.ang);
        for (let i = -2; i <= 2; i++) { const g = a.ang + i * .16; W.projs.push({ k: 'wave', x: H.x + Math.cos(g) * 10, y: H.y - 8 + Math.sin(g) * 10, vx: Math.cos(g) * 260, vy: Math.sin(g) * 260, ang: g, life: .9, t: 0, r: 22 * H.st.area, dmg: a.dmg * .8, hit: new Set(), col: '#ffe9a0', kb: 140 }); }
        G.fxAdd({ k: 'ring', x: H.x, y: H.y, r: 70 * H.st.area, dur: .5, col: '#ffe9a0' }); G.fxAdd({ k: 'crack', x: H.x, y: H.y, r: 50, dur: 1.2, seed: R() * 999 });
        for (const e of nearEnemies(70 * H.st.area, 99)) ultHit(e, a.dmg * .6, Math.atan2(e.y - H.y, e.x - H.x), 150);
        G.ui.flash && G.ui.flash(.5, '#fff4c0'); G.shake(9); G.sfx('quake'); G.sfx('slash2');
      }
    }
  }
  function coneHit(ang, reach, mult, src, cone, kb) {
    let n = 0;
    for (const e of W.enemies) {
      if (e.dead) continue;
      const d = G.dist(H.x, H.y, e.x, e.y) - e.r;
      if (d > reach) continue;
      const ea = Math.atan2(e.y - H.y, e.x - H.x);
      if (d > 6 && Math.abs(G.angDiff(ang, ea)) > cone) continue;
      hitEnemy(e, mult, { src, proc: true, ka: ea, kb: kb || 60 });
      G.burst(e.x, e.y - 9, 4, ['#ffffff', '#fff2b0'], 60, .25, 1);
      n++;
    }
    if (n) { H.hitstop = .05; G.sfx(n && R() < .5 ? 'hit' : 'hit'); }
    return n;
  }
  function slashFx(a0l, a1l, r, dur, col, w) {
    return G.fxAdd({ k: 'slash', follow: true, a0: worldA(a0l), a1: worldA(a1l), r, dur, col: col || '#ffffff', w: w || .5 });
  }
  const ELC = { thunder: '#fff27a', samurai: '#ff8a8a' }; // キャラの通常攻撃の斬撃の色
  const weaponRar = () => { const w = G.itemById(S.equip.weapon); return w ? w.rar : 0; };
  function startAtk(tg) {
    const a = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(a);
    const spd = H.st.aspd, dur = Math.min(.22, .56 / spd);
    H.combo = (H.combo + 1) % 3;
    const dir = H.combo === 1 ? -1 : 1;
    H.act = { k: 'atk', t: 0, dur, ang: a, aimL: localA(a), dir, big: H.combo === 2, done: false };
    H.atkCd = 1 / spd;
    const s0 = dir === 1 ? -1.9 : 1.3, s1 = dir === 1 ? 1.3 : -1.9;
    if (!H.st.ranged) slashFx(H.act.aimL + s0, H.act.aimL + s1, H.st.reach + 4, dur * 1.25, ELC[G.S.cur] || G.SLASH_COL[weaponRar()], H.act.big ? .62 : .5);
    G.sfx('swing');
  }
  function updAct(dt) {
    const a = H.act, A = H.anim;
    a.t += dt;
    const p = Math.min(1, a.t / a.dur);
    H.dvx = H.dvy = 0;
    A.raise = (a.k === 'thunder' && p < .75) || (a.k === 'quake' && p < .5);
    switch (a.k) {
      case 'atk': {
        const e = G.easeOut(p);
        const s0 = a.dir === 1 ? -1.9 : 1.3, s1 = a.dir === 1 ? 1.3 : -1.9;
        A.swA = a.aimL + G.lerp(s0, s1, e); A.armA = A.swA;
        A.lean = p < .3 ? 1 : 0;
        // 剣先の軌道に沿って火花
        if (p > .12 && p < .62 && R() < .8) {
          const wa = worldA(A.swA), hx0 = H.x + H.face * 2, hy0 = H.y - 8;
          const tx = hx0 + Math.cos(wa) * 9, ty = hy0 + Math.sin(wa) * 9;
          G.part(tx, ty, Math.cos(wa) * 30 + (R() - .5) * 30, Math.sin(wa) * 30 - 10, .22 + R() * .15, R() < .5 ? '#fff6c8' : '#ffffff', 1, 60, 3);
        }
        if (H.st.ranged) {
          // 遠距離（氷の魔法使い）：氷の弾を撃つ
          if (!a.done && p >= .42) {
            a.done = true;
            const tg = a.tg && !a.tg.dead ? a.tg : null, ang = tg ? Math.atan2(tg.y - 4 - (H.y - 12), tg.x - H.x) : a.ang, s = 260;
            W.projs.push({ k: 'wave', src: 'atk', x: H.x + Math.cos(ang) * 6, y: H.y - 12 + Math.sin(ang) * 6, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s, ang, life: .55, t: 0, r: a.big ? 7 : 5, dmg: H.st.atk * (a.big ? 1.3 : 1), hit: new Set(), col: '#bfeaff', kb: 30, one: true });
            G.sfx('freeze');
          }
          break;
        }
        if (p < .45) { const tg = H.act.tg; if (!tg || G.dist(H.x, H.y, tg.x, tg.y) - tg.r > H.st.reach * .45) moveBody(H, Math.cos(a.ang) * 55 * dt, Math.sin(a.ang) * 55 * dt); }
        if (!a.done && p >= .42) { a.done = true; coneHit(a.ang, H.st.reach, H.st.atk * (a.big ? 1.3 : 1), 'atk', 1.15, a.big ? 90 : 55); }
        break;
      }
      case 'dash': {
        if (a.i < 0) {
          a.i = 0;
          const tg = a.tg, d = G.dist(H.x, H.y, tg.x, tg.y), go = Math.min(175, Math.max(0, d - tg.r - 6));
          a.vx = Math.cos(a.ang) * go / (a.dur * .8); a.vy = Math.sin(a.ang) * go / (a.dur * .8);
          G.burst(H.x, H.y, 8, ['#d8d0c0', '#a89e8c'], 40, .4, 1);
        }
        A.swA = localA(a.ang) + 2.5; A.armA = A.swA - .6;
        if (p < .8) {
          moveBody(H, a.vx * dt, a.vy * dt);
          H.afterT -= dt; if (H.afterT <= 0) { H.afterT = .022; H.afterReq = true; }
          for (const e of W.enemies) {
            if (e.dead || a.hit.has(e)) continue;
            if (G.dist(H.x, H.y, e.x, e.y) < H.r + e.r + 8) { a.hit.add(e); hitEnemy(e, a.dmg, { src: 'skill', proc: true, ka: a.ang, kb: 80 }); H.hitstop = .03; }
          }
          if (R() < .6) G.part(H.x + (R() - .5) * 6, H.y, -a.vx * .08, -a.vy * .08 - 10, .35, '#b8b0a0', 1, 0);
        } else if (!a.done) {
          a.done = true;
          const l = localA(a.ang);
          slashFx(l - 1.6, l + 1.6, H.st.reach + 10 + a.stage * 8, .22, a.stage === 2 ? '#ffb040' : '#ffd27a', .65 + a.stage * .1);
          const tg = a.tg; if (tg && !tg.dead) { a.ang = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(a.ang); }
          coneHit(a.ang, H.st.reach + 6 + a.stage * 12, a.dmg * (.6 + .3 * a.stage), 'skill', 1.4 + a.stage * .3, 70);
          if (a.stage === 2) { // 神速迅雷斬：周囲へ衝撃
            const r = 40 * H.st.area * a.area; G.fxAdd({ k: 'ring', x: H.x, y: H.y, r, dur: .35, col: '#ffe0a0' });
            for (const e of W.enemies) if (!e.dead && G.dist(H.x, H.y, e.x, e.y) <= r + e.r) hitEnemy(e, a.dmg * .5, { src: 'skill', proc: true, ka: Math.atan2(e.y - H.y, e.x - H.x), kb: 90 });
          }
          G.shake(2 + a.stage);
        }
        break;
      }
      case 'combo': {
        const nH = a.n || 4, idx = Math.min(nH - 1, Math.floor(p * nH)); // 進化すると6連撃・8連撃
        const tg = a.tg;
        if (tg && !tg.dead) { a.ang = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(a.ang); }
        const aimL = localA(a.ang), sp = (p * nH) % 1;
        const dir = idx % 2 === 0 ? 1 : -1;
        const s0 = dir === 1 ? -1.7 : 1.2, s1 = dir === 1 ? 1.2 : -1.7;
        A.swA = aimL + G.lerp(s0, s1, G.easeOut(Math.min(1, sp * 1.4))); A.armA = A.swA;
        if (idx !== a.i) {
          a.i = idx;
          const last = idx === nH - 1;
          slashFx(aimL + s0, aimL + s1, H.st.reach + 6, .16, last ? (a.stage === 2 ? '#ffb040' : '#ffe9a0') : (a.el ? a.col : '#ffffff'), .55);
          coneHit(a.ang, H.st.reach + 4, a.dmg * (last ? 1.5 : 1), 'skill', 1.2, last ? 110 : 25);
          moveBody(H, Math.cos(a.ang) * 2, Math.sin(a.ang) * 2);
          G.sfx(idx % 2 ? 'slash2' : 'swing');
        }
        break;
      }
      case 'spin': {
        const aimL = localA(a.ang);
        A.swA = aimL - 1.2 + G.easeOut(p) * Math.PI * 2.2 * (1 + a.stage); A.armA = A.swA;
        const times = [[.15], [.15, .55], [.12, .42, .72]][a.stage || 0]; // 進化すると2回転・3回転
        if ((a.hitI || 0) < times.length && p > times[a.hitI || 0]) {
          a.hitI = (a.hitI || 0) + 1;
          const r = (SK[a.sid].r || 36) * H.st.area * a.area;
          G.fxAdd({ k: 'spin', follow: true, r, dur: .32, dir: H.face });
          for (const e of W.enemies) {
            if (e.dead) continue;
            const d = G.dist(H.x, H.y, e.x, e.y);
            if (d <= r + e.r) hitEnemy(e, a.dmg, { src: 'skill', proc: true, ka: Math.atan2(e.y - H.y, e.x - H.x), kb: 90 });
          }
          G.sfx('swing'); G.sfx('slash2'); G.shake(1.5);
        }
        break;
      }
      case 'wave': {
        const aimL = localA(a.ang);
        A.swA = aimL + G.lerp(-2.0, 1.2, G.easeOut(p)); A.armA = A.swA;
        if (!a.done && p > .35) {
          a.done = true;
          const s = 230;
          const nw = [1, 3, 5][a.stage || 0]; // 進化すると3方向・5方向
          for (let i = 0; i < nw; i++) { const g = a.ang + (i - (nw - 1) / 2) * .22; W.projs.push({ k: 'wave', x: H.x + Math.cos(g) * 8, y: H.y - 8 + Math.sin(g) * 8, vx: Math.cos(g) * s, vy: Math.sin(g) * s, ang: g, life: .85, t: 0, r: 10 * H.st.area * a.area, dmg: a.dmg, hit: new Set(), el: a.el, col: a.el ? a.col : null }); }
          slashFx(aimL - 2.0, aimL + 1.2, H.st.reach + 4, .2, '#9ef0ff', .6);
          G.sfx('slash2'); G.sfx('dash');
        }
        break;
      }
      case 'thunder': {
        A.swA = G.lerp(A.swA, -Math.PI / 2 - .15, Math.min(1, dt * 25)); A.armA = -Math.PI / 2 - .2;
        if (!a.done && p > .35) {
          a.done = true;
          const tg = a.tg && !a.tg.dead ? a.tg : null;
          const strike = (tx, ty, tg) => {
            const S0 = SK[a.sid] || {};
            if (S0.ice) { G.fxAdd({ k: 'pillar', x: tx, y: ty, r: 12 * a.area, h: 46 + 10 * a.stage, dur: .7 }); G.light(tx, ty, 120, .35, '#bfeaff'); G.sfx('freeze'); } // 氷柱
            else if (S0.cut) { G.fxAdd({ k: 'xslash', x: tx, y: ty - 8, ang: R() * Math.PI, r: 26 * a.area, dur: .28, lv: 10 }); G.fxAdd({ k: 'xslash', x: tx, y: ty - 8, ang: R() * Math.PI, r: 20 * a.area, dur: .32, lv: 10 }); G.sfx('slash2'); } // 斬鉄
            else { G.fxAdd({ k: 'strike', x: tx, y: ty, dur: .45, seed: R() * 999 }); G.light(tx, ty, 150, .35, '#fff6a0'); }
            const targets = [];
            if (tg) targets.push(tg);
            for (const e of W.enemies) { if (!e.dead && e !== tg && G.dist(e.x, e.y, tx, ty) < 26 * H.st.area * a.area) targets.push(e); }
            for (const e of targets) hitEnemy(e, a.dmg, { src: 'skill', proc: true, ka: Math.atan2(e.y - ty, e.x - tx), kb: 40 });
            const src = targets.find(e => !e.dead) || tg;
            if (src && (!a.el || a.el === 'chain')) chainLightning(src, 3 + a.stage + a.ex, 4 + a.stage * 2 + a.ex * 2, a.dmg * .6, 'chain');
          };
          strike(tg ? tg.x : H.x + Math.cos(a.ang) * 40, tg ? tg.y : H.y + Math.sin(a.ang) * 40, tg);
          // 進化すると別の敵にも雷を落とす（天雷：2か所・神鳴：3か所）
          const more = W.enemies.filter(e => !e.dead && e !== tg && G.dist(H.x, H.y, e.x, e.y) < 160).sort((p, q) => G.dist(H.x, H.y, p.x, p.y) - G.dist(H.x, H.y, q.x, q.y)).slice(0, a.stage);
          for (const e of more) strike(e.x, e.y, e);
          G.shake(3 + a.stage); if (!a.el || a.el === 'chain') { G.sfx('zap'); G.sfx('boom'); }
        }
        break;
      }
      case 'quake': {
        if (p < .5) { A.hop = -Math.sin(p / .5 * Math.PI * .5) * 11; A.swA = G.lerp(A.swA, -Math.PI / 2 - .5, Math.min(1, dt * 18)); A.armA = -1.8; }
        else if (p < .62) { A.hop = G.lerp(-11, 0, (p - .5) / .12); A.swA = G.lerp(-Math.PI / 2, Math.PI / 2 - .2, (p - .5) / .12); A.armA = .9; }
        else { A.hop = 0; A.swA = Math.PI / 2 - .2; A.armA = .9; }
        if (!a.done && p >= .62) {
          a.done = true;
          const r = (SK[a.sid].r || 60) * H.st.area * a.area;
          G.fxAdd({ k: 'ring', x: H.x, y: H.y, r, dur: .45, col: '#ffcf9a' });
          G.fxAdd({ k: 'crack', x: H.x, y: H.y, r: r * .7, dur: 1.2, seed: R() * 999 });
          G.shake(6); G.sfx('quake');
          G.burst(H.x, H.y, 30, ['#c8b89a', '#8a7a64', '#e8dcc0'], 110, .7, 1, 140);
          for (const e of W.enemies) {
            if (e.dead) continue;
            const d = G.dist(H.x, H.y, e.x, e.y);
            if (d <= r + e.r) hitEnemy(e, a.dmg * (1 - d / (r + e.r) * .35), { src: 'skill', proc: true, ka: Math.atan2(e.y - H.y, e.x - H.x), kb: 150 });
          }
        }
        // 進化すると余震が追撃（大地割り：1回・天変地異：2回、より広く）
        const afterT = [[], [.84], [.8, .93]][a.stage || 0];
        if ((a.afI || 0) < afterT.length && p >= afterT[a.afI || 0]) {
          a.afI = (a.afI || 0) + 1;
          const r = (SK[a.sid].r || 60) * H.st.area * a.area * (1.2 + .2 * a.afI);
          G.fxAdd({ k: 'ring', x: H.x, y: H.y, r, dur: .4, col: a.stage === 2 ? '#ffb040' : '#ffcf9a' });
          G.shake(4); G.sfx('quake'); G.burst(H.x, H.y, 16, ['#c8b89a', '#8a7a64'], 120, .5, 1, 140);
          for (const e of W.enemies) if (!e.dead && G.dist(H.x, H.y, e.x, e.y) <= r + e.r) hitEnemy(e, a.dmg * .5, { src: 'skill', proc: true, ka: Math.atan2(e.y - H.y, e.x - H.x), kb: 110 });
        }
        break;
      }
    }
    if (a.k === 'ult') updUlt(a, p, dt);
    if (a.t >= a.dur) {
      const k = a.k, tg = a.tg;
      H.act = null; H.anim.hop = 0; H.anim.raise = false;
      // 技再発動（再発動からさらに再発動はしない）
      if (k !== 'atk' && k !== 'ult' && a.sid && !a.recast && H.st.recast && R() < H.st.recast && tg && !tg.dead && skillCond(a.sid, tg)) castSkill(a.sid, tg, true);
    }
  }

  function updHero(dt) {
    const A = H.anim;
    A.t += dt;
    H.flash -= dt; H.hurtT -= dt; H.cheerT = Math.max(0, (H.cheerT || 0) - dt);
    A.blinkT -= dt; if (A.blinkT <= 0) { A.blink = .12; A.blinkT = 2 + R() * 3; } A.blink -= dt;
    if (H.dead) {
      H.deadT += dt; H.vx *= .9; H.vy *= .9;
      updCape(dt);
      if (H.deadT > 2.4 && !G.trans) G.goHome('勇者は B' + W.f + 'F で力尽きた…');
      return;
    }
    for (const k in H.cds) if (H.cds[k] > 0) H.cds[k] -= dt;
    H.atkCd -= dt;
    const st = H.st;
    if (st.regen && H.hp < st.maxHp) heal(st.regen * st.maxHp * dt, false);
    // 非戦闘時の自然回復（4秒間 被弾・交戦がなければ毎秒1.5%）
    H.calmT = (H.target ? 0 : (H.calmT || 0) + dt);
    if (H.calmT > 4 && H.hp < st.maxHp) heal(st.maxHp * .015 * dt, false);
    if (st.barrier) {
      H.shieldT -= dt;
      if (H.shieldT <= 0) {
        H.shieldT = 8;
        const v = st.barrier * st.maxHp;
        if (H.shield < v * .98) { H.shield = v; G.fxAdd({ k: 'shieldUp', dur: .5 }); G.sfx('shield'); }
      }
    }
    if (H.hitstop > 0) { H.hitstop -= dt; updCape(dt * .3); return; }

    if (G.trans) { H.dvx = H.dvy = 0; }
    else if (H.act) updAct(dt);
    else {
      H.thinkT -= dt;
      if (H.thinkT <= 0) { H.thinkT = .1; think(); }
      if (H.target && H.target.dead) { H.target = null; H.goal = null; H.thinkT = 0; }
      if (!tryUlt() && !trySkill()) {
        const tg = H.target;
        if (tg) {
          const d = G.dist(H.x, H.y, tg.x, tg.y);
          if (d - tg.r <= H.st.reach * .85) {
            H.dvx = H.dvy = 0;
            const a = Math.atan2(tg.y - H.y, tg.x - H.x); setFaceTo(a);
            if (H.atkCd <= 0) startAtk(tg);
          } else goTo(tg.x, tg.y, 0);
        } else if (H.goal && H.goal.x != null) {
          const g = H.goal;
          const arrived = goTo(g.x, g.y, g.k === 'stairs' ? 2 : 3);
          if (g.k === 'stairs' && G.dist(H.x, H.y, g.x, g.y) < 5) { H.goal = null; G.descend(); }
          if (arrived && g.k === 'explore') { H.exT = -1; H.thinkT = 0; }
        } else { H.dvx = H.dvy = 0; }
      }
    }
    // 速度の滑らかな追従
    const k = 1 - Math.exp(-dt * 22);
    if (!isFinite(H.dvx) || !isFinite(H.dvy)) H.dvx = H.dvy = 0;
    H.vx += (H.dvx - H.vx) * k; H.vy += (H.dvy - H.vy) * k;
    if (!H.act) moveBody(H, H.vx * dt, H.vy * dt);
    // 引っかかり検出
    H.stuckT += dt;
    if (H.stuckT > 1.2) {
      const moved = G.dist(H.x, H.y, H.lastX, H.lastY);
      if (moved < 4 && H.goal && !H.act && !H.target && H.goal.k !== 'stairs') {
        H.path = null; if (H.exT >= 0 && H.goal.k === 'explore') { W.explored[H.exT] = 1; H.exT = -1; }
        H.x += (R() - .5) * 2; if (boxHit(H.x, H.y, H.r)) H.x = H.lastX;
      }
      H.stuckT = 0; H.lastX = H.x; H.lastY = H.y;
    }
    // アニメーション
    const spd = Math.hypot(H.vx, H.vy);
    // 全力で走ってから急に止まった時は、足を踏ん張ってブレーキ（土ぼこりが前へ）
    H.skidT = Math.max(0, (H.skidT || 0) - dt);
    if ((H.fastT || 0) > .2 && spd < 25 && !H.act && !H.dead && !H.skidT) { H.skidT = .22; H.fastT = 0; G.burst(H.x + H.face * 7, H.y, 7, ['rgba(210,200,180,.8)', 'rgba(170,160,140,.7)'], 45, .35, 1, 40); }
    H.fastT = spd > 85 ? Math.min(.6, (H.fastT || 0) + dt) : Math.max(0, (H.fastT || 0) - dt * 2); // 減速中もしばらく覚えておく
    A.mv = G.damp(A.mv, spd > 12 && !H.act ? 1 : 0, 12, dt);
    A.walk += dt * spd * .2;
    if (!H.act) {
      const idleA = spd > 12 ? -.35 + Math.sin(A.walk) * .12 : -.75 + Math.sin(A.t * 2.2) * .06;
      A.swA = G.damp(A.swA, idleA, 14, dt);
      A.armA = G.damp(A.armA, spd > 12 ? .5 + Math.sin(A.walk) * .3 : 1.0, 14, dt);
      A.lean = 0;
      if (H.target && !H.target.dead) { const dx = H.target.x - H.x; if (Math.abs(dx) > 7) H.face = dx > 0 ? 1 : -1; }
    }
    updCape(dt);
    // エピック以上の武器は刃から光の粒がこぼれる
    const wr = weaponRar();
    if (wr >= 3 && R() < dt * (wr === 4 ? 10 : 6)) { const wa = worldA(A.swA), k = 2 + R() * 7; G.part(H.x + H.face * 2 + Math.cos(wa) * k, H.y - 8 + Math.sin(wa) * k, (R() - .5) * 8, -12 - R() * 10, .6, G.SLASH_COL[wr], 1, -8, 1); }
    // 疾走モード：勇者が階層より十分強いときは残像を引いて駆け抜ける（再挑戦の序盤を素早く）
    const rush = !W.home && S.level >= W.f * 1.8 + 6;
    if (rush && !H.rush) G.popText(H.x, H.y - 38, '疾走！', '#9fdcff', 9);
    H.rush = rush;
    if (rush && spd > 60) { H.rushT = (H.rushT || 0) - dt; if (H.rushT <= 0) { H.rushT = .07; H.afterReq = true; } }
    // 足音：走りのコマで足が接地する瞬間（2・6コマ目）に鳴らす
    if (spd > 90 && !H.act && R() < dt * (H.rush ? 26 : 12)) {
      // 速く走っている時は体の後ろへ風の筋を流す
      const ang = Math.atan2(H.vy, H.vx);
      G.fxAdd({ k: 'wind', x: H.x - Math.cos(ang) * 6 + (R() - .5) * 6, y: H.y - 4 - R() * 24, ang, len: 8 + R() * 12, dur: .22 });
    }
    if (A.mv > .45 && !H.act) {
      // 足が着く瞬間（走りの周期の頭と半分）に足音と、後ろへ跳ねる土ぼこり
      const fi = ((Math.floor(A.walk * .75 / (Math.PI * 2) * 8) % 8) + 8) % 8;
      if (fi !== A.lastFi && (fi === 2 || fi === 6)) {
        G.sfx('step');
        if (spd > 55) for (let i = 0; i < (H.rush ? 4 : 2); i++) G.part(H.x + H.face * (fi === 0 ? -1 : 2) + (R() - .5) * 3, H.y, -H.face * (15 + R() * 25), -6 - R() * 10, .3 + R() * .2, R() < .5 ? 'rgba(210,200,180,.75)' : 'rgba(170,160,140,.6)', 1, 20);
      }
      A.lastFi = fi;
    }
    // 足音の土煙
    if (spd > 40 && A.mv > .5) { A.dustT = (A.dustT || 0) - dt; if (A.dustT <= 0) { A.dustT = .16; G.part(H.x - H.face * 2, H.y, -H.vx * .05, -8, .35, 'rgba(200,190,170,.7)', 1, 0); } }
    // 戦利品・宝箱・タイル
    G.onTileChange(false);
    for (const c of W.chests) {
      if (c.opened) continue;
      if (Math.abs(H.x - c.x) < 12 && H.y - c.y > -6 && H.y - c.y < 14) openChest(c);
    }
  }
  function updCape(dt) {
    const pts = H.cape; if (!pts.length) return;
    const A = H.anim;
    const walkBob = -Math.abs(Math.sin(A.walk)) * A.mv * 1.2;
    const ax = H.x - H.face * 3.5, ay = H.y - 15 + (A.hop || 0) + walkBob;
    pts[0].x = ax; pts[0].y = ay; pts[0].px = ax; pts[0].py = ay;
    const dt2 = Math.min(dt, 1 / 30);
    const g = 300 * dt2 * dt2, wind = -H.face * 60 * dt2 * dt2;
    for (let i = 1; i < pts.length; i++) {
      const p = pts[i];
      const vx = (p.x - p.px) * .88, vy = (p.y - p.py) * .88;
      p.px = p.x; p.py = p.y;
      p.x += vx + wind + Math.sin(A.t * 3 + i * .9) * 22 * dt2 * dt2;
      p.y += vy + g;
    }
    const L = 3.1;
    for (let it = 0; it < 4; it++) {
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, d = Math.hypot(dx, dy) || .001;
        const diff = (d - L) / d;
        if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
        else { a.x += dx * diff * .5; a.y += dy * diff * .5; b.x -= dx * diff * .5; b.y -= dy * diff * .5; }
      }
      pts[0].x = ax; pts[0].y = ay;
      // マントが体の前に回り込みすぎない
      for (let i = 1; i < pts.length; i++) {
        const p = pts[i], lx = (p.x - H.x) * H.face;
        if (lx > 1) p.x = H.x + H.face * 1;
        if (p.y > H.y - 2) p.y = H.y - 2;
      }
    }
  }
  function openChest(c) {
    c.opened = true; c.openT = 0;
    if (c.mimic) {
      // 宝箱に化けたミミックが正体を現す
      c.hidden = true;
      const m = mkEnemy('mimic', c.x, c.y - 3, {}); m.awake = true; m.cd = .5; m.lunge = .2;
      W.enemies.push(m);
      G.ui.toast('ミミックだ！'); G.sfx('roar'); G.shake(3);
      G.burst(c.x, c.y - 6, 16, ['#9a5e30', '#f0c24e', '#ffffff'], 80, .5, 1, 60);
      H.thinkT = 0; H.target = m;
      return;
    }
    G.sfx('chest');
    gainCoins(G.COIN.chest(W.f) * (.8 + R() * .4), c.x, c.y - 4, true); // 宝箱：まとまった枚数のコイン
    G.burst(c.x, c.y - 6, 22, ['#fff6c0', '#ffd84d', '#ffffff'], 80, .8, 1, 60);
    G.light(c.x, c.y, 80, .8, '#ffe8a0');
    H.thinkT = 0;
  }

  // ------------------------------------------------------------ 敵AI
  function stepToward(e, tx, ty, spd, dt) {
    let gx = tx, gy = ty;
    if (!clearWalk(e.x, e.y, tx, ty, e.r * .8)) {
      const D = W.D, ti = tileOf(e.x, e.y), cx = ti % D.W, cy = (ti / D.W) | 0, dd = W.dist[ti];
      if (dd > 0) {
        let best = -1, bd = dd;
        for (let k = 0; k < 8; k++) {
          const dx = DIRS[k][0], dy = DIRS[k][1], nx = cx + dx, ny = cy + dy, ni = ny * D.W + nx;
          if (W.dist[ni] >= 0 && W.dist[ni] < bd) { if (dx && dy && (D.tiles[cy * D.W + nx] !== 1 || D.tiles[ny * D.W + cx] !== 1)) continue; bd = W.dist[ni]; best = ni; }
        }
        if (best >= 0) { gx = (best % D.W) * T + 8; gy = ((best / D.W) | 0) * T + 8; }
      }
    }
    const dx = gx - e.x, dy = gy - e.y, d = Math.hypot(dx, dy) || 1;
    e.vx = G.damp(e.vx, dx / d * spd, 10, dt); e.vy = G.damp(e.vy, dy / d * spd, 10, dt);
  }
  function enemyStrike(e, dx, dy, d) {
    const df = e.d;
    if (df.role === 'caster') {
      // 魔導士：ゆっくり追尾する火の玉
      const a = Math.atan2(H.y - 13 - (e.y - 16), H.x - e.x);
      W.projs.push({ k: 'orb', x: e.x + e.face * 9, y: e.y - 17, vx: Math.cos(a) * 70, vy: Math.sin(a) * 70, ang: a, life: 2.6, t: 0, dmg: e.atkV });
      G.sfx('shoot');
    } else if (df.role === 'ranged') {
      const a = Math.atan2(H.y - 12 - (e.y - 12), H.x - e.x) + (R() - .5) * .12;
      W.projs.push({ k: 'arrow', x: e.x, y: e.y - 12, vx: Math.cos(a) * 160, vy: Math.sin(a) * 160, ang: a, life: 1.4, t: 0, dmg: e.atkV });
      G.sfx('shoot');
    } else if (df.role === 'heavy' || (e.boss && e.type === 'golem')) {
      const r = e.boss ? 40 : 26;
      G.fxAdd({ k: 'ring', x: e.x + e.face * 6, y: e.y, r, dur: .35, col: '#e0c8a0' });
      G.burst(e.x + e.face * 6, e.y, 14, ['#b8a888', '#807060'], 70, .5, 1, 100);
      G.shake(e.boss ? 5 : 3); G.sfx('quake');
      if (G.dist(H.x, H.y, e.x + e.face * 6, e.y) < r + H.r) hurtHero(e.atkV, e.x, e.y);
    } else {
      e.lunge = .15;
      const reach = df.range + H.r + e.r + (e.boss ? 14 : 5);
      if (d <= reach) {
        hurtHero(e.atkV, e.x, e.y);
        G.burst(H.x, H.y - 8, 5, ['#ff8a70', '#ffffff'], 50, .3, 1);
      }
      if (e.boss) { G.fxAdd({ k: 'eslash', x: e.x, y: e.y - 10, ang: Math.atan2(dy, dx), r: 34, dur: .2 }); G.shake(3); }
    }
  }
  function updEnemies(dt) {
    const list = W.enemies;
    for (const e of list) {
      e.t += dt; e.ph = (e.ph || 0) + Math.hypot(e.vx, e.vy) * dt; e.flash -= dt; e.lunge -= dt; e.shake -= dt; e.hpShow -= dt; if (e.hopT > 0) e.hopT -= dt;
      if (e.dead) { e.deadT += dt; continue; }
      // 状態異常
      if (e.burn) {
        e.burn.t -= dt; e.burn.tick -= dt;
        if (e.burn.tick <= 0) { e.burn.tick = .4; hitEnemy(e, e.burn.dps * .4, { src: 'burn', canCrit: false }); }
        if (R() < dt * (8 + e.burn.lv * 3)) G.part(e.x + (R() - .5) * e.r * 2, e.y - R() * 12, 0, -30 - R() * 20, .45, R() < .5 ? '#ff9b2f' : '#ffd35a', 1, -20, 1);
        if (e.burn && e.burn.t <= 0) e.burn = null;
        if (e.dead) continue;
      }
      if (e.poison) {
        const p = e.poison; p.t -= dt; p.tick -= dt;
        if (p.tick <= 0) { p.tick = .5; hitEnemy(e, p.dps * p.st * .5, { src: 'poison', canCrit: false }); }
        if (R() < dt * (4 + p.st * 2)) G.part(e.x + (R() - .5) * e.r * 2, e.y - R() * 10, 0, -14, .7, R() < .5 ? '#9ae05a' : '#5fa83a', 1, -6, 1);
        if (e.poison && p.t <= 0) e.poison = null;
        if (e.dead) continue;
      }
      if (e.kx || e.ky) {
        moveBody(e, e.kx * dt, e.ky * dt);
        const k = Math.exp(-dt * 12); e.kx *= k; e.ky *= k;
        if (Math.abs(e.kx) < 1 && Math.abs(e.ky) < 1) e.kx = e.ky = 0;
      }
      if (e.frozen > 0) { e.frozen -= dt; e.vx = e.vy = 0; continue; }
      if (e.hitstop > 0) { e.hitstop -= dt; continue; }
      const dx = H.x - e.x, dy = H.y - e.y, d = Math.hypot(dx, dy);
      if (!e.awake) {
        const ti = tileOf(e.x, e.y);
        if (!H.dead && d < 115 && W.vis[ti] && losPx(e.x, e.y - 4, H.x, H.y - 4)) { wake(e); }
        else {
          e.wanderT -= dt;
          if (e.wanderT <= 0) { e.wanderT = 1.5 + R() * 3; const a = R() * Math.PI * 2; e.wx = e.x + Math.cos(a) * 14; e.wy = e.y + Math.sin(a) * 10; }
          const wx = e.wx - e.x, wy = e.wy - e.y, wd = Math.hypot(wx, wy);
          const s = wd > 2 ? e.spd * .3 : 0;
          e.vx = G.damp(e.vx, wd > 2 ? wx / wd * s : 0, 6, dt); e.vy = G.damp(e.vy, wd > 2 ? wy / wd * s : 0, 6, dt);
          if (Math.abs(e.vx) > 2) e.face = e.vx > 0 ? 1 : -1;
          if (moveBody(e, e.vx * dt, e.vy * dt)) e.wanderT = 0;
          continue;
        }
      }
      if (H.dead) { e.vx = G.damp(e.vx, 0, 6, dt); e.vy = G.damp(e.vy, 0, 6, dt); continue; }
      if (Math.abs(dx) > 2) e.face = dx > 0 ? 1 : -1;
      const df = e.d;
      if (e.atk) {
        e.atkT += dt;
        e.vx = G.damp(e.vx, 0, 14, dt); e.vy = G.damp(e.vy, 0, 14, dt);
        if (!e.atkDone && e.atkT >= df.wind * (e.boss ? 1.1 : 1)) { e.atkDone = true; enemyStrike(e, dx, dy, d); }
        if (e.atkT >= df.wind + df.rec) { e.atk = false; e.cd = df.cd * (.8 + R() * .4) * (e.boss ? .8 : 1); }
        moveBody(e, e.vx * dt, e.vy * dt);
        continue;
      }
      e.cd -= dt;
      let spd = e.spd;
      if (df.role === 'caster') {
        // 近づかれると瞬間移動で距離を取り、離れた位置から詠唱する
        e.blinkCd = (e.blinkCd || 0) - dt;
        const los = losPx(e.x, e.y - 8, H.x, H.y - 6);
        if (d < 50 && e.blinkCd <= 0) {
          for (let k = 0; k < 12; k++) {
            const a = R() * Math.PI * 2, r = 70 + R() * 40, nx = e.x + Math.cos(a) * r, ny = e.y + Math.sin(a) * r;
            if (!boxHit(nx, ny, e.r) && clearWalk(e.x, e.y, nx, ny, 2) && G.dist(nx, ny, H.x, H.y) > 70) {
              G.burst(e.x, e.y - 12, 12, ['#c9a0ff', '#ffffff', '#7a4ad0'], 60, .45, 1, -20);
              e.x = nx; e.y = ny; e.blinkCd = 3.5; e.cd = Math.max(e.cd, .6);
              G.burst(e.x, e.y - 12, 12, ['#c9a0ff', '#ffffff', '#7a4ad0'], 60, .45, 1, -20);
              G.sfx('freeze'); break;
            }
          }
        }
        if (d > 110 || !los) stepToward(e, H.x, H.y, spd, dt);
        else { e.vx = G.damp(e.vx, 0, 5, dt); e.vy = G.damp(e.vy, 0, 5, dt); }
        if (e.cd <= 0 && d < 150 && los) { e.atk = true; e.atkT = 0; e.atkDone = false; }
      } else if (df.role === 'ranged') {
        const los = losPx(e.x, e.y - 8, H.x, H.y - 6);
        if (d < 55 && los) { stepToward(e, e.x - dx, e.y - dy, spd, dt); }
        else if (d > 105 || !los) stepToward(e, H.x, H.y, spd, dt);
        else { e.vx = G.damp(e.vx, -dy / d * spd * .3 * Math.sin(e.t), 5, dt); e.vy = G.damp(e.vy, dx / d * spd * .3 * Math.sin(e.t), 5, dt); }
        if (e.cd <= 0 && d < 140 && los) { e.atk = true; e.atkT = 0; e.atkDone = false; }
      } else {
        const reach = df.range + H.r + e.r + (e.boss ? 10 : 0);
        if (d <= reach) {
          e.vx = G.damp(e.vx, 0, 10, dt); e.vy = G.damp(e.vy, 0, 10, dt);
          if (e.cd <= 0) { e.atk = true; e.atkT = 0; e.atkDone = false; }
        } else {
          if (df.role === 'fast') { const s = Math.sin(e.t * 7) * .8; stepToward(e, H.x - dy / d * 20 * s, H.y + dx / d * 20 * s, spd, dt); }
          else if (df.role === 'swarm') { const hop = (Math.sin(e.t * 6) + 1) * .5; stepToward(e, H.x, H.y, spd * (.35 + hop), dt); }
          else stepToward(e, H.x, H.y, spd, dt);
        }
      }
      moveBody(e, e.vx * dt, e.vy * dt);
    }
    // 押し合い（敵同士・勇者）
    for (let i = 0; i < list.length; i++) {
      const a = list[i]; if (a.dead) continue;
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j]; if (b.dead) continue;
        const dx = b.x - a.x, dy = b.y - a.y, rr = a.r + b.r - 2;
        if (Math.abs(dx) > rr || Math.abs(dy) > rr) continue;
        const d = Math.hypot(dx, dy) || .01;
        if (d < rr) {
          const push = (rr - d) * .5, nx = dx / d, ny = dy / d;
          const wa = a.boss ? .1 : 1, wb = b.boss ? .1 : 1;
          moveBody(a, -nx * push * wa, -ny * push * wa); moveBody(b, nx * push * wb, ny * push * wb);
        }
      }
      if (!H.dead) {
        const dx = a.x - H.x, dy = a.y - H.y, rr = a.r + H.r - 1, d = Math.hypot(dx, dy) || .01;
        if (d < rr) moveBody(a, dx / d * (rr - d), dy / d * (rr - d));
      }
    }
    // 撃破アニメーション後に除去
    for (let i = list.length - 1; i >= 0; i--) if (list[i].dead && list[i].deadT > .5) list.splice(i, 1);
  }

  // ------------------------------------------------------------ 飛び道具・戦利品・派生効果
  function updProjs(dt) {
    for (let i = W.projs.length - 1; i >= 0; i--) {
      const p = W.projs[i];
      p.t += dt;
      const nx = p.x + p.vx * dt, ny = p.y + p.vy * dt;
      let dead = p.t >= p.life;
      if (p.k === 'arrow') {
        if (solid(nx, ny + 12)) { dead = true; G.burst(p.x, p.y, 3, ['#d8d0c0'], 30, .2, 1); }
        else if (!H.dead && G.dist(nx, ny, H.x, H.y - 12) < 10) { hurtHero(p.dmg, p.x, p.y); dead = true; }
      } else if (p.k === 'orb') {
        // 火の玉：勇者の方へ少しずつ曲がる。斬撃で打ち消せる
        const ta = Math.atan2(H.y - 13 - p.y, H.x - p.x), da = G.angDiff(p.ang, ta);
        p.ang += G.clamp(da, -1.4 * dt, 1.4 * dt);
        p.vx = Math.cos(p.ang) * 72; p.vy = Math.sin(p.ang) * 72;
        if (R() < .8) G.part(p.x, p.y, (R() - .5) * 10, -8, .35, R() < .5 ? '#ff9a4a' : '#ffe0a0', 1, -10, 2);
        if (solid(nx, ny + 15)) { dead = true; G.burst(p.x, p.y, 8, ['#ff9a4a', '#ffe0a0'], 50, .3, 1); }
        else if (!H.dead && G.dist(nx, ny, H.x, H.y - 12) < 9) { hurtHero(p.dmg, p.x, p.y); dead = true; G.burst(p.x, p.y, 12, ['#ff9a4a', '#ffe0a0', '#ffffff'], 70, .35, 1); }
        else if (H.act && H.act.k === 'atk' && G.dist(nx, ny, H.x, H.y - 12) < H.st.reach + 4) { dead = true; G.burst(p.x, p.y, 10, ['#ffffff', '#ffe0a0'], 70, .3, 1); G.sfx('slash2'); }
      } else if (p.k === 'wave') {
        if (solid(nx, ny + 6)) { dead = true; G.burst(p.x, p.y, 10, ['#9ef0ff', '#ffffff'], 60, .35, 1); }
        for (const e of W.enemies) {
          if (e.dead || p.hit.has(e)) continue;
          if (G.dist(nx, ny, e.x, e.y - 6) < p.r + e.r) { p.hit.add(e); hitEnemy(e, p.dmg, { src: p.src || 'skill', proc: true, ka: p.ang, kb: p.kb || 70, el: p.el || null }); G.burst(e.x, e.y - 9, 5, [p.col || '#9ef0ff', '#ffffff'], 60, .3, 1); if (p.one) { dead = true; break; } }
        }
        if (R() < .7) G.part(p.x, p.y + (R() - .5) * p.r, -p.vx * .1, -p.vy * .1, .3, p.col || '#9ef0ff', 1, 0);
      }
      p.x = nx; p.y = ny;
      if (dead) W.projs.splice(i, 1);
    }
  }
  function updDrops(dt) {
    for (let i = W.drops.length - 1; i >= 0; i--) {
      const d = W.drops[i];
      d.t += dt;
      if (d.z > 0 || d.vz > 0) {
        d.vz -= 420 * dt; d.z += d.vz * dt;
        if (d.z <= 0) { d.z = 0; d.vz = d.vz < -60 ? -d.vz * .35 : 0; }
      }
      if (d.vx || d.vy) {
        const tmp = { x: d.x, y: d.y, r: 3 };
        moveBody(tmp, d.vx * dt, d.vy * dt); d.x = tmp.x; d.y = tmp.y;
        const k = Math.exp(-dt * 3); d.vx *= k; d.vy *= k;
        if (Math.abs(d.vx) < 1 && Math.abs(d.vy) < 1) d.vx = d.vy = 0;
      }
      if (H.dead || W.home) continue;
      const dist = G.dist(d.x, d.y, H.x, H.y - 4);
      if (d.t > .35 && dist < 44) {
        const a = Math.atan2(H.y - 4 - d.y, H.x - d.x), s = 110 + (44 - dist) * 14;
        d.x += Math.cos(a) * s * dt; d.y += Math.sin(a) * s * dt;
        if (dist < 6) {
          W.drops.splice(i, 1);
          G.sfx('pickup', d.it.rar);
          G.burst(H.x, H.y - 14, 6 + d.it.rar * 4, [G.RARITY[d.it.rar].c, '#ffffff'], 50, .5, 1, -30);
          G.gainItem(d.it);
          H.thinkT = 0;
        }
      }
    }
  }
  function updDerived(dt) {
    // 撃破爆発（1体につき1回。爆発で倒した敵も爆発できる）
    for (let i = W.booms.length - 1; i >= 0; i--) {
      const b = W.booms[i]; b.t -= dt;
      if (b.t > 0) continue;
      W.booms.splice(i, 1);
      G.fxAdd({ k: 'boom', x: b.x, y: b.y, r: b.r, lv: b.lv, dur: .5 + b.lv * .02 });
      G.light(b.x, b.y, b.r * 2.4, .45, '#ffa050');
      G.burst(b.x, b.y, 10 + b.lv * 3, ['#ffd35a', '#ff9b2f', '#ff5a2a', '#ffffff'], 60 + b.r * 1.5, .55, 1, -30);
      G.burst(b.x, b.y, 6 + b.lv, ['rgba(60,50,50,.7)', 'rgba(90,80,80,.6)'], 30 + b.r * .6, 1.1, 2, -25);
      G.shake(Math.min(5, 1.5 + b.lv * .4)); G.sfx('boom');
      for (const e of W.enemies) {
        if (e.dead) continue;
        const d = G.dist(b.x, b.y, e.x, e.y);
        if (d <= b.r + e.r && losPx(b.x, b.y - 2, e.x, e.y - 4)) {
          const wasAlive = !e.dead;
          hitEnemy(e, b.dmg, { src: 'boom', canCrit: true, ka: Math.atan2(e.y - b.y, e.x - b.x), kb: 60 });
          if (wasAlive && e.dead && e.exploded) { const nb = W.booms[W.booms.length - 1]; if (nb) nb.t = .12; }
        }
      }
    }
    // 追撃斬
    for (let i = W.follows.length - 1; i >= 0; i--) {
      const f = W.follows[i]; f.t -= dt;
      if (f.t > 0) continue;
      let e = f.e;
      if (e.dead) { e = null; let bd = 40; for (const o of W.enemies) { if (o.dead) continue; const d = G.dist(o.x, o.y, f.x, f.y); if (d < bd) { bd = d; e = o; } } }
      if (!e) { W.follows.splice(i, 1); continue; }
      f.e = e; f.x = e.x; f.y = e.y;
      G.fxAdd({ k: 'xslash', x: e.x, y: e.y - 10, ang: R() * Math.PI, r: 10 + H.st.followLv * .8, dur: .18, lv: H.st.followLv });
      hitEnemy(e, f.dmg, { src: 'follow', canCrit: true, ka: 0, kb: 0 });
      G.sfx('slash2');
      f.n--; f.t = .06;
      if (f.n <= 0) W.follows.splice(i, 1);
    }
  }
  function updFx(dt) {
    for (let i = W.parts.length - 1; i >= 0; i--) {
      const p = W.parts[i]; p.t += dt;
      if (p.t >= p.life) { W.parts.splice(i, 1); continue; }
      p.vy += p.g * dt; const k = Math.exp(-p.dr * dt); p.vx *= k; p.vy *= k;
      p.x += p.vx * dt; p.y += p.vy * dt;
    }
    for (let i = W.fx.length - 1; i >= 0; i--) {
      const f = W.fx[i]; f.t += dt;
      if (f.k === 'bolt') {
        // 雷は1体ずつ順番に伝わる
        while (f.done < f.pts.length - 1 && f.t >= (f.done + 1) * f.hop) {
          f.done++;
          const p = f.pts[f.done];
          if (p.e && !p.e.dead) { hitEnemy(p.e, f.dmg, { src: f.src, canCrit: true, ka: 0, kb: 0 }); G.burst(p.x, p.y, 4 + Math.min(8, f.lv), ['#ffffff', '#bfe8ff', '#7fc8ff'], 70 + f.lv * 4, .3, 1); }
          if (f.done % 2 === 1) G.light(p.x, p.y, 36 + f.lv * 3, .22, '#7fb8ff');
        }
      }
      if (f.t >= f.dur) W.fx.splice(i, 1);
    }
    for (let i = W.nums.length - 1; i >= 0; i--) { const n = W.nums[i]; n.t += dt; n.pop = Math.max(0, n.pop - dt * 6); if (n.t > .9) W.nums.splice(i, 1); }
    for (let i = W.lights.length - 1; i >= 0; i--) { const l = W.lights[i]; l.t += dt; if (l.t >= l.dur) W.lights.splice(i, 1); }
    for (const c of W.chests) if (c.opened) c.openT += dt;
  }

  // ------------------------------------------------------------ ホーム
  function updHome(dt) {
    const A = H.anim; A.t += dt;
    A.blinkT -= dt; if (A.blinkT <= 0) { A.blink = .12; A.blinkT = 2 + R() * 3; } A.blink -= dt;
    A.mv = G.damp(A.mv, 0, 10, dt); A.swA = G.damp(A.swA, -.75 + Math.sin(A.t * 2.2) * .06, 10, dt); A.armA = G.damp(A.armA, 1, 10, dt);
    H.vx = H.vy = 0; H.face = 1; H.flash -= dt;
    updCape(dt);
    if (R() < dt * 14) G.part(W.fire.x + (R() - .5) * 6, W.fire.y - 4, (R() - .5) * 8, -25 - R() * 25, .8 + R() * .5, R() < .3 ? '#ffd35a' : '#ff9b2f', 1, -10, .5);
    if (!G.trans && !S.settings.waitHome && !G.manualStart && !G.paused && !(G.ui && G.ui.titleOn)) {
      G.homeT -= dt;
      if (G.homeT <= 0) G.depart();
    }
  }

  // ------------------------------------------------------------ メイン更新
  G.update = function (dt) {
    sync();
    if (!W || !H) return;
    W.time += dt;
    if (G.trans) {
      const tr = G.trans; tr.t += dt;
      if (!tr.fired && tr.t >= tr.dur / 2) { tr.fired = true; tr.fn(); sync(); }
      if (tr.t >= tr.dur) G.trans = null;
    }
    if (W.home) { updHome(dt); updFx(dt); updCam(dt); return; }
    if (G.ui && G.ui.titleOn) return; // タイトル表示中はダンジョンを進めない
    const rsx = G.runStats(); rsx.t += dt; rsx.floorT += dt;
    updMusic(dt);
    const cb = G.combo; cb.t -= dt; cb.burstT -= dt; cb.pop = Math.max(0, cb.pop - dt * 5);
    if (cb.t <= 0 && cb.n) cb.n = 0;
    updHero(dt);
    updEnemies(dt);
    updProjs(dt);
    updDrops(dt);
    updDerived(dt);
    updFx(dt);
    updCam(dt);
    G.saveT = (G.saveT || 0) + dt;
    if (G.saveT > 15) { G.saveT = 0; G.save(); }
  };
  function updCam(dt) {
    let tx = H.x + H.vx * .32, ty = H.y - 15 + H.vy * .26;
    if (W.home) { tx = (H.x + W.fire.x) / 2; ty = H.y - 10; }
    G.cam.x = G.damp(G.cam.x, tx, 6.5, dt); G.cam.y = G.damp(G.cam.y, ty, 6.5, dt);
    G.shakeA = Math.max(0, G.shakeA - dt * 18);
  }

  // ------------------------------------------------------------ セーブ
  const KEY = 'yuusha_auto_rpg_save_v1';
  G.save = function () {
    sync();
    if (!S || G.wiping) return;
    try {
      if (H && H.st) S.hpFrac = H.dead ? 1 : G.clamp(H.hp / H.st.maxHp, .01, 1);
      if (S.mode === 'dungeon' && W && !W.home && S.run) S.run.snap = G.snapshotRun();
      S.rngS = G.rng.s;
      S.savedAt = Date.now();
    } catch (e) { console.warn('save failed', e); return; }
    try { G.storeCur(); } catch (e) { }
    try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { console.warn('save failed', e); }
    if (G.cloud) G.cloud.queue(); // 公開ページではクラウドにも保存（まとめて書き込む）
  };
  // セーブの中身（オブジェクト）から状態を復元する。足りない項目は初期値で補う
  G.applySaveData = function (d) {
    const base = G.newState();
    for (const k in base) if (d[k] === undefined) d[k] = base[k];
    d.settings = Object.assign(base.settings, d.settings);
    d.autoSell = Object.assign(base.autoSell, d.autoSell);
    // 既存セーブ：新しい項目だけ足す（初期主人公を所持・★1、装備と育成状況はそのまま）
    d.mats = Object.assign({ forge: 0, soul: 0 }, d.mats); d.autoDis = Object.assign({ on: false, maxRar: 1 }, d.autoDis);
    d.chars = d.chars || {}; d.chars.hero = Object.assign({ star: 1 }, d.chars.hero, { own: true, star: 1 });
    if (!d.cur || !d.chars[d.cur] || !d.chars[d.cur].own) d.cur = 'hero';
    d.coins = Math.max(0, Math.floor(d.coins || 0)); d.pity = G.clamp(d.pity | 0, 0, G.GACHA.pity - 1);
    d.login = Object.assign({ last: '', streak: 0 }, d.login);
    G.S = d; sync();
    G.rebuildItemMap();
    if (d.rngS) G.rng.s = d.rngS >>> 0;
  };
  G.load = function () {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) return false;
      G.applySaveData(JSON.parse(raw));
      return true;
    } catch (e) { console.warn('load failed', e); return false; }
  };
  G.wipe = function () {
    G.wiping = true; try { localStorage.removeItem(KEY); } catch (e) { }
    if (G.cloud && G.cloud.wipe) G.cloud.wipe().finally(() => location.reload()); else location.reload();
  };
})();
