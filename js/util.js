'use strict';
// 共通ユーティリティ
window.G = {};
G.TILE = 16;
G.clamp = (v, a, b) => v < a ? a : v > b ? b : v;
G.lerp = (a, b, t) => a + (b - a) * t;
G.dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
G.easeOut = t => 1 - Math.pow(1 - t, 3);
G.easeIn = t => t * t * t;
G.easeInOut = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
G.easeOutBack = t => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2); };
G.angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
// 指数的な追従（フレームレート非依存）
G.damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);

// 状態を保存できるシード付き乱数
class RNG {
  constructor(seed) { this.s = (seed >>> 0) || 0x9e3779b9; }
  next() {
    let t = (this.s = (this.s + 0x6D2B79F5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  range(a, b) { return a + (b - a) * this.next(); }
  int(a, b) { return a + Math.floor(this.next() * (b - a + 1)); }
  pick(a) { return a[Math.floor(this.next() * a.length)]; }
  chance(p) { return this.next() < p; }
  weighted(list) {
    let tot = 0; for (const e of list) tot += e[1];
    let r = this.next() * tot;
    for (const e of list) { r -= e[1]; if (r <= 0) return e[0]; }
    return list[list.length - 1][0];
  }
  shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(this.next() * (i + 1)); const t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
}
G.RNG = RNG;
G.rng = new RNG((Math.random() * 4294967296) >>> 0);
G.R = () => G.rng.next();

G.hash2 = (x, y, s) => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

// 大きな数の表記：1000ごとに単位 A・B・C…Z、その先は AA・AB…（例 1650 → 1.65A、2.4億 → 240B）
G.fmtBig = n => {
  n = Math.max(0, n || 0);
  if (n < 1000) return String(Math.floor(n));
  let u = Math.floor(Math.log10(n) / 3), v = n / Math.pow(1000, u);
  if (v >= 999.5) { u++; v /= 1000; }
  const unit = u <= 26 ? String.fromCharCode(64 + u) : String.fromCharCode(64 + Math.floor((u - 1) / 26)) + String.fromCharCode(65 + (u - 1) % 26);
  return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + unit;
};
G.fmt = n => {
  n = Math.round(n);
  if (n >= 1e8) return (n / 1e6).toFixed(0) + 'M';
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M';
  if (n >= 1e5) return (n / 1e3).toFixed(0) + 'K';
  return '' + n;
};

G.canvas = (w, h) => { const c = document.createElement('canvas'); c.width = Math.max(1, w | 0); c.height = Math.max(1, h | 0); return c; };

// base64 <-> Uint8Array（探索済みマップの保存用）
G.packBits = arr => {
  const n = Math.ceil(arr.length / 8), b = new Uint8Array(n);
  for (let i = 0; i < arr.length; i++) if (arr[i]) b[i >> 3] |= 1 << (i & 7);
  let s = ''; for (let i = 0; i < n; i++) s += String.fromCharCode(b[i]);
  return btoa(s);
};
G.unpackBits = (str, len) => {
  const out = new Uint8Array(len);
  try {
    const s = atob(str);
    for (let i = 0; i < len; i++) out[i] = (s.charCodeAt(i >> 3) >> (i & 7)) & 1;
  } catch (e) { /* 壊れたデータは未探索扱い */ }
  return out;
};
