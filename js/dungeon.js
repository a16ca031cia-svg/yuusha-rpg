'use strict';
// ===== ダンジョン生成・地形描画 =====
(function () {
  const T = G.TILE;

  G.THEMES = [
    { n: '石の迷宮', fl: [70, 75, 88], fl2: [80, 86, 100], mo: [42, 45, 56], wf: [100, 104, 122], wf2: [86, 90, 106], wt: [32, 33, 45], rim: [132, 138, 158], deco: 'grass', dark: .60, light: [255, 190, 120] },
    { n: '砂岩の遺跡', fl: [116, 94, 68], fl2: [128, 106, 78], mo: [78, 60, 42], wf: [160, 130, 90], wf2: [138, 110, 76], wt: [54, 40, 30], rim: [196, 166, 118], deco: 'bones', dark: .55, light: [255, 200, 130] },
    { n: '氷晶洞', fl: [64, 92, 116], fl2: [74, 104, 130], mo: [40, 58, 78], wf: [104, 146, 178], wf2: [86, 122, 152], wt: [24, 36, 52], rim: [170, 214, 240], deco: 'crystal', dark: .58, light: [170, 220, 255] },
    { n: '溶岩窟', fl: [66, 48, 46], fl2: [78, 56, 52], mo: [38, 26, 26], wf: [102, 68, 60], wf2: [84, 54, 48], wt: [28, 18, 18], rim: [150, 98, 78], deco: 'lava', dark: .64, light: [255, 140, 70] },
    { n: '深淵', fl: [54, 46, 76], fl2: [64, 54, 90], mo: [32, 26, 48], wf: [88, 74, 122], wf2: [72, 60, 102], wt: [20, 16, 32], rim: [150, 128, 200], deco: 'crystal', dark: .70, light: [200, 150, 255] },
  ];
  G.themeFor = f => G.THEMES[Math.floor((f - 1) / 5) % G.THEMES.length];
  G.floorSeed = (seed, f) => (Math.imul((seed ^ 0x5bd1e995) >>> 0, 2654435761) + Math.imul(f, 40503) + f) >>> 0;

  function bfs4(tiles, W, H, sx, sy) {
    const dist = new Int16Array(W * H).fill(-1), q = new Int32Array(W * H);
    let h = 0, t = 0; const s = sy * W + sx; dist[s] = 0; q[t++] = s;
    while (h < t) {
      const c = q[h++], cx = c % W, cy = (c / W) | 0;
      const nb = [[1, 0], [-1, 0], [0, 1], [0, -1]];
      for (const [dx, dy] of nb) {
        const nx = cx + dx, ny = cy + dy; if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const ni = ny * W + nx; if (!tiles[ni] || dist[ni] >= 0) continue;
        dist[ni] = dist[c] + 1; q[t++] = ni;
      }
    }
    return dist;
  }

  G.genFloor = function (f, seed) {
    const rng = new G.RNG(seed);
    const W = 50 + Math.min(14, f), H = 38 + Math.min(10, f >> 1);
    const tiles = new Uint8Array(W * H), roomId = new Int16Array(W * H).fill(-1);
    const rooms = [];
    const want = Math.min(13, 6 + Math.floor(f / 2.5));
    for (let tries = 0; rooms.length < want && tries < 800; tries++) {
      const w = rng.int(6, 11), h = rng.int(5, 8);
      const x = rng.int(2, W - w - 2), y = rng.int(3, H - h - 2);
      let ok = true;
      for (const r of rooms) if (x < r.x + r.w + 3 && x + w + 3 > r.x && y < r.y + r.h + 3 && y + h + 3 > r.y) { ok = false; break; }
      if (!ok) continue;
      rooms.push({ x, y, w, h, cx: x + (w >> 1), cy: y + (h >> 1) });
    }
    rooms.forEach((r, i) => {
      r.id = i;
      for (let j = r.y; j < r.y + r.h; j++) for (let k = r.x; k < r.x + r.w; k++) { tiles[j * W + k] = 1; roomId[j * W + k] = i; }
    });
    // 最小全域木で部屋を接続 + ループ
    const inT = [0], rest = rooms.slice(1).map(r => r.id), edges = [];
    const md = (a, b) => Math.abs(rooms[a].cx - rooms[b].cx) + Math.abs(rooms[a].cy - rooms[b].cy);
    while (rest.length) {
      let bi = -1, bj = -1, bd = 1e9;
      for (const a of inT) for (let q = 0; q < rest.length; q++) { const d = md(a, rest[q]); if (d < bd) { bd = d; bi = a; bj = q; } }
      const b = rest.splice(bj, 1)[0]; edges.push([bi, b]); inT.push(b);
    }
    const extra = rng.int(1, 2);
    for (let e = 0; e < extra; e++) {
      const a = rng.int(0, rooms.length - 1); let b = -1, bd = 1e9;
      for (const r of rooms) {
        if (r.id === a) continue;
        if (edges.some(E => (E[0] === a && E[1] === r.id) || (E[1] === a && E[0] === r.id))) continue;
        const d = md(a, r.id); if (d < bd) { bd = d; b = r.id; }
      }
      if (b >= 0 && bd < 32) edges.push([a, b]);
    }
    const carve = (x, y) => { if (x >= 1 && y >= 2 && x < W - 1 && y < H - 1) tiles[y * W + x] = 1; };
    const hLine = (x0, x1, y) => { for (let i = Math.min(x0, x1); i <= Math.max(x0, x1) + 1; i++) { carve(i, y); carve(i, y + 1); } };
    const vLine = (y0, y1, x) => { for (let j = Math.min(y0, y1); j <= Math.max(y0, y1) + 1; j++) { carve(x, j); carve(x + 1, j); } };
    for (const [a, b] of edges) {
      const A = rooms[a], B = rooms[b];
      if (rng.chance(.5)) { hLine(A.cx, B.cx, A.cy); vLine(A.cy, B.cy, B.cx); }
      else { vLine(A.cy, B.cy, A.cx); hLine(A.cx, B.cx, B.cy); }
    }
    // 開始部屋と階段
    const start = rooms[rng.int(0, rooms.length - 1)];
    const d0 = bfs4(tiles, W, H, start.cx, start.cy);
    let far = start, fd = -1;
    for (const r of rooms) { const d = d0[r.cy * W + r.cx]; if (d > fd) { fd = d; far = r; } }
    const stairs = { tx: far.cx, ty: far.cy };
    // 到達不能な床は壁に戻す（安全策）
    for (let i = 0; i < W * H; i++) if (tiles[i] && d0[i] < 0) { tiles[i] = 0; roomId[i] = -1; }

    // 敵
    const enemies = [];
    const tier = Math.floor((f - 1) / 5) % 5;
    const freeTile = (r, margin) => {
      for (let k = 0; k < 20; k++) {
        const tx = rng.int(r.x + margin, r.x + r.w - 1 - margin), ty = rng.int(r.y + margin, r.y + r.h - 1 - margin);
        if (tx === stairs.tx && ty === stairs.ty) continue;
        if (tiles[ty * W + tx]) return { tx, ty };
      }
      return { tx: r.cx, ty: r.cy };
    };
    // 深い階ほど敵が多い：部屋の広さあたりの数・1部屋の上限・群れの大きさ・お供の数がだんだん増える
    const dens = Math.max(13, 22 - f * .5), cap = Math.min(13, 8 + Math.floor(f / 8));
    const packMax = Math.min(7, (f < 3 ? 3 : 5) + Math.floor(f / 15)), escort = Math.min(2, Math.floor(f / 15));
    for (const r of rooms) {
      if (r === start) continue;
      const area = r.w * r.h;
      let n = Math.min(cap, Math.floor(area / dens) + rng.int(0, 1) + Math.floor(f / 6) + (f >= 3 ? 1 : 0));
      n = Math.max(1, n);
      for (let i = 0; i < n; i++) {
        const type = rng.weighted(G.enemyTable(f));
        const p = freeTile(r, 1);
        if (type === 'slime') {
          const pack = rng.int(2, packMax);
          for (let k = 0; k < pack; k++) enemies.push({ type, x: p.tx * T + 8 + rng.range(-10, 10), y: p.ty * T + 8 + rng.range(-8, 8) });
        } else {
          enemies.push({ type, x: p.tx * T + 8, y: p.ty * T + 8, elite: rng.chance(0.05 + Math.min(.1, f * .004)) });
          // お供：同じ種類の敵が近くに並ぶ
          const ne = rng.int(0, escort);
          for (let k = 0; k < ne; k++) enemies.push({ type, x: p.tx * T + 8 + rng.range(-14, 14), y: p.ty * T + 8 + rng.range(-12, 12) });
        }
      }
    }
    // モンスターハウス：まれに弱い敵が密集した部屋（範囲攻撃・連鎖で一掃する見せ場）。深い階ほど出やすく、数も多い
    if (f >= 3 && rng.chance(Math.min(.6, .2 + f * .01))) {
      for (const r of rng.shuffle(rooms.slice())) {
        if (r === start || r === far || r.w * r.h < 40) continue;
        r.mh = true;
        const n = rng.int(12, 18) + Math.min(10, Math.floor(f / 4));
        for (let i = 0; i < n; i++) {
          const p = freeTile(r, 1);
          enemies.push({ type: rng.chance(.7) ? 'slime' : 'bat', x: p.tx * T + 8 + rng.range(-6, 6), y: p.ty * T + 8 + rng.range(-6, 6) });
        }
        const p = freeTile(r, 1);
        enemies.push({ type: f >= 5 ? 'golem' : 'goblin', x: p.tx * T + 8, y: p.ty * T + 8, elite: true });
        break; // 1階に1部屋まで
      }
    }
    if (f % 5 === 0) {
      enemies.push({ type: G.bossKindAt(f).type, x: far.cx * T + 8, y: (far.cy - 1) * T + 8, boss: true }); // 階層の主（種類は階ごとに決まる）
    }
    // 宝箱
    const chests = [];
    const cand = rooms.filter(r => r !== start);
    const nc = Math.min(cand.length, rng.int(1, 2) + (f % 5 === 0 ? 1 : 0) + (rng.chance(.3) ? 1 : 0));
    rng.shuffle(cand);
    for (let i = 0; i < nc; i++) {
      const r = cand[i];
      const tx = rng.int(r.x + 1, r.x + r.w - 2), ty = r.y;
      chests.push({ x: tx * T + 8, y: ty * T + 11, mimic: f >= 4 && rng.chance(.12) }); // まれに宝箱に化けたミミック
    }
    // 特殊な部屋：祝福の祭壇（静かな部屋・入ると祝福）・宝物庫（コインの多い宝箱が並ぶ）・守護者の間（強敵1体・倒すと祝福2つ）
    const specials = [];
    const inRoom = (r, x, y) => x >= r.x * T && x < (r.x + r.w) * T && y >= r.y * T && y < (r.y + r.h) * T;
    const freeRooms = rng.shuffle(rooms.filter(r => r !== start && r !== far && !r.mh && r.w * r.h >= 30));
    const take = kind => { const r = freeRooms.shift(); if (!r) return null; r.kind = kind; specials.push({ kind, room: r.id, x: r.cx * T + 8, y: r.cy * T + 8 }); return r; };
    if (rng.chance(f % 5 === 4 ? 1 : .5)) { // ボスの前の階は必ず祭壇
      const r = take('altar');
      if (r) for (let i = enemies.length - 1; i >= 0; i--) if (inRoom(r, enemies[i].x, enemies[i].y)) enemies.splice(i, 1);
    }
    if (f >= 2 && rng.chance(.22)) {
      const r = take('vault');
      if (r) { const n = rng.int(3, 5); for (let i = 0; i < n; i++) { const tx = r.x + 1 + Math.round(i * (r.w - 3) / Math.max(1, n - 1)); chests.push({ x: tx * T + 8, y: r.y * T + 11, mimic: false, rich: true }); } }
    }
    if (f >= 3 && rng.chance(.3)) {
      const r = take('guard');
      if (r) {
        for (let i = enemies.length - 1; i >= 0; i--) if (inRoom(r, enemies[i].x, enemies[i].y)) enemies.splice(i, 1);
        enemies.push({ type: f >= 6 ? 'golem' : 'goblin', x: r.cx * T + 8, y: r.cy * T + 8, guardian: true, elite: true });
      }
    }
    // 癒やしの泉（入るとHP全回復＋障壁）・隠し書庫（経験値・技の再使用時間が戻る・必殺技ゲージ）・大群の間（弱い敵の大群・全滅でコイン）
    const clearRoom = r => { for (let i = enemies.length - 1; i >= 0; i--) if (inRoom(r, enemies[i].x, enemies[i].y)) enemies.splice(i, 1); };
    if (f >= 2 && rng.chance(.25)) { const r = take('spring'); if (r) clearRoom(r); }
    if (f >= 4 && rng.chance(.16)) { const r = take('library'); if (r) clearRoom(r); }
    if (f >= 3 && rng.chance(.2)) {
      const r = take('horde');
      if (r) {
        clearRoom(r);
        const n = 16 + Math.min(14, Math.floor(f / 2));
        for (let i = 0; i < n; i++) { const p = freeTile(r, 1); enemies.push({ type: rng.chance(.75) ? 'slime' : 'bat', x: p.tx * T + 8 + rng.range(-6, 6), y: p.ty * T + 8 + rng.range(-6, 6), horde: true }); }
      }
    }
    // 松明（部屋の上壁）
    const torches = [];
    for (const r of rooms) {
      for (let k = r.x; k < r.x + r.w; k++) {
        if ((k - r.x) % 4 !== 1 || !rng.chance(.75)) continue;
        if (!tiles[(r.y - 1) * W + k] && tiles[r.y * W + k]) torches.push({ x: k * T + 8, y: (r.y - 1) * T + 9, ph: rng.next() * 10 });
      }
    }
    // 床の装飾
    const decos = [];
    const theme = G.themeFor(f);
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      if (!tiles[ty * W + tx]) continue;
      if ((tx === stairs.tx && ty === stairs.ty) || (tx === start.cx && ty === start.cy)) continue;
      const r = rng.next();
      if (r < .025) decos.push({ k: 'bones', tx, ty });
      else if (r < .035) decos.push({ k: 'skull', tx, ty });
      else if (r < .075) decos.push({ k: 'pebble', tx, ty });
      else if (r < .11) decos.push({ k: theme.deco, tx, ty });
    }
    return { f, seed, W, H, tiles, roomId, rooms, start: { tx: start.cx, ty: start.cy, room: start.id }, stairs, enemies, chests, torches, decos, theme, tier, specials };
  };

  // ホーム（小さな部屋）
  G.genHome = function () {
    const W = 16, H = 12, tiles = new Uint8Array(W * H), roomId = new Int16Array(W * H).fill(-1);
    for (let y = 3; y < 10; y++) for (let x = 2; x < 14; x++) { tiles[y * W + x] = 1; roomId[y * W + x] = 0; }
    return {
      f: 0, seed: 7, W, H, tiles, roomId, rooms: [{ x: 2, y: 3, w: 12, h: 7, cx: 8, cy: 6, id: 0 }], start: { tx: 8, ty: 6 }, stairs: null,
      enemies: [], chests: [], torches: [{ x: 4 * T + 8, y: 2 * T + 9, ph: 1 }, { x: 11 * T + 8, y: 2 * T + 9, ph: 4 }], decos: [{ k: 'grass', tx: 3, ty: 8 }, { k: 'pebble', tx: 12, ty: 4 }], theme: G.THEMES[0], tier: 0, home: true,
    };
  };

  // 地形を1枚のキャンバスへ描画（階ごとに1回）。2倍解像度（1タイル=32ドット）で細かく描く
  G.MAPQ = 2;
  G.renderMap = function (D) {
    const Q = G.MAPQ, TT = T * Q;
    const W = D.W, H = D.H, cw = W * TT, ch = H * TT, th = D.theme, seed = D.seed & 0xffff;
    const c = G.canvas(cw, ch), x = c.getContext('2d');
    const img = x.createImageData(cw, ch), d = img.data;
    const isF = (tx, ty) => tx >= 0 && ty >= 0 && tx < W && ty < H && D.tiles[ty * W + tx] === 1;
    const nearF = (tx, ty) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isF(tx + i, ty + j)) return true; return false; };
    const put = (i, col, k) => { d[i] = Math.min(255, col[0] * k); d[i + 1] = Math.min(255, col[1] * k); d[i + 2] = Math.min(255, col[2] * k); d[i + 3] = 255; };
    const VOID = [7, 6, 11];
    for (let ty = 0; ty < H; ty++) for (let tx = 0; tx < W; tx++) {
      const fl = isF(tx, ty);
      const kind = fl ? 0 : isF(tx, ty + 1) ? 1 : nearF(tx, ty) ? 2 : 3;
      const wallUp = !isF(tx, ty - 1), wallL = !isF(tx - 1, ty), wallR = !isF(tx + 1, ty);
      for (let py = 0; py < TT; py++) for (let px = 0; px < TT; px++) {
        const gx = tx * TT + px, gy = ty * TT + py, i = (gy * cw + gx) * 4;
        const n = G.hash2(gx, gy, seed) - .5;
        if (kind === 0) {
          // 石畳：半タイルずらしの板石。目地は1ドット、縁に面取りの明暗
          const band = gy >> 4, off = (band & 1) * 16, sx = (gx + off) >> 5, lx = (gx + off) & 31, ly = gy & 15;
          const mortar = ly === 0 || lx === 0;
          const hs = G.hash2(sx, band, seed + 3);
          let k = 1 + n * .06 + (hs - .5) * .12;
          if (ly === 1) k += .08; else if (ly === 2) k += .03; else if (ly === 15) k -= .07; else if (ly === 14) k -= .03;
          if (lx === 1) k += .04; else if (lx === 31) k -= .05;
          // 石の小さな欠けとひび
          const cr = G.hash2(gx >> 1, gy >> 1, seed + 11);
          if (cr < .012) k -= .12; else if (cr > .994) k += .08;
          let col = mortar ? th.mo : (hs < .5 ? th.fl : th.fl2);
          if (mortar) k = 1 + n * .1;
          if (wallUp && py < 14) k *= .5 + py * .036;
          if (wallL && px < 6) k *= .78 + px * .036;
          if (wallR && px > 25) k *= .78 + (31 - px) * .036;
          put(i, col, k);
        } else if (kind === 1) {
          // 壁の正面：天端＋3段のレンガ
          let col, k = 1 + n * .05;
          if (py < 6) { col = th.rim; k = py === 0 ? 1.1 : py < 3 ? .98 - py * .02 : .76 - (py - 3) * .03; }
          else if (py >= 30) { col = th.wt; k = .7; }
          else {
            const by = py - 6, row = (by / 8) | 0, off = ((row + ty) & 1) ? 8 : 0, bx = gx + off;
            const mortar = by % 8 === 7 || (bx & 15) === 0;
            const bh = G.hash2(bx >> 4, ty * 4 + row, seed + 9);
            col = mortar ? th.mo : (bh < .5 ? th.wf : th.wf2);
            if (!mortar) {
              k *= 1 + (bh - .5) * .16;
              if (by % 8 === 0) k *= 1.14; else if (by % 8 === 1) k *= 1.05; else if (by % 8 === 6) k *= .9;
              if ((bx & 15) === 1) k *= 1.05;
              if (G.hash2(gx >> 1, gy >> 1, seed + 21) < .02) k *= .85;
            }
            k *= 1 - (py / 32) * .3;
          }
          if (!isF(tx - 1, ty + 1) && px < 4) k *= .7;
          if (!isF(tx + 1, ty + 1) && px > 27) k *= .7;
          put(i, col, k);
        } else if (kind === 2) {
          // 壁の天面：外周に明るい縁
          let col = th.wt, k = 1 + n * .1 + (G.hash2(gx >> 2, gy >> 2, seed + 4) - .5) * .08;
          if ((isF(tx - 1, ty) && px < 2) || (isF(tx + 1, ty) && px > 29) || (isF(tx, ty - 1) && py < 2)) { col = th.rim; k = px === 0 || px === 31 || py === 0 ? .66 : .56; }
          else if ((isF(tx - 1, ty) && px < 4) || (isF(tx + 1, ty) && px > 27)) { k *= .8; }
          put(i, col, k);
        } else put(i, VOID, 1);
      }
    }
    x.putImageData(img, 0, 0);
    x.imageSmoothingEnabled = false;
    // 装飾（高解像度スプライトをそのまま描く）
    for (const o of D.decos) {
      if (o.k === 'lava') {
        const cx = o.tx * TT + 6, cy = o.ty * TT + 10;
        const r = new G.RNG(o.tx * 131 + o.ty * 7 + seed);
        let px = cx, py = cy;
        for (let s = 0; s < 14; s++) {
          x.fillStyle = s % 4 === 1 ? '#ffd060' : '#ff7a2a';
          x.fillRect(px, py, 1, 1);
          px += 1; py += r.int(-1, 1);
        }
        continue;
      }
      const s = G.DECO[o.k]; if (!s) continue;
      const h = G.hash2(o.tx, o.ty, seed + 5);
      x.drawImage(s, o.tx * TT + 4 + Math.floor(h * (TT - s.width - 6)), o.ty * TT + 6 + Math.floor(G.hash2(o.ty, o.tx, seed) * (TT - s.height - 8)));
    }
    // 部屋の小物：壁の旗・隅のクモの巣・樽と木箱（見た目だけ。通行には影響しない）
    const BANNER_COL = ['#8a2a2a', '#7a5a2a', '#2a5a8a', '#6a2a2a', '#4a2a7a'];
    const bc = BANNER_COL[G.THEMES.indexOf(th) % BANNER_COL.length];
    const tq = new Set((D.torches || []).map(t => Math.floor(t.x / T)));
    for (const r of D.rooms) {
      if (D.home) break;
      const h = k => G.hash2(r.x * 7 + k, r.y * 13, seed + 31);
      for (let k = r.x + 2; k < r.x + r.w - 1; k += 5) {
        if (tq.has(k) || h(k) > .35 || isF(k, r.y - 1)) continue;
        x.drawImage(G.banner(bc), k * TT + 8, (r.y - 1) * TT + 8);
      }
      const web = G.PROPS.web;
      if (h(1) < .55 && !isF(r.x - 1, r.y) && !isF(r.x, r.y - 1)) x.drawImage(web, r.x * TT, r.y * TT);
      if (h(2) < .55 && !isF(r.x + r.w, r.y) && !isF(r.x + r.w - 1, r.y - 1)) { x.save(); x.translate((r.x + r.w) * TT, r.y * TT); x.scale(-1, 1); x.drawImage(web, 0, 0); x.restore(); }
      if (h(3) < .4) { const p = h(5) < .5 ? G.PROPS.barrel : G.PROPS.crate; x.drawImage(p, (r.x + r.w - 1) * TT + 6, (r.y + r.h - 1) * TT + 6); }
      if (h(4) < .3) x.drawImage(G.PROPS.barrel, r.x * TT + 4, (r.y + r.h - 1) * TT + 4);
    }
    // 開始地点の魔法陣
    if (D.start && !D.home) {
      const cx = (D.start.tx * T + 8) * Q, cy = (D.start.ty * T + 8) * Q;
      x.fillStyle = 'rgba(140,200,255,.4)';
      for (let a = 0; a < 90; a++) { const t = a / 90 * Math.PI * 2; x.fillRect(Math.round(cx + Math.cos(t) * 22), Math.round(cy + Math.sin(t) * 14), 1, 1); }
      for (let a = 0; a < 56; a++) { const t = a / 56 * Math.PI * 2; x.fillRect(Math.round(cx + Math.cos(t) * 13), Math.round(cy + Math.sin(t) * 8), 1, 1); }
      for (let a = 0; a < 6; a++) {
        const t0 = a / 6 * Math.PI * 2, t1 = t0 + Math.PI * 2 / 3;
        for (let k = 0; k <= 16; k++) { const tt = k / 16; x.fillRect(Math.round(cx + G.lerp(Math.cos(t0), Math.cos(t1), tt) * 22), Math.round(cy + G.lerp(Math.sin(t0), Math.sin(t1), tt) * 14), 1, 1); }
      }
    }
    // 下り階段
    if (D.stairs) {
      const sx = D.stairs.tx * TT, sy = D.stairs.ty * TT;
      x.fillStyle = '#050408'; x.fillRect(sx, sy + 2, 32, 30);
      for (let i = 0; i < 6; i++) {
        const k = 1 - i * .14;
        x.fillStyle = `rgb(${th.wf[0] * k | 0},${th.wf[1] * k | 0},${th.wf[2] * k | 0})`;
        x.fillRect(sx + 2 + i * 2, sy + 3 + i * 5, 28 - i * 4, 4);
        x.fillStyle = `rgb(${th.rim[0] * k | 0},${th.rim[1] * k | 0},${th.rim[2] * k | 0})`;
        x.fillRect(sx + 2 + i * 2, sy + 3 + i * 5, 28 - i * 4, 1);
      }
      x.strokeStyle = '#1c110d'; x.lineWidth = 1; x.strokeRect(sx + .5, sy + .5, 31, 31);
    }
    return c;
  };

  // 地形の塊（art_world.js）に装飾を描く。x:塊のコンテキスト、tx0,ty0:塊の左上タイル、n:塊の大きさ
  G.drawMapDecor = function (x, D, tx0, ty0, n) {
    const Q = G.RES, TT = T * Q, seed = D.seed & 0xffff, th = D.theme;
    const isF = (tx, ty) => tx >= 0 && ty >= 0 && tx < D.W && ty < D.H && D.tiles[ty * D.W + tx] === 1;
    const inC = (tx, ty, m) => tx >= tx0 - (m || 1) && tx < tx0 + n + (m || 1) && ty >= ty0 - (m || 1) && ty < ty0 + n + (m || 1);
    x.save(); x.translate(-tx0 * TT, -ty0 * TT); x.imageSmoothingEnabled = false;
    for (const o of D.decos) {
      if (!inC(o.tx, o.ty)) continue;
      if (o.k === 'lava') {
        // 溶岩のひび（光る割れ目）
        const r = new G.RNG(o.tx * 131 + o.ty * 7 + seed);
        let px = o.tx * TT + 12, py = o.ty * TT + 20;
        for (let s = 0; s < 30; s++) {
          x.fillStyle = s % 5 === 2 ? '#ffe070' : '#ff7a2a'; x.fillRect(px, py, 2, 2);
          x.fillStyle = 'rgba(255,120,40,.35)'; x.fillRect(px - 1, py - 1, 4, 4);
          px += 1 + (s & 1); py += r.int(-1, 1);
        }
        continue;
      }
      const s = G.DECO[o.k]; if (!s) continue;
      const h = G.hash2(o.tx, o.ty, seed + 5);
      // 小物の接地影
      const ox = o.tx * TT + 8 + Math.floor(h * (TT - s.width - 12)), oy = o.ty * TT + 12 + Math.floor(G.hash2(o.ty, o.tx, seed) * (TT - s.height - 16));
      x.fillStyle = 'rgba(0,0,0,.28)'; x.beginPath(); x.ellipse(ox + s.width / 2, oy + s.height - 1, s.width * .45, 3, 0, 0, 7); x.fill();
      x.drawImage(s, ox, oy);
    }
    const BANNER_COL = ['#8a2a2a', '#7a5a2a', '#2a5a8a', '#6a2a2a', '#4a2a7a'];
    const bc = BANNER_COL[G.THEMES.indexOf(th) % BANNER_COL.length];
    const tq = new Set((D.torches || []).map(t => Math.floor(t.x / T)));
    for (const r of D.rooms) {
      if (D.home) break;
      if (r.x > tx0 + n + 1 || r.x + r.w < tx0 - 1 || r.y > ty0 + n + 1 || r.y + r.h < ty0 - 2) continue;
      const h = k => G.hash2(r.x * 7 + k, r.y * 13, seed + 31);
      for (let k = r.x + 2; k < r.x + r.w - 1; k += 5) {
        if (tq.has(k) || h(k) > .35 || isF(k, r.y - 1)) continue;
        x.drawImage(G.banner(bc), k * TT + 16, (r.y - 1) * TT + 16);
      }
      const web = G.PROPS.web;
      if (h(1) < .55 && !isF(r.x - 1, r.y) && !isF(r.x, r.y - 1)) x.drawImage(web, r.x * TT, r.y * TT);
      if (h(2) < .55 && !isF(r.x + r.w, r.y) && !isF(r.x + r.w - 1, r.y - 1)) { x.save(); x.translate((r.x + r.w) * TT, r.y * TT); x.scale(-1, 1); x.drawImage(web, 0, 0); x.restore(); }
      const prop = (p, px, py) => { x.fillStyle = 'rgba(0,0,0,.3)'; x.beginPath(); x.ellipse(px + p.width / 2, py + p.height - 2, p.width * .5, 5, 0, 0, 7); x.fill(); x.drawImage(p, px, py); };
      if (h(3) < .4) prop(h(5) < .5 ? G.PROPS.barrel : G.PROPS.crate, (r.x + r.w - 1) * TT + 12, (r.y + r.h - 1) * TT + 12);
      if (h(4) < .3) prop(G.PROPS.barrel, r.x * TT + 8, (r.y + r.h - 1) * TT + 8);
    }
    // 開始地点の魔法陣（二重円と六芒星）
    if (D.start && !D.home && inC(D.start.tx, D.start.ty)) {
      const cx = (D.start.tx * T + 8) * Q, cy = (D.start.ty * T + 8) * Q;
      x.fillStyle = 'rgba(140,200,255,.45)';
      const dot = (px, py) => x.fillRect(Math.round(px), Math.round(py), 2, 2);
      for (let a = 0; a < 180; a++) { const t = a / 180 * Math.PI * 2; dot(cx + Math.cos(t) * 44, cy + Math.sin(t) * 28); }
      for (let a = 0; a < 110; a++) { const t = a / 110 * Math.PI * 2; dot(cx + Math.cos(t) * 26, cy + Math.sin(t) * 16); }
      for (let a = 0; a < 6; a++) {
        const t0 = a / 6 * Math.PI * 2, t1 = t0 + Math.PI * 2 / 3;
        for (let k = 0; k <= 30; k++) { const tt = k / 30; dot(cx + G.lerp(Math.cos(t0), Math.cos(t1), tt) * 44, cy + G.lerp(Math.sin(t0), Math.sin(t1), tt) * 28); }
      }
    }
    // 下り階段：奥へ沈んでいく段（段ごとに暗く、踏み面の縁が光る）
    if (D.stairs && inC(D.stairs.tx, D.stairs.ty)) {
      const sx = D.stairs.tx * TT, sy = D.stairs.ty * TT;
      x.fillStyle = '#040307'; x.fillRect(sx + 2, sy + 4, TT - 4, TT - 6);
      for (let i = 0; i < 7; i++) {
        const k = 1 - i * .13, w = TT - 8 - i * 6, px = sx + 4 + i * 3, py = sy + 6 + i * 8;
        x.fillStyle = `rgb(${th.wf[0] * k * .8 | 0},${th.wf[1] * k * .8 | 0},${th.wf[2] * k * .8 | 0})`; x.fillRect(px, py, w, 8);
        x.fillStyle = `rgb(${th.rim[0] * k | 0},${th.rim[1] * k | 0},${th.rim[2] * k | 0})`; x.fillRect(px, py, w, 2);
        x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(px, py + 6, w, 2);
      }
      x.strokeStyle = '#140c0a'; x.lineWidth = 2; x.strokeRect(sx + 1, sy + 1, TT - 2, TT - 2);
    }
    x.restore();
  };
})();
