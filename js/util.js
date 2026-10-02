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
// ---------- 目のパーツ分け（「＞＜」の目に差し替えるため） ----------
// px：ドット絵（0xAABBGGRR）、eyes：目のまわりの枠 [x0,y0,x1,y1] の配列、skinPt：肌の色を取る点
// 返り値 lab：各点が 1＝目（白目・黒目・光・まつ毛）、2＝髪など目の上に重なっているもの、3＝肌、0＝それ以外
//   色の出どころで見分ける：目の真ん中によく出る色＝目、目より上の髪によく出る色＝髪、ほおの色＝肌。
//   線の色（暗い色）や両方に出る色は、まわりに目と髪のどちらが多いかで決める
G.eyeParts = function (px, w, h, eyes, skinPt) {
  const lab = new Uint8Array(w * h), sum = v => (v & 255) + (v >> 8 & 255) + (v >> 16 & 255), DARK = 200;
  let ex0 = 1e9, ey0 = 1e9, ex1 = -1, ey1 = -1;
  for (const [x0, y0, x1, y1] of eyes) { ex0 = Math.min(ex0, x0); ey0 = Math.min(ey0, y0); ex1 = Math.max(ex1, x1); ey1 = Math.max(ey1, y1); }
  // 肌：指定の点の色と、目のすぐ下（ほお）の明るい色
  const skin = new Set([px[skinPt[1] * w + skinPt[0]]]);
  for (let y = ey1 + 1; y <= Math.min(h - 1, ey1 + 5); y++) for (let x = ex0; x <= ex1; x++) { const v = px[y * w + x]; if (v && sum(v) > 480) skin.add(v); }
  // 髪：目のすぐ上（前髪）の色の出やすさ。リボンなどの飾りが入らないように、目の幅の中・目の少し上だけを見る
  const hairC = new Map(); let hairN = 0;
  for (let y = Math.max(0, ey0 - 12); y <= ey0 - 2; y++) for (let x = ex0; x <= ex1; x++) { const v = px[y * w + x]; if (!v || skin.has(v)) continue; hairC.set(v, (hairC.get(v) || 0) + 1); hairN++; }
  // 目：それぞれの枠の真ん中あたりの色の出やすさ
  const eyeC = new Map(); let eyeN = 0;
  for (const [x0, y0, x1, y1] of eyes) {
    const mx = (x1 - x0) * .3, my = (y1 - y0) * .3;
    for (let y = Math.round(y0 + my); y <= y1 - my; y++) for (let x = Math.round(x0 + mx); x <= x1 - mx; x++) { const v = px[y * w + x]; if (!v || skin.has(v)) continue; eyeC.set(v, (eyeC.get(v) || 0) + 1); eyeN++; }
  }
  const inBox = (x, y) => eyes.some(([x0, y0, x1, y1]) => x >= x0 && x <= x1 && y >= y0 && y <= y1);
  const amb = [];
  for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
    if (!inBox(x, y)) continue; const i = y * w + x, v = px[i]; if (!v) continue;
    if (skin.has(v)) { lab[i] = 3; continue; }
    const e = (eyeC.get(v) || 0) / Math.max(1, eyeN), hr = (hairC.get(v) || 0) / Math.max(1, hairN);
    if (sum(v) < DARK) { lab[i] = 0; amb.push(i); continue; } // 線の色はあとで決める
    if (e > 0 && e >= hr * 1.2) lab[i] = 1; else if (hr > 0) { lab[i] = 2; if (e > 0) amb.push(i); } else lab[i] = 1; // 髪に出ない色（白目など）は目
  }
  // まつ毛：目の中身（白目・黒目）のすぐ外側をふちどる暗い線は目。目の中身の上下左右の広がりから少しはみ出した所まで
  for (const [x0, y0, x1, y1] of eyes) {
    const cMin = {}, cMax = {}, rMin = {}, rMax = {};
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (lab[y * w + x] === 1) {
      cMin[x] = Math.min(cMin[x] ?? 1e9, y); cMax[x] = Math.max(cMax[x] ?? -1, y); rMin[y] = Math.min(rMin[y] ?? 1e9, x); rMax[y] = Math.max(rMax[y] ?? -1, x);
    }
    const colOk = (x, y) => [x - 1, x, x + 1].some(c => cMin[c] !== undefined && y >= cMin[c] - 3 && y <= cMax[c] + 2);
    const rowOk = (x, y) => [y - 2, y - 1, y, y + 1, y + 2].some(r => rMin[r] !== undefined && x >= rMin[r] - 2 && x <= rMax[r] + 2);
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const i = y * w + x, v = px[i]; if (v && !lab[i] && sum(v) < DARK && colOk(x, y) && rowOk(x, y)) lab[i] = 1; }
  }
  // 残った線の色は、まわり（8方向）に目と髪のどちらが多いかで決める。何回か繰り返して、線が目の側・髪の側に分かれるようにする
  for (let it = 0; it < 4; it++) for (const i of amb) {
    let ne = 0, nh = 0; const x = i % w, y = (i / w) | 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { if (!dx && !dy) continue; const l = lab[(y + dy) * w + x + dx]; if (l === 1) ne++; else if (l === 2) nh++; }
    lab[i] = ne > 0 && ne >= nh ? 1 : nh > 0 ? 2 : lab[i];
  }
  // 髪の色だけど、ほとんど目に囲まれている点（目の中の光など）は目
  for (let y = ey0; y <= ey1; y++) for (let x = ex0; x <= ex1; x++) {
    const i = y * w + x; if (lab[i] !== 2 || !inBox(x, y)) continue; let ne = 0;
    for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) if ((dx || dy) && lab[(y + dy) * w + x + dx] === 1) ne++;
    if (ne >= 5) lab[i] = 1;
  }
  return lab;
};
// 「＞＜」の目に差し替える：目のパーツだけ肌色にして、目か肌だった所にだけ「＞」「＜」を描く（重なった髪はそのまま上に残る）
G.dizzyEyes = function (px, w, h, eyes, skinPt) {
  const lab = G.eyeParts(px, w, h, eyes, skinPt), skin = px[skinPt[1] * w + skinPt[0]];
  eyes.forEach(([x0, y0, x1, y1], k) => {
    let lash = 0, dark = 1e9, cx = 0, cy = 0, n = 0, ty0 = 1e9, ty1 = -1;
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
      const i = y * w + x; if (lab[i] !== 1) continue;
      const b = (px[i] & 255) + (px[i] >> 8 & 255) + (px[i] >> 16 & 255); if (b < dark) { dark = b; lash = px[i]; }
      cx += x; cy += y; n++; ty0 = Math.min(ty0, y); ty1 = Math.max(ty1, y); px[i] = skin; lab[i] = 3;
    }
    if (!n) return;
    cx /= n; cy = (ty0 + ty1) / 2 + 1;
    const hh = Math.max(2, Math.min(5, Math.floor((ty1 - ty0) / 2) - 1)), ww = hh + 1;
    const left = Math.round(cx - ww / 2), tip = k === 0 ? left + ww : left, base = k === 0 ? left : left + ww, d = tip > base ? -1 : 1;
    const put = (x, y) => { const i = y * w + x; if (lab[i] === 3) px[i] = lash; }; // 髪の上には描かない
    for (let s = 0; s <= hh; s++) { const x = Math.round(base + (tip - base) * s / hh); for (const yy of [Math.round(cy) - hh + s, Math.round(cy) + hh - s]) { put(x, yy); put(x + d, yy); } }
  });
};
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
  if (n < 1e5) return Math.floor(n).toLocaleString('ja-JP'); // 10万までは桁区切りでそのまま（3.95A のような記号は分かりにくい）
  const J = [[1e16, '京'], [1e12, '兆'], [1e8, '億'], [1e4, '万']];
  if (n < 1e20) for (const [b, s] of J) if (n >= b) { const v = n / b; return (v < 10 ? v.toFixed(2) : v < 100 ? v.toFixed(1) : Math.floor(v)) + s; }
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
