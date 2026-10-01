'use strict';
// ===== 地形の立体ドット（タイル単位で陰影計算→8x8マスの塊に組み立てて表示） =====
(function () {
  const RES = G.RES, TD = G.TILE * RES; // 1タイル=64ドット
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const L = (() => { const v = [-.55, -.72, .6], n = Math.hypot(...v); return v.map(a => a / n); })();
  const hexRgb = h => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  const toHex = c => '#' + c.map(v => ('0' + Math.round(G.clamp(v, 0, 255)).toString(16)).slice(-2)).join('');
  const hash = (a, b, c) => G.hash2(a | 0, b | 0, c | 0);

  // テーマ色からランプを作る
  const themeRamps = new Map();
  function TR(th) {
    let r = themeRamps.get(th);
    if (r) return r;
    const mk = (c, n, sp) => G.makeRamp(toHex(c), n, sp).map(hexRgb);
    r = { fl: mk(th.fl, 8, .5), fl2: mk(th.fl2, 8, .5), mo: mk(th.mo, 5, .3), wf: mk(th.wf, 8, .52), wf2: mk(th.wf2, 8, .52), wt: mk(th.wt, 6, .3), rim: mk(th.rim, 7, .45) };
    themeRamps.set(th, r);
    return r;
  }
  // 高さ関数 → 法線 → 光 → ランプの段階（ディザ付き）
  function shadePx(d, i, ramp, lvl, x, y) {
    const n = ramp.length, l = G.clamp(lvl, 0, .999) * (n - .001), f = Math.floor(l), t = l - f;
    const idx = Math.min(n - 1, f + (t > .5 + (BAYER[(y & 3) * 4 + (x & 3)] - .5) * .6 ? 1 : 0));
    const c = ramp[idx]; d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2]; d[i + 3] = 255;
  }
  function light(hf, x, y, bulge) {
    const nx = -(hf(x + 1, y) - hf(x - 1, y)) * .5 * bulge, ny = -(hf(x, y + 1) - hf(x, y - 1)) * .5 * bulge, nn = Math.hypot(nx, ny, 1);
    return Math.max(0, (nx * L[0] + ny * L[1] + L[2]) / nn);
  }

  // ---------------------------------------------------------- タイル画像
  const cache = new Map();
  G.tileArt = function (th, kind, mask, variant, seed) {
    const key = th.n + '|' + kind + '|' + mask + '|' + variant;
    let c = cache.get(key);
    if (c) return c;
    c = G.canvas(TD, TD);
    const x = c.getContext('2d'), img = x.createImageData(TD, TD), d = img.data, R = TR(th), s = variant * 131 + 7;
    // mask: bit0=上が壁, bit1=左が壁, bit2=右が壁, bit3=下が壁（床）/ 壁の天面は隣の床の向き
    if (kind === 0) {
      // 石畳：上段2枚・下段は半分ずらし（端は小さな石）。石ごとに面取りと緩い凹凸、色味の差
      const slabOf = (px, py) => {
        const row = py < 32 ? 0 : 1, ly = row ? py - 32 : py;
        let x0, x1;
        if (row === 0) { x0 = px < 32 ? 0 : 32; x1 = x0 + 32; }
        else { if (px < 16) { x0 = 0; x1 = 16; } else if (px < 48) { x0 = 16; x1 = 48; } else { x0 = 48; x1 = 64; } }
        return { id: row * 3 + (row ? (px < 16 ? 0 : px < 48 ? 1 : 2) : (px < 32 ? 0 : 1)), x0, x1, y0: row * 32, y1: row * 32 + 32, ly };
      };
      const H = (px, py) => {
        px = G.clamp(px, 0, TD - 1); py = G.clamp(py, 0, TD - 1);
        const sl = slabOf(px, py), de = Math.min(px - sl.x0, sl.x1 - 1 - px, py - sl.y0, sl.y1 - 1 - py);
        if (de < 1) return -.2; // 目地
        const bev = Math.pow(Math.min(1, de / 4), .6);
        return bev + (G.P3noise(px * .09 + s, py * .09 + sl.id * 3) - .5) * .35 + (G.P3noise(px * .35 + s, py * .35) - .5) * .06;
      };
      for (let py = 0; py < TD; py++) for (let px = 0; px < TD; px++) {
        const i = (py * TD + px) * 4, sl = slabOf(px, py), h = H(px, py);
        if (h < 0) { shadePx(d, i, R.mo, .25 + hash(px, py, s) * .15, px, py); continue; }
        // 床は明暗の幅を抑える（キャラクターが床に埋もれないように）
        let lv = .26 + light(H, px, py, 2.2) * .5;
        lv += (hash(sl.id, variant, s) - .5) * .1;
        if (hash(px >> 1, py >> 1, s + 5) < .01) lv -= .25; // 小さな欠け
        // 壁際の接地影
        if (mask & 1) lv *= .45 + Math.min(1, py / 26) * .55;
        if (mask & 2) lv *= .7 + Math.min(1, px / 12) * .3;
        if (mask & 4) lv *= .7 + Math.min(1, (TD - 1 - px) / 12) * .3;
        shadePx(d, i, hash(sl.id, variant, s + 1) < .5 ? R.fl : R.fl2, lv, px, py);
      }
    } else if (kind === 1) {
      // 壁の正面：天端（丸い縁）＋3段のレンガ（1つずつ膨らみ）＋根元の影
      const H = (px, py) => {
        px = G.clamp(px, 0, TD - 1); py = G.clamp(py, 0, TD - 1);
        if (py < 11) return Math.sin(py / 11 * Math.PI * .5 + .3) * .9;
        if (py >= 58) return 0;
        const by = py - 11, row = (by / 16) | 0, ly = by - row * 16, off = ((row + variant) & 1) ? 16 : 0, bx = (px + off) % 32;
        const de = Math.min(bx, 31 - bx, ly, 15 - ly);
        if (de < 1) return -.3;
        return Math.pow(Math.min(1, de / 3.5), .55) + (G.P3noise(px * .12 + row * 7, py * .12 + s) - .5) * .3;
      };
      for (let py = 0; py < TD; py++) for (let px = 0; px < TD; px++) {
        const i = (py * TD + px) * 4, h = H(px, py);
        let lv, ramp;
        if (py < 11) { ramp = R.rim; lv = .3 + light(H, px, py, 3) * .7; if (py === 0) lv = .95; }
        else if (py >= 58) { ramp = R.wt; lv = .25 - (py - 58) * .03; }
        else if (h < 0) { ramp = R.mo; lv = .3; }
        else {
          const by = py - 11, row = (by / 16) | 0, off = ((row + variant) & 1) ? 16 : 0, bid = ((px + off) / 32) | 0;
          ramp = hash(bid, row, s + 9) < .5 ? R.wf : R.wf2;
          lv = .18 + light(H, px, py, 2.8) * .72 + (hash(bid, row, s) - .5) * .1 - py / TD * .18;
        }
        if ((mask & 2) && px < 6) lv *= .6 + px * .06; // 角の陰
        if ((mask & 4) && px > TD - 7) lv *= .6 + (TD - 1 - px) * .06;
        shadePx(d, i, ramp, lv, px, py);
      }
    } else {
      // 壁の天面：暗い石の上面。床に接する辺は丸い縁が光る
      for (let py = 0; py < TD; py++) for (let px = 0; px < TD; px++) {
        const i = (py * TD + px) * 4;
        let lv = .35 + (G.P3noise(px * .1 + s, py * .1) - .5) * .35, ramp = R.wt;
        const dl = (mask & 2) ? px : 99, dr = (mask & 4) ? TD - 1 - px : 99, du = (mask & 1) ? py : 99, dd = Math.min(dl, dr, du);
        if (dd < 7) { ramp = R.rim; lv = dd < 2 ? .5 : .25 + (dl < 7 || du < 7 ? .35 : .1) * (1 - dd / 7); }
        shadePx(d, i, ramp, lv, px, py);
      }
    }
    x.putImageData(img, 0, 0);
    cache.set(key, c);
    return c;
  };

  // ---------------------------------------------------------- 8x8マスの塊
  const CH = 8, CD = CH * TD;
  G.CHUNK = CH;
  G.getChunk = function (W, cx, cy) {
    const key = cx + ',' + cy;
    let e = W.chunks.get(key);
    if (e) { e.t = W.time; return e.c; }
    const D = W.D, th = D.theme, c = G.canvas(CD, CD), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const isF = (tx, ty) => tx >= 0 && ty >= 0 && tx < D.W && ty < D.H && D.tiles[ty * D.W + tx] === 1;
    const nearF = (tx, ty) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) if (isF(tx + i, ty + j)) return true; return false; };
    const seed = D.seed & 0xffff;
    for (let j = 0; j < CH; j++) for (let i = 0; i < CH; i++) {
      const tx = cx * CH + i, ty = cy * CH + j;
      if (tx >= D.W || ty >= D.H) continue;
      let img = null;
      if (isF(tx, ty)) {
        const m = (!isF(tx, ty - 1) ? 1 : 0) | (!isF(tx - 1, ty) ? 2 : 0) | (!isF(tx + 1, ty) ? 4 : 0);
        img = G.tileArt(th, 0, m, Math.floor(hash(tx, ty, seed) * 6), seed);
      } else if (isF(tx, ty + 1)) {
        const m = (!isF(tx - 1, ty + 1) ? 2 : 0) | (!isF(tx + 1, ty + 1) ? 4 : 0);
        img = G.tileArt(th, 1, m, (tx + ty) & 1, seed);
      } else if (nearF(tx, ty)) {
        const m = (isF(tx, ty - 1) ? 1 : 0) | (isF(tx - 1, ty) ? 2 : 0) | (isF(tx + 1, ty) ? 4 : 0);
        img = G.tileArt(th, 2, m, 0, seed);
      }
      if (img) x.drawImage(img, i * TD, j * TD);
    }
    // 装飾・階段・魔法陣・小物（元の地形描画を塊の範囲だけ再利用）
    G.drawMapDecor(x, D, cx * CH, cy * CH, CH);
    W.chunks.set(key, { c, t: W.time });
    // 古い塊は捨てる（メモリを抑える）
    if (W.chunks.size > 64) { let old = null, ot = 1e9; for (const [k, v] of W.chunks) if (v.t < ot) { ot = v.t; old = k; } W.chunks.delete(old); }
    return c;
  };
  // 階に入った時：スタート地点の周りの塊をすぐ作り、残りは近い順に空き時間で少しずつ作る
  G.prepareChunks = function (W, hx, hy) {
    const CU = CH * G.TILE, ncx = Math.ceil(W.D.W / CH), ncy = Math.ceil(W.D.H / CH), hcx = Math.floor(hx / CU), hcy = Math.floor(hy / CU);
    const all = [];
    for (let cy = 0; cy < ncy; cy++) for (let cx = 0; cx < ncx; cx++) all.push([cx, cy, Math.hypot(cx - hcx, cy - hcy)]);
    all.sort((a, b) => a[2] - b[2]);
    for (const [cx, cy, d] of all) if (d <= 1.5) G.getChunk(W, cx, cy);
    W.chunkQueue = all.filter(a => a[2] > 1.5);
  };
  setInterval(() => {
    const W = G.W; if (!W || !W.chunkQueue || !W.chunkQueue.length) return;
    const t0 = performance.now();
    while (W.chunkQueue.length && performance.now() - t0 < 5) { const [cx, cy] = W.chunkQueue.shift(); G.getChunk(W, cx, cy); }
  }, 60);
})();
