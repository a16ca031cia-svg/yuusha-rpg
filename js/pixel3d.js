'use strict';
// ===== 立体ドット絵の生成ツール =====
// 形（楕円・カプセル・多角形）に「高さ」を持たせ、左上前方からの光で陰影を計算し、
// 素材ごとの色段階（ランプ）に量子化してドット絵にする。境目は規則的なディザでなじませ、
// 重なりの手前側との境界には影（アンビエントオクルージョン）、外周には色付きの輪郭を付ける。
(function () {
  const RES = 4;              // 1ワールド単位あたりのドット数（1ドット=0.25単位）
  G.RES = RES;
  const hexRgb = h => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + .5) / 16);
  const L = (() => { const v = [-.55, -.72, .6], n = Math.hypot(...v); return v.map(a => a / n); })();
  const HV = (() => { const v = [L[0], L[1], L[2] + 1], n = Math.hypot(...v); return v.map(a => a / n); })();

  // ---------------------------------------------------------- 色ランプ（暗→明）
  const ramps = [], rampIdx = {};
  function defRamp(name, cols) { rampIdx[name] = ramps.length; ramps.push(cols.map(hexRgb)); return rampIdx[name]; }
  G.defRamp = defRamp;
  G.rampId = name => rampIdx[name];
  // 1色から明暗のランプを作る（HSLで色相を少しずらすと自然な陰になる）
  function rgb2hsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b); let h = 0, s = 0; const l = (mx + mn) / 2;
    if (mx !== mn) { const d = mx - mn; s = l > .5 ? d / (2 - mx - mn) : d / (mx + mn); h = mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h /= 6; }
    return [h, s, l];
  }
  function hsl2hex(h, s, l) {
    const f = (p, q, t) => { if (t < 0) t += 1; if (t > 1) t -= 1; if (t < 1 / 6) return p + (q - p) * 6 * t; if (t < 1 / 2) return q; if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6; return p; };
    let r, g, b;
    if (s === 0) r = g = b = l; else { const q = l < .5 ? l * (1 + s) : l + s - l * s, p = 2 * l - q; r = f(p, q, h + 1 / 3); g = f(p, q, h); b = f(p, q, h - 1 / 3); }
    const x = v => ('0' + Math.round(G.clamp(v, 0, 1) * 255).toString(16)).slice(-2);
    return '#' + x(r) + x(g) + x(b);
  }
  G.makeRamp = function (hex, n, spread, hueShift) {
    const [h, s, l] = rgb2hsl(...hexRgb(hex)), out = [];
    n = n || 6; spread = spread == null ? .5 : spread; hueShift = hueShift == null ? .04 : hueShift;
    for (let i = 0; i < n; i++) {
      const t = i / (n - 1) - .5; // -0.5..0.5
      // 暗部は色相を寒色側へ、明部は暖色側へ少しずらし、彩度も調整（ドット絵の定番の陰影）
      out.push(hsl2hex((h - t * hueShift + 1) % 1, G.clamp(s * (1 + (-t) * .35), 0, 1), G.clamp(l + t * spread, .03, .97)));
    }
    return out;
  };
  G.hueRamp = function (cols, dh, ds, dl) { return cols.map(c => { const [h, s, l] = rgb2hsl(...hexRgb(c)); return hsl2hex((h + dh + 1) % 1, G.clamp(s * (ds || 1), 0, 1), G.clamp(l + (dl || 0), 0, 1)); }); };

  // ---------------------------------------------------------- 描画バッファ
  class Buf {
    constructor(wu, hu, ox, oy, k) { // wu,hu: ワールド単位の大きさ / ox,oy: 原点（ドット）/ k: 図形の拡大率
      this.w = Math.round(wu * RES); this.h = Math.round(hu * RES); this.ox = ox; this.oy = oy; this.k = k || 1;
      const n = this.w * this.h;
      this.mat = new Int16Array(n).fill(-1); this.lv = new Float32Array(n); this.z = new Float32Array(n).fill(-1e9);
      this.col = new Uint32Array(n); this.sid = new Int32Array(n).fill(-1); this.nsh = 0; this.dth = new Float32Array(n).fill(1);
    }
  }
  G.P3Buf = Buf;
  // 図形を描く。o: { bb:[u0,v0,u1,v1], inside(u,v), h(u,v)→0..1, mat, z, bulge, amb, spec, shin, color(u,v)→rgb配列, blend, lv(常に固定の段階), dith }
  G.P3shape = function (b, o) {
    const k = b.k, sid = b.nsh++;
    const x0 = Math.max(0, Math.floor(b.ox + o.bb[0] * k * RES)), x1 = Math.min(b.w - 1, Math.ceil(b.ox + o.bb[2] * k * RES));
    const y0 = Math.max(0, Math.floor(b.oy + o.bb[1] * k * RES)), y1 = Math.min(b.h - 1, Math.ceil(b.oy + o.bb[3] * k * RES));
    const mat = o.mat == null ? -1 : (typeof o.mat === 'string' ? rampIdx[o.mat] : o.mat);
    const nl = mat >= 0 ? ramps[mat].length : 1, bulge = o.bulge == null ? 1.2 : o.bulge, amb = o.amb == null ? .28 : o.amb;
    const e = .12, z = o.z || 0;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const u = (px + .5 - b.ox) / RES / k, v = (py + .5 - b.oy) / RES / k;
      if (!o.inside(u, v)) continue;
      const i = py * b.w + px;
      if (o.blend != null) { // ディザで半透明に重ねる（頬の赤み・光の反射など）
        const a = typeof o.blend === 'function' ? o.blend(u, v) : o.blend;
        if (BAYER[(py & 3) * 4 + (px & 3)] > a || b.mat[i] === -1 && b.col[i] === 0) continue;
      }
      if (o.color) { const c = o.color(u, v); if (!c) continue; b.mat[i] = -2; b.col[i] = (c[0] << 16) | (c[1] << 8) | c[2]; b.z[i] = z; b.sid[i] = sid; b.lv[i] = 0; continue; }
      let lvl;
      if (o.lv != null) lvl = o.lv;
      else {
        const h = o.h ? o.h(u, v) : 1;
        let nx = 0, ny = 0;
        if (o.h) { nx = -(o.h(u + e, v) - o.h(u - e, v)) / (2 * e) * bulge; ny = -(o.h(u, v + e) - o.h(u, v - e)) / (2 * e) * bulge; }
        const nn = Math.hypot(nx, ny, 1); nx /= nn; ny /= nn; const nz = 1 / nn;
        const d = nx * L[0] + ny * L[1] + nz * L[2];
        let s = amb + (1 - amb) * Math.max(0, (d + .15) / 1.15);
        if (o.spec) s += Math.pow(Math.max(0, nx * HV[0] + ny * HV[1] + nz * HV[2]), o.shin || 24) * o.spec;
        if (o.shade) s = o.shade(s, u, v, h);
        lvl = s * (nl - .01);
      }
      b.mat[i] = mat; b.lv[i] = lvl; b.z[i] = z; b.sid[i] = sid; b.dth[i] = o.dith == null ? 1 : o.dith;
    }
  };
  // 仕上げ：量子化＋ディザ、重なりの影、色付きの輪郭 → キャンバス
  G.P3finish = function (b, o) {
    o = o || {};
    const W = b.w, H = b.h, n = W * H, lvI = new Int8Array(n);
    const dz = o.aoZ == null ? .5 : o.aoZ;
    for (let i = 0; i < n; i++) {
      if (b.mat[i] < 0) continue;
      const x = i % W, y = (i / W) | 0, l = b.lv[i], f = Math.floor(l), t = l - f;
      const th = .5 + (BAYER[(y & 3) * 4 + (x & 3)] - .5) * (o.dither == null ? .5 : o.dither) * b.dth[i];
      lvI[i] = Math.min(ramps[b.mat[i]].length - 1, Math.max(0, f + (t > th ? 1 : 0)));
    }
    // 手前の部品に接する奥側のドットを1段暗く（部品の境目に影ができ立体的に見える）
    if (o.ao !== false) {
      const dark = new Uint8Array(n);
      for (let i = 0; i < n; i++) {
        if (b.mat[i] === -1) continue;
        const x = i % W, zi = b.z[i];
        if ((x > 0 && b.mat[i - 1] !== -1 && b.z[i - 1] > zi + dz) || (x < W - 1 && b.mat[i + 1] !== -1 && b.z[i + 1] > zi + dz) ||
          (i >= W && b.mat[i - W] !== -1 && b.z[i - W] > zi + dz) || (i < n - W && b.mat[i + W] !== -1 && b.z[i + W] > zi + dz)) dark[i] = 1;
      }
      for (let i = 0; i < n; i++) if (dark[i]) { if (b.mat[i] >= 0) lvI[i] = Math.max(0, lvI[i] - 2); else b.col[i] = mulCol(b.col[i], .72); }
    }
    const c = G.canvas(W, H), x = c.getContext('2d'), img = x.createImageData(W, H), d = img.data;
    const put = (i, r, g, bb, a) => { d[i * 4] = r; d[i * 4 + 1] = g; d[i * 4 + 2] = bb; d[i * 4 + 3] = a == null ? 255 : a; };
    for (let i = 0; i < n; i++) {
      const m = b.mat[i];
      if (m === -1) continue;
      if (m === -2) { const v = b.col[i]; put(i, v >> 16 & 255, v >> 8 & 255, v & 255); }
      else { const cc = ramps[m][lvI[i]]; put(i, cc[0], cc[1], cc[2]); }
    }
    // 外周の輪郭：隣の色をぐっと暗くした色（黒一色より柔らかい）。光の当たる左上側は少し明るめ
    if (o.outline !== false) {
      const oc = hexRgb(o.outlineCol || '#140c0a');
      const src = new Uint8ClampedArray(d);
      for (let i = 0; i < n; i++) {
        if (b.mat[i] !== -1) continue;
        const xx = i % W;
        const nb = [xx > 0 ? i - 1 : -1, xx < W - 1 ? i + 1 : -1, i - W, i + W].filter(j => j >= 0 && j < n && b.mat[j] !== -1);
        if (!nb.length) continue;
        const j = nb[0], lit = (b.mat[i + 1] !== -1 && xx < W - 1) || (b.mat[i + W] !== -1 && i + W < n); // 右・下に本体＝左上側の輪郭
        const mix = lit ? .55 : .78;
        put(i, src[j * 4] * (1 - mix) + oc[0] * mix, src[j * 4 + 1] * (1 - mix) + oc[1] * mix, src[j * 4 + 2] * (1 - mix) + oc[2] * mix);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  };
  const mulCol = (v, k) => ((Math.round((v >> 16 & 255) * k) << 16) | (Math.round((v >> 8 & 255) * k) << 8) | Math.round((v & 255) * k));

  // ---------------------------------------------------------- 基本図形
  // 楕円（ドーム状の高さ）。rotで回転
  G.P3ell = function (cx, cy, rx, ry, rot) {
    const c = Math.cos(rot || 0), s = Math.sin(rot || 0), R = Math.max(rx, ry);
    const q = (u, v) => { const dx = u - cx, dy = v - cy, a = (dx * c + dy * s) / rx, b2 = (-dx * s + dy * c) / ry; return a * a + b2 * b2; };
    return { bb: [cx - R, cy - R, cx + R, cy + R], inside: (u, v) => q(u, v) <= 1, h: (u, v) => Math.sqrt(Math.max(0, 1 - q(u, v))) };
  };
  // カプセル（線分＋半径。半径は始点→終点で変化）。円柱のような陰影
  G.P3cap = function (x0, y0, x1, y1, r0, r1) {
    if (r1 == null) r1 = r0;
    const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1e-6, R = Math.max(r0, r1);
    const f = (u, v) => { let t = ((u - x0) * dx + (v - y0) * dy) / L2; t = Math.max(0, Math.min(1, t)); const px = x0 + dx * t, py = y0 + dy * t, r = r0 + (r1 - r0) * t; return Math.hypot(u - px, v - py) / r; };
    return { bb: [Math.min(x0, x1) - R, Math.min(y0, y1) - R, Math.max(x0, x1) + R, Math.max(y0, y1) + R], inside: (u, v) => f(u, v) <= 1, h: (u, v) => Math.sqrt(Math.max(0, 1 - f(u, v) ** 2)) };
  };
  // 多角形（縁が面取りされた板のような高さ）
  G.P3poly = function (pts, bevel) {
    bevel = bevel || .6;
    let u0 = 1e9, v0 = 1e9, u1 = -1e9, v1 = -1e9;
    for (const [u, v] of pts) { u0 = Math.min(u0, u); v0 = Math.min(v0, v); u1 = Math.max(u1, u); v1 = Math.max(v1, v); }
    const inside = (u, v) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [xi, yi] = pts[i], [xj, yj] = pts[j]; if ((yi > v) !== (yj > v) && u < (xj - xi) * (v - yi) / (yj - yi) + xi) c = !c; } return c; };
    const edge = (u, v) => { let m = 1e9; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const [ax, ay] = pts[j], [bx, by] = pts[i], ex = bx - ax, ey = by - ay, l2 = ex * ex + ey * ey || 1e-6; let t = ((u - ax) * ex + (v - ay) * ey) / l2; t = Math.max(0, Math.min(1, t)); m = Math.min(m, Math.hypot(u - ax - ex * t, v - ay - ey * t)); } return m; };
    return { bb: [u0, v0, u1, v1], inside, h: (u, v) => Math.sqrt(Math.min(1, edge(u, v) / bevel)) };
  };
  // 角丸の四角
  G.P3rect = function (x0, y0, x1, y1, rad, bevel) {
    rad = rad || .3; bevel = bevel || .5;
    const sd = (u, v) => { const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2, hx = (x1 - x0) / 2 - rad, hy = (y1 - y0) / 2 - rad; const qx = Math.abs(u - cx) - hx, qy = Math.abs(v - cy) - hy; return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - rad; };
    return { bb: [x0, y0, x1, y1], inside: (u, v) => sd(u, v) <= 0, h: (u, v) => Math.sqrt(Math.min(1, -sd(u, v) / bevel)) };
  };
  // 図形の組み合わせ（和：高い方の高さ）
  G.P3union = function (...sh) {
    return { bb: [Math.min(...sh.map(s => s.bb[0])), Math.min(...sh.map(s => s.bb[1])), Math.max(...sh.map(s => s.bb[2])), Math.max(...sh.map(s => s.bb[3]))],
      inside: (u, v) => sh.some(s => s.inside(u, v)), h: (u, v) => { let m = 0; for (const s of sh) if (s.inside(u, v)) m = Math.max(m, s.h(u, v)); return m; } };
  };
  // 図形を描く簡易関数
  G.P3 = (b, shape, mat, z, extra) => G.P3shape(b, Object.assign({ bb: shape.bb, inside: shape.inside, h: shape.h, mat, z }, extra || {}));
  G.P3hash = (x, y) => { const s = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return s - Math.floor(s); };
  G.P3noise = function (x, y) { // なめらかな値ノイズ
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, sm = t => t * t * (3 - 2 * t);
    const a = G.P3hash(xi, yi), b = G.P3hash(xi + 1, yi), c = G.P3hash(xi, yi + 1), d = G.P3hash(xi + 1, yi + 1);
    return G.lerp(G.lerp(a, b, sm(xf)), G.lerp(c, d, sm(xf)), sm(yf));
  };
})();
