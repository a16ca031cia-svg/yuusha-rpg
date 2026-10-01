'use strict';
// ===== 拡大されたドット絵の画像を、元の1ドット単位の絵に戻す =====
// 格子の間隔が場所によって少し揺れていても合うように、色の境目（格子線）を1本ずつ探して区切る。
(function () {
  const cd = (a, b) => (a[0] - b[0]) ** 2 * .3 + (a[1] - b[1]) ** 2 * .59 + (a[2] - b[2]) ** 2 * .11;
  function kmeans(pts, K) {
    let cen = []; for (let k = 0; k < K; k++) cen.push(pts[Math.floor((k + .5) / K * pts.length * 7919) % pts.length].slice());
    const asg = new Int16Array(pts.length);
    for (let it = 0; it < 10; it++) {
      for (let n = 0; n < pts.length; n++) { let bi = 0, bd = 1e18; for (let k = 0; k < K; k++) { const v = cd(pts[n], cen[k]); if (v < bd) { bd = v; bi = k; } } asg[n] = bi; }
      const s = cen.map(() => [0, 0, 0, 0]);
      for (let n = 0; n < pts.length; n++) { const t = s[asg[n]]; t[0] += pts[n][0]; t[1] += pts[n][1]; t[2] += pts[n][2]; t[3]++; }
      cen = s.map((t, k) => t[3] ? [t[0] / t[3], t[1] / t[3], t[2] / t[3]] : cen[k]);
    }
    return cen.map(c => c.map(v => Math.round(v)));
  }
  // 1方向の格子線の位置：色の変化の強さの山を、おおよその間隔 p ずつたどって拾う
  function lines(prof, p, n) {
    const sm = new Float64Array(n); for (let i = 1; i < n - 1; i++) sm[i] = prof[i - 1] * .5 + prof[i] + prof[i + 1] * .5;
    // 全体の周期と位相（フーリエ）
    let best = [0, 0];
    for (let q = p - .6; q <= p + .6; q += .005) { let re = 0, im = 0; for (let t = 0; t < n; t++) { if (!sm[t]) continue; const a = 2 * Math.PI * t / q; re += sm[t] * Math.cos(a); im += sm[t] * Math.sin(a); } const m = Math.hypot(re, im); if (m > best[0]) best = [m, q, Math.atan2(im, re)]; }
    const q = best[1], ph = (((best[2] / (2 * Math.PI)) * q) % q + q) % q;
    const mean = sm.reduce((a, b) => a + b, 0) / n;
    // 位相の位置から前後へ、次の線の予想位置の近くで一番強い山に合わせる
    const snap = e => { let bi = -1, bv = mean * .6; for (let t = Math.round(e - 2.5); t <= Math.round(e + 2.5); t++) if (t > 0 && t < n && sm[t] > bv) { bv = sm[t]; bi = t; } return bi < 0 ? e : bi; };
    const L = [ph]; let step = q;
    for (let e = ph; e + step < n;) { const nx = snap(e + step); step = G.clamp(step * .8 + (nx - e) * .2, q - .7, q + .7); L.push(nx); e = nx; }
    step = q;
    for (let e = ph; e - step > 0;) { const nx = snap(e - step); step = G.clamp(step * .8 + (e - nx) * .2, q - .7, q + .7); L.unshift(nx); e = nx; }
    return L;
  }
  G.pixelize = function (img, K) {
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height, c = G.canvas(W, H), x = c.getContext('2d');
    x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, W, H).data, px = new Float64Array(W), py = new Float64Array(H);
    for (let y = 1; y < H; y++) for (let xx = 1; xx < W; xx++) {
      const i = (y * W + xx) * 4, j = i - 4, k = i - W * 4;
      const ax = Math.abs(d[i + 3] - d[j + 3]) + Math.abs(d[i] - d[j]) + Math.abs(d[i + 1] - d[j + 1]) + Math.abs(d[i + 2] - d[j + 2]);
      const ay = Math.abs(d[i + 3] - d[k + 3]) + Math.abs(d[i] - d[k]) + Math.abs(d[i + 1] - d[k + 1]) + Math.abs(d[i + 2] - d[k + 2]);
      if (ax > 40) px[xx] += ax; if (ay > 40) py[y] += ay;
    }
    const LX = lines(px, 9.8, W), LY = lines(py, 9.8, H);
    const nx = LX.length - 1, ny = LY.length - 1, cols = [], alpha = [];
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      // ドットの中央付近の色の中央値（境目のにじみを避ける）
      const x0 = LX[i], x1 = LX[i + 1], y0 = LY[j], y1 = LY[j + 1], r = [], g = [], b = [], a = [];
      for (let yy = Math.ceil(y0 + (y1 - y0) * .3); yy <= Math.floor(y1 - (y1 - y0) * .3); yy++) for (let xx = Math.ceil(x0 + (x1 - x0) * .3); xx <= Math.floor(x1 - (x1 - x0) * .3); xx++) {
        const k = (yy * W + xx) * 4; r.push(d[k]); g.push(d[k + 1]); b.push(d[k + 2]); a.push(d[k + 3]);
      }
      if (!a.length) { const k = ((Math.round((y0 + y1) / 2)) * W + Math.round((x0 + x1) / 2)) * 4; r.push(d[k]); g.push(d[k + 1]); b.push(d[k + 2]); a.push(d[k + 3]); }
      const med = v => v.sort((p, q) => p - q)[v.length >> 1];
      cols.push([med(r), med(g), med(b)]); alpha.push(med(a));
    }
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let p = 0; p < nx * ny; p++) if (alpha[p] >= 128) { const i = p % nx, j = (p / nx) | 0; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
    const w = x1 - x0 + 1, h = y1 - y0 + 1, pts = [];
    for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const p = j * nx + i; if (alpha[p] >= 128) pts.push(cols[p]); }
    const pal = kmeans(pts, K || 48), out = new Uint32Array(w * h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const p = (j + y0) * nx + (i + x0); if (alpha[p] < 128) continue;
      let bi = 0, bd = 1e18; for (let k = 0; k < pal.length; k++) { const v = cd(cols[p], pal[k]); if (v < bd) { bd = v; bi = k; } }
      const c2 = pal[bi]; out[j * w + i] = ((255 << 24) | (c2[2] << 16) | (c2[1] << 8) | c2[0]) >>> 0;
    }
    return { w, h, px: out };
  };
  // 確認用：ドットの配列をキャンバスに
  G.pixCanvas = s => { const c = G.canvas(s.w, s.h), x = c.getContext('2d'), im = x.createImageData(s.w, s.h); new Uint32Array(im.data.buffer).set(s.px); x.putImageData(im, 0, 0); return c; };
})();
