'use strict';
// ===== 勇者：提供されたドット絵から差分を作ってアニメーションする =====
// 起動時に埋め込み画像を元のドット格子（122x121）へ戻し、部位ごとの層に分ける：
//   マント／後ろのブーツ／体／前のブーツ／頭／剣／前の手
// 各コマは層をずらす・剣を回転する・マントを波打たせる・髪先を揺らす等で作る（1ドット=0.25単位）。
// 元の絵は左向き。右向きは左右反転して描く。
(function () {
  const SRC = { S: 9.96, OX: .48, OY: -.2 };        // 元画像のドット格子（1ドット≒10ピクセル）
  const PADX = 8, PADY = 18, FW = 140, FH = 144;
  const FOOT_X = 60, FOOT_Y = 120;                   // 絵の中の足元（ドット）
  G.HERO_FRAME = { FW, FH, OX: PADX + FOOT_X, OY: PADY + FOOT_Y, left: true };
  const PIV = { x: 37, y: 86 };                      // 剣の回転の支点（握り）

  let SP = null; // { w, h, px: Uint32Array(RGBA), L: 層 }
  G.heroReady = () => !!SP;
  G.heroDebug = () => SP;

  // ---------------------------------------------------------- 読み込みと格子の復元
  function load() {
    if (!G.HERO_SRC) return;
    const img = new Image();
    img.onload = () => {
      const W = img.naturalWidth, H = img.naturalHeight, c = G.canvas(W, H), x = c.getContext('2d');
      x.drawImage(img, 0, 0);
      const d = x.getImageData(0, 0, W, H).data;
      const nx = Math.floor((W - SRC.OX) / SRC.S), ny = Math.floor((H - SRC.OY) / SRC.S);
      const cols = [], alpha = [];
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const cx = SRC.OX + (i + .5) * SRC.S, cy = SRC.OY + (j + .5) * SRC.S, r = [], g = [], b = [], a = [];
        for (let dy = -2; dy <= 2; dy += 2) for (let dx = -2; dx <= 2; dx += 2) {
          const X = Math.round(cx + dx), Y = Math.round(cy + dy); if (X < 0 || Y < 0 || X >= W || Y >= H) continue;
          const k = (Y * W + X) * 4; r.push(d[k]); g.push(d[k + 1]); b.push(d[k + 2]); a.push(d[k + 3]);
        }
        const med = v => v.sort((p, q) => p - q)[v.length >> 1];
        cols.push([med(r), med(g), med(b)]); alpha.push(med(a));
      }
      let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
      for (let p = 0; p < nx * ny; p++) if (alpha[p] >= 128) { const i = p % nx, j = (p / nx) | 0; x0 = Math.min(x0, i); x1 = Math.max(x1, i); y0 = Math.min(y0, j); y1 = Math.max(y1, j); }
      const w = x1 - x0 + 1, h = y1 - y0 + 1;
      // 圧縮でにじんだ色を48色に整理（くっきりしたドットに）
      const pts = [];
      for (let j = y0; j <= y1; j++) for (let i = x0; i <= x1; i++) { const p = j * nx + i; if (alpha[p] >= 128) pts.push(cols[p]); }
      const pal = kmeans(pts, 48);
      const px = new Uint32Array(w * h);
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
        const p = (j + y0) * nx + (i + x0); if (alpha[p] < 128) continue;
        let bi = 0, bd = 1e18; for (let k = 0; k < pal.length; k++) { const v = cd(cols[p], pal[k]); if (v < bd) { bd = v; bi = k; } }
        const c2 = pal[bi]; px[j * w + i] = ((255 << 24) | (c2[2] << 16) | (c2[1] << 8) | c2[0]) >>> 0;
      }
      SP = { w, h, px, pal };
      split();
      for (const k in sets) delete sets[k];
    };
    img.src = G.HERO_SRC;
  }
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

  // ---------------------------------------------------------- 部位ごとの層に分ける
  const rgbOf = v => [v & 255, v >> 8 & 255, v >> 16 & 255];
  const isRed = c => c[0] > 95 && c[0] > c[1] * 1.9 && c[0] > c[2] * 1.7;
  const isGold = c => c[0] > 150 && c[1] > 105 && c[2] < 110 && c[0] - c[2] > 70;
  const isCream = c => c[0] > 190 && c[1] > 170 && c[2] > 140;
  const isDark = c => c[0] + c[1] + c[2] < 140;
  function split() {
    const { w, h, px } = SP;
    const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : px[y * w + x];
    const mk = () => new Uint32Array(w * h);
    const L = { cape: mk(), bootB: mk(), body: mk(), bootF: mk(), head: mk(), sword: mk(), hand: mk() };
    const redN = (x, y) => { for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const v = at(x + i, y + j); if (v && isRed(rgbOf(v))) return true; } return false; };
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const v = px[y * w + x]; if (!v) continue;
      const c = rgbOf(v), i = y * w + x;
      // マント：首元より右下へ流れる赤い布（と、その外側の輪郭）
      if (x > 62 && y > 66 && (isRed(c) || (isDark(c) && redN(x, y) && (x > 84 || y > 97)))) { L.cape[i] = v; continue; }
      // 剣：左側の刃と、金の鍔
      if ((x <= 32 && y >= 60 && y <= 100) || (x >= 27 && x <= 38 && y >= 70 && y <= 97 && (isGold(c) || (isDark(c) && x <= 34)))) { L.sword[i] = v; continue; }
      // 前の手（剣を握るミトン）：服の生成り色と赤以外
      if (x >= 33 && x <= 47 && y >= 78 && y <= 93 && !isCream(c) && !isRed(c)) { L.hand[i] = v; continue; }
      // ブーツ
      if (y >= 103 && x < 60) { L.bootF[i] = v; continue; }
      if (y >= 103 && x >= 60 && x < 88) { L.bootB[i] = v; continue; }
      // 頭（首元の赤いフードより上）
      if (y < 63 && !isRed(c)) { L.head[i] = v; continue; }
      L.body[i] = v;
    }
    // 手を動かした時の穴埋め用：手の下を服の色で埋めた体
    const bodyFill = L.body.slice();
    for (let y = 78; y <= 93; y++) for (let x = 33; x <= 47; x++) {
      const i = y * w + x; if (!L.hand[i]) continue;
      for (let k = 1; k < 14; k++) { const v = L.body[y * w + x + k]; if (v && isCream(rgbOf(v))) { bodyFill[i] = v; break; } }
    }
    // 埋めた袖の外側に輪郭、下側に陰を付ける（のっぺりした帯に見えないように）
    const OUT = 0xff0f0723, SHD = 0xff6a8cb6;
    const src = bodyFill.slice();
    for (let y = 78; y <= 93; y++) for (let x = 33; x <= 47; x++) {
      const i = y * w + x; if (!L.hand[i] || !src[i]) continue;
      if (!src[i - 1] || !src[i - w]) bodyFill[i] = OUT;
      else if (y > 86 || !src[i + w] || !src[i + w - 1]) bodyFill[i] = SHD;
    }
    L.bodyFill = bodyFill;
    // 表情差分：目を肌色で塗りつぶし、閉じた目（瞬き）と「><」（被弾）を描き足す
    const SKIN = px[50 * w + 49] || 0xffa7d4fc, LASH = 0xff0f0723, LASH2 = 0xff343964;
    const EYES = [{ x0: 39, x1: 44, y0: 45, y1: 56, yb: 53, apex: 1 }, { x0: 54, x1: 65, y0: 43, y1: 56, yb: 52, apex: -1 }];
    const face = (draw) => {
      const o = L.head.slice();
      for (const e of EYES) for (let y = e.y0; y <= e.y1; y++) for (let x = e.x0; x <= e.x1; x++) if (o[y * w + x]) o[y * w + x] = SKIN;
      const put = (x, y, v) => { if (x >= 0 && y >= 0 && x < w && y < h) o[y * w + x] = v; };
      for (const e of EYES) draw(e, put);
      return o;
    };
    L.headBlink = face((e, put) => {
      const cx = (e.x0 + e.x1) / 2, hw = (e.x1 - e.x0) / 2;
      for (let x = e.x0; x <= e.x1; x++) { const t = Math.abs(x - cx) / hw, y = e.yb + (t < .55 ? 1 : 0); put(x, y, LASH); if (t < .85) put(x, y - 1, LASH2); }
    });
    L.headHurt = face((e, put) => {
      // 左の目は「>」、右の目は「<」
      const tip = e.apex > 0 ? e.x1 : e.x0 + 1, base = e.apex > 0 ? e.x0 : e.x1, my = e.yb - 3;
      for (let k = 0; k <= 4; k++) { const x = Math.round(base + (tip - base) * k / 4), d = e.apex > 0 ? -1 : 1; for (const yy of [my - 4 + k, my + 4 - k]) { put(x, yy, LASH); put(x + d, yy, LASH); put(x, yy + 1, LASH2); } }
    });
    SP.L = L;
    const bbox = lay => { let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1; for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (lay[y * w + x]) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } return { x0, y0, x1, y1 }; };
    SP.bbF = bbox(L.bootF); SP.bbB = bbox(L.bootB);
    // 走りの脚用：ブーツを4倍に補間拡大（回転してもきれいに）・太ももの色（半ズボンの下のタイツ）
    SP.bootF4 = epx2(epx2(L.bootF, w, h), w * 2, h * 2); SP.bootB4 = epx2(epx2(L.bootB, w, h), w * 2, h * 2);
    const cnt = new Map();
    for (let y = 94; y <= 102; y++) for (let x = 40; x <= 84; x++) { const v = L.body[y * w + x]; if (!v) continue; const c = rgbOf(v), sat = Math.max(...c) - Math.min(...c), br = c[0] + c[1] + c[2]; if (sat < 40 && br > 150 && br < 420) cnt.set(v, (cnt.get(v) || 0) + 1); }
    let legV = 0xff5a5048, best = 0; for (const [v, n] of cnt) if (n > best) { best = n; legV = v; }
    const dk = (v, k) => { const c = rgbOf(v); return (0xff000000 | (Math.round(c[2] * k) << 16) | (Math.round(c[1] * k) << 8) | Math.round(c[0] * k)) >>> 0; };
    SP.legF = legV; SP.legF2 = dk(legV, .78); SP.legB = dk(legV, .72); SP.legB2 = dk(legV, .56);
    // 剣は4倍に補間拡大しておく（回転してもギザギザになりにくい）
    SP.sword4 = epx2(epx2(L.sword, w, h), w * 2, h * 2);
  }
  // 数値配列でのEPX拡大（2倍）
  function epx2(src, w, h) {
    const o = new Uint32Array(w * h * 4), at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h) ? 0 : src[y * w + x], W2 = w * 2;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
      let p1 = P, p2 = P, p3 = P, p4 = P;
      if (C === A && C !== D && A !== B) p1 = A; if (A === B && A !== C && B !== D) p2 = B;
      if (D === C && D !== B && C !== A) p3 = C; if (B === D && B !== A && D !== C) p4 = D;
      o[(y * 2) * W2 + x * 2] = p1; o[(y * 2) * W2 + x * 2 + 1] = p2; o[(y * 2 + 1) * W2 + x * 2] = p3; o[(y * 2 + 1) * W2 + x * 2 + 1] = p4;
    }
    return o;
  }

  // ---------------------------------------------------------- 1コマの合成
  const HIP = 100, NECK = 62, LEG1 = 9; // 腰・首の高さ（ドット）、太ももの見える長さ
  function compose(P) {
    const { w, h, L } = SP, out = new Uint32Array(FW * FH);
    const R = P.rig, legs = [];
    // ---- 走りの脚：太ももの角度 a と すね（ブーツ）の角度 p から膝・足の位置を決め、
    //      接地している方の足の裏が必ず地面に着くように体全体の高さを決める（体の上下動が自然に出る）
    let lock = 0;
    if (R) {
      for (const [lay, bb, a, p, back] of [[SP.bootB4, SP.bbB, R.ba, R.bp, true], [SP.bootF4, SP.bbF, R.fa, R.fp, false]]) {
        const cx = (bb.x0 + bb.x1 + 1) / 2, ar = a * Math.PI / 180, ang = -p * Math.PI / 180, ca = Math.cos(ang), sa = Math.sin(ang);
        const hip = { x: cx + (R.hx || 0), y: bb.y0 - LEG1 }, knee = { x: hip.x + LEG1 * Math.sin(ar), y: hip.y + LEG1 * Math.cos(ar) };
        let sole = -1e9;
        for (const [sx, sy] of [[bb.x0, bb.y1 + 1], [bb.x1 + 1, bb.y1 + 1]]) { const dx = sx - cx, dy = sy - bb.y0; sole = Math.max(sole, knee.y + sa * dx + ca * dy); }
        legs.push({ lay, bb, cx, hip, knee, ca, sa, sole, back });
      }
      const ground = Math.max(SP.bbF.y1, SP.bbB.y1) + 1;
      lock = Math.round(ground - Math.max(legs[0].sole, legs[1].sole) - (R.air || 0));
    }
    const hop = Math.round(P.hop || 0), by = Math.round(P.by || 0) + hop + lock, hy = by + Math.round(P.hy || 0), ln = P.lean || 0;
    // 前傾：腰から上を前（左）へ傾ける。胴はせん断、頭は首の位置のずれごとそのまま運ぶ
    const shK = P.shear || 0, shx = y => shK ? -Math.round(shK * Math.max(0, HIP + by - Math.max(y, NECK + by))) : 0;
    const blit = (lay, dx, dy, filter, noShear) => {
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const v = lay[y * w + x]; if (!v) continue;
        const X = x + PADX + dx + (filter ? filter(x, y) : 0) + (noShear ? 0 : shx(y + dy)), Y = y + PADY + dy;
        if (X >= 0 && Y >= 0 && X < FW && Y < FH) out[Y * FW + X] = v;
      }
    };
    // マント：付け根から離れるほど波打ち、後ろへなびく（逆写像なので穴が空かない）。lift で後ろへ持ち上がる
    const cp = P.cape || { amp: .6, ph: 0, st: 0 };
    for (let Y = 0; Y < FH; Y++) for (let X = 0; X < FW; X++) {
      const x0 = X - PADX - Math.round(ln * .5) - shx(Y - PADY), y0 = Y - PADY - by;
      const t = G.clamp((x0 - 66) / 52, 0, 1);
      const sx = x0 - Math.round(cp.st * t * 4 + Math.cos(cp.ph * .8 + y0 * .22) * cp.amp * .6 * t), sy = y0 - Math.round(Math.sin(cp.ph + x0 * .16) * cp.amp * 2.2 * t * t - (cp.lift || 0) * t * t * 7);
      if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
      const v = L.cape[sy * w + sx]; if (v) out[Y * FW + X] = v;
    }
    // 剣の支点（手の位置）
    const hx = Math.round(ln * .5 + (P.hand ? P.hand.x : 0)), hyy = by + (P.hand ? Math.round(P.hand.y) : 0);
    const pivX = PIV.x + PADX + hx + shx(PIV.y + hyy), pivY = PIV.y + PADY + hyy;
    // 剣の残像（振りの途中のコマだけ）：前のコマの角度に淡い刃を並べ、速さを見せる
    if (P.smear) {
      const W4 = w * 4, H4 = h * 4, S4 = SP.sword4;
      P.smear.forEach((r, n) => {
        const a = r * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a), col = n === P.smear.length - 1 ? 0xfffff4e6 : 0xfff0d6c0;
        for (let Y = 0; Y < FH; Y++) for (let X = 0; X < FW; X++) {
          const dx = X + .5 - pivX, dy = Y + .5 - pivY; if (dx * dx + dy * dy < 90) continue; // 柄のあたりは描かない
          const ix = Math.floor((ca * dx + sa * dy + PIV.x) * 4), iy = Math.floor((-sa * dx + ca * dy + PIV.y) * 4);
          if (ix < 0 || iy < 0 || ix >= W4 || iy >= H4) continue;
          if (S4[iy * W4 + ix] && !out[Y * FW + X]) out[Y * FW + X] = col;
        }
      });
    }
    // 脚（走り）：太もも（タイツ）→ 膝から先はブーツを回転して付ける
    const thigh = lg => {
      const ax = lg.hip.x + PADX, ay = lg.hip.y + PADY + lock, bx = lg.knee.x + PADX, by2 = lg.knee.y + PADY + lock + 1.5;
      const ex = bx - ax, ey = by2 - ay, l2 = ex * ex + ey * ey || 1, c1 = lg.back ? SP.legB : SP.legF, c2 = lg.back ? SP.legB2 : SP.legF2;
      for (let pass = 0; pass < 2; pass++) for (let Y = Math.floor(Math.min(ay, by2) - 6); Y <= Math.max(ay, by2) + 6; Y++) for (let X = Math.floor(Math.min(ax, bx) - 6); X <= Math.max(ax, bx) + 6; X++) {
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        let t = ((X + .5 - ax) * ex + (Y + .5 - ay) * ey) / l2; t = G.clamp(t, 0, 1);
        const d = Math.hypot(X + .5 - ax - ex * t, Y + .5 - ay - ey * t);
        if (pass === 0 && d <= 4.3) out[Y * FW + X] = 0xff0f0723;
        if (pass === 1 && d <= 3.3) out[Y * FW + X] = (X + .5 - (ax + ex * t)) > 1.2 ? c2 : c1; // 後ろ側を一段暗く
      }
    };
    const rotBoot = lg => {
      const { lay, bb, cx, knee, ca, sa } = lg, W4 = w * 4, H4 = h * 4, kx = knee.x + PADX, ky = knee.y + PADY + lock, Rr = Math.hypot(bb.x1 - bb.x0, bb.y1 - bb.y0) + 3;
      for (let Y = Math.floor(ky - Rr); Y <= ky + Rr; Y++) for (let X = Math.floor(kx - Rr); X <= kx + Rr; X++) {
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        const dx = X + .5 - kx, dy = Y + .5 - ky;
        const ix = Math.floor((ca * dx + sa * dy + cx) * 4), iy = Math.floor((-sa * dx + ca * dy + bb.y0) * 4);
        if (ix < 0 || iy < 0 || ix >= W4 || iy >= H4) continue;
        const v = lay[iy * W4 + ix]; if (v) out[Y * FW + X] = v;
      }
    };
    // ブーツ（走り以外）：履き口（膝の下）はあまり動かさず、足先ほど大きく動かして脚を振って見せる
    const boot = (lay, bb, o) => {
      const hw = Math.max(1, (bb.x1 - bb.x0) / 2), cx = (bb.x0 + bb.x1) / 2, span = Math.max(1, bb.y1 - bb.y0);
      for (let y = bb.y0; y <= bb.y1; y++) {
        const t = (y - bb.y0) / span, sx = Math.round((o.x || 0) * (.3 + .7 * t));
        for (let x = bb.x0; x <= bb.x1; x++) {
          const v = lay[y * w + x]; if (!v) continue;
          const fy = y + (o.y || 0) * (.35 + .65 * t) - (o.tilt || 0) * (x - cx) / hw * t * t + hop;
          const X = x + PADX + sx, Y0 = Math.floor(fy) + PADY, Y1 = Math.ceil(fy) + PADY;
          if (X < 0 || X >= FW) continue;
          if (Y0 >= 0 && Y0 < FH) out[Y0 * FW + X] = v;
          if (Y1 !== Y0 && Y1 >= 0 && Y1 < FH && y < bb.y1 && lay[(y + 1) * w + x]) out[Y1 * FW + X] = v; // 引き伸ばしで穴が空かないように
        }
      }
    };
    const moveHand = P.hand && (P.hand.x || P.hand.y);
    if (R) { thigh(legs[0]); rotBoot(legs[0]); thigh(legs[1]); }
    else boot(L.bootB, SP.bbB, P.lb || { x: 0, y: 0 });
    blit(moveHand ? L.bodyFill : L.body, Math.round(ln * .5), by);
    if (R) rotBoot(legs[1]); else boot(L.bootF, SP.bbF, P.lf || { x: 0, y: 0 });
    // 剣（支点のまわりに回転）：振りかぶって刃が上を向く時は頭の後ろに描き、顔を隠さない
    const rot = P.rot || 0, a = rot * Math.PI / 180, ca = Math.cos(a), sa = Math.sin(a);
    const W4 = w * 4, H4 = h * 4, S4 = SP.sword4;
    const sword = () => {
      for (let Y = 0; Y < FH; Y++) for (let X = 0; X < FW; X++) {
        const dx = X + .5 - pivX, dy = Y + .5 - pivY;
        const sx = (ca * dx + sa * dy + PIV.x) * 4, sy = (-sa * dx + ca * dy + PIV.y) * 4; // 逆回転して元の剣の位置を参照
        const ix = Math.floor(sx), iy = Math.floor(sy);
        if (ix < 0 || iy < 0 || ix >= W4 || iy >= H4) continue;
        let v = S4[iy * W4 + ix];
        // 刃のきらめき：刃の上を斜めの光の帯が走る（待機のコマ）
        if (v && P.glint != null) { const gx = 30 - P.glint * 30, d = sx / 4 - gx + (sy / 4 - 80) * .6; if (d > -1.2 && d < 1.2 && sx / 4 < 31) { const c = rgbOf(v); if (c[0] + c[1] + c[2] > 330) v = 0xffffffff; } }
        if (v) out[Y * FW + X] = v;
      }
    };
    const behind = rot > 38 && rot < 200;
    if (behind) sword();
    // 頭：前傾・呼吸の遅れ・髪先の揺れ（上の方ほど大きくずらす）。前傾の時は首の位置のずれごと運ぶ
    const sw = P.sway || 0, headX = Math.round(ln) + shx(NECK + by);
    blit(P.eye === 1 ? L.headBlink : P.eye === 2 ? L.headHurt : L.head, headX, hy, (x, y) => y < 30 ? Math.round(sw * (30 - y) / 30) : 0, true);
    if (!behind) sword();
    blit(L.hand, hx, hyy);
    // 層をずらした時に残る孤立した1ドットを消す
    for (let Y = 1; Y < FH - 1; Y++) for (let X = 1; X < FW - 1; X++) {
      const i = Y * FW + X; if (out[i] && !out[i - 1] && !out[i + 1] && !out[i - FW] && !out[i + FW]) out[i] = 0;
    }
    const c = G.canvas(FW, FH), x = c.getContext('2d'), img = x.createImageData(FW, FH);
    new Uint32Array(img.data.buffer).set(out);
    x.putImageData(img, 0, 0);
    return c;
  }
  // ---------------------------------------------------------- ポーズ表（差分）
  const TAU = Math.PI * 2, POSES = {};
  // 待機：呼吸で体が1ドット沈み、頭は少し遅れて追従。髪先とマントがゆっくり揺れる
  POSES.idle = [0, 1, 2, 3, 4, 5, 6, 7].map(i => ({
    by: [0, 0, 0, 1, 1, 1, 1, 0][i], hy: [0, 0, 0, -1, 0, 0, 0, 1][i],
    sway: Math.round(Math.sin(i / 8 * TAU) * 1), cape: { amp: .9, ph: i / 8 * TAU, st: 0 }, glint: i >= 2 && i <= 5 ? (i - 2) / 3 : null,
  }));
  POSES.blink = POSES.idle.map(p => Object.assign({}, p, { eye: 1 }));
  POSES.idleX = POSES.idle.map(p => Object.assign({}, p, { eye: 2 })); // ホームで何度もつつかれた時の「＞＜」の目
  // 足の動き（1歩の周期 q）：前へ振り出す間は足を持ち上げ、踏み出し切るとつま先が上がり（かかとから着地）、
  // 後ろへ送り切るとかかとが上がって蹴り出す
  const foot = (q, stride, lift, tiltK) => {
    const s = Math.sin(q), c = Math.cos(q);
    return { x: Math.round(-s * stride), y: c > 0 ? -c * lift : 0, tilt: (s < -.45 ? (-s - .45) / .55 * 2.6 : s > .6 ? -(s - .6) / .4 * 2 : 0) * tiltK };
  };
  // 歩き（12コマ）：接地で沈み、足が交差する時に伸び上がる。頭は少し遅れて弾み、剣を持つ手は足と逆に振れる
  POSES.walk = Array.from({ length: 12 }, (_, i) => {
    const q = i / 12 * TAU, s = Math.sin(q);
    return {
      lf: foot(q, 5, 3.2, 1), lb: foot(q + Math.PI, 5, 3.2, 1),
      by: Math.round(-Math.cos(2 * q)), hy: Math.round(Math.cos(2 * q)) - Math.round(Math.cos(2 * q - 1.1)), lean: -1,
      sway: Math.round(Math.sin(2 * q + .6) * 1.2), hand: { x: Math.round(s * 2), y: 0 }, rot: -4 + s * 5,
      cape: { amp: 1.2, ph: q * 2, st: .6 },
    };
  });
  // 走り（12コマ）：体を前へ傾け、脚は「接地→踏ん張り→蹴り出し→かかとを後ろへ跳ね上げ→膝を前へ→脚を伸ばして着地」の順に動かす。
  // 接地側の足の裏を地面に固定して体の高さを決めるので、沈み込みと宙に浮く瞬間が自然に出る
  const RUNK = [ // [周期の位置, 太ももの角度, すねの角度]（前向きがマイナス・後ろ向きがプラス）
    [0, -38, -12], [.1, -18, 4], [.22, 8, 14], [.34, 36, 32], [.46, 52, 62], [.58, 38, 112], [.7, -8, 104], [.8, -52, 62], [.9, -62, 4], [1, -38, -12]];
  const runLeg = q => {
    q = ((q % 1) + 1) % 1;
    let i = 0; while (RUNK[i + 1][0] < q) i++;
    const n = RUNK.length, k0 = i > 0 ? RUNK[i - 1] : RUNK[n - 2], k1 = RUNK[i], k2 = RUNK[i + 1], k3 = i + 2 < n ? RUNK[i + 2] : RUNK[1]; // 周期の端は反対側とつなぐ
    const t = (q - k1[0]) / (k2[0] - k1[0]);
    const cr = (a, b, c, d) => .5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t); // なめらかにつなぐ
    return [cr(k0[1], k1[1], k2[1], k3[1]), cr(k0[2], k1[2], k2[2], k3[2])];
  };
  const runPose = (n, air, shear) => Array.from({ length: n }, (_, i) => {
    const q = i / n, [fa, fp] = runLeg(q), [ba, bp] = runLeg(q + .5), s2 = Math.sin(q * TAU * 2);
    // 1歩ごと（周期の半分）に、蹴り出した直後だけ宙に浮く
    const hq = (q * 2) % 1, fly = hq > .38 && hq < .62 ? Math.sin((hq - .38) / .24 * Math.PI) * air : 0;
    return {
      rig: { fa, fp, ba, bp, air: fly }, shear,
      hy: 1 + Math.round(-s2 * .8), lean: -2, sway: 3 + Math.round(s2), eye: 0,
      hand: { x: Math.round(-1 + 2.5 * Math.cos(q * TAU)), y: 2 + Math.round(Math.sin(q * TAU)) }, rot: -48 + Math.sin(q * TAU) * 7,
      cape: { amp: 2.2, ph: q * TAU * 2, st: 2.4, lift: .9 + .3 * s2 },
    };
  });
  POSES.run = runPose(12, 2.5, .34);
  POSES.sprint = runPose(10, 3.5, .44); // 疾走：さらに深く前傾し、長く宙に浮く
  // 急停止：前の足を突っ張って体を少し後ろへ反らし、マントは勢いで前へ振れる
  POSES.skid = [0, 1].map(i => ({
    rig: { fa: -48 + i * 10, fp: -22 + i * 8, ba: 30 - i * 8, bp: 34 - i * 6, hx: 1 }, shear: -.12 + i * .08,
    hy: i ? 0 : 1, sway: -2 + i, hand: { x: 3 - i, y: 1 }, rot: -58 + i * 14, cape: { amp: 1.4, ph: i * 2, st: -1.2 + i * .6, lift: .3 },
  }));
  // 攻撃：剣を振りかぶり→振り下ろし（斬り上げは逆）。手も軌道に沿って動き、踏み込みで前傾
  const atk = (rots, hands) => rots.map((r, i) => ({
    rot: r, hand: hands[i], by: [1, 1, 0, 0, 1, 1][i], lean: [0, 0, -2, -3, -2, -1][i], sway: [1, 1, -1, -2, -1, 0][i],
    lf: { x: [0, 0, -2, -3, -3, -1][i], y: 0 }, lb: { x: [0, 0, 1, 2, 1, 0][i], y: 0 }, cape: { amp: 1.6, ph: i * .9, st: [0, 0, .8, 1.4, 1, .5][i] },
  }));
  POSES.atkA = atk([72, 64, 20, -30, -58, -62], [{ x: 1, y: -4 }, { x: 1, y: -4 }, { x: -1, y: -2 }, { x: -2, y: 1 }, { x: -2, y: 3 }, { x: -1, y: 3 }]);
  POSES.atkB = atk([-60, -55, -15, 30, 62, 70], [{ x: -1, y: 3 }, { x: -1, y: 3 }, { x: -2, y: 1 }, { x: -2, y: -2 }, { x: 0, y: -4 }, { x: 1, y: -4 }]);
  const smear = (arr, sm) => sm.forEach((v, i) => { if (v) arr[i].smear = v; });
  smear(POSES.atkA, [0, 0, [52, 36], [8, -12], [-44], 0]);
  smear(POSES.atkB, [0, 0, [-45, -30], [-2, 16], [46], 0]);
  // 突進：強い前傾、剣を後ろに引いて構え、マントが大きく流れる
  POSES.dash = [0, 1, 2].map(i => ({ rot: -150, hand: { x: 4, y: 1 }, by: 1, lean: -5, sway: 2, lf: { x: -5, y: -2 }, lb: { x: 5, y: 0 }, cape: { amp: 2.2, ph: i * 2, st: 2 } }));
  // 回転斬り：剣が一周する
  POSES.spin = [0, 1, 2, 3, 4, 5].map(i => ({ smear: [-i * 60 + 40, -i * 60 + 20], rot: -i * 60, hand: { x: Math.round(Math.cos(i / 6 * TAU) * 2), y: Math.round(Math.sin(i / 6 * TAU) * 2) }, by: i % 3 === 0 ? 1 : 0, lean: [0, -2, -2, 0, 2, 0][i], sway: [0, -1, -2, 0, 2, 1][i], cape: { amp: 2, ph: i * 1.3, st: 1 } }));
  // 振りかざし（雷撃）：剣を高く掲げる
  POSES.raise = [0, 1, 2].map(i => ({ rot: 68 + i * 2, hand: { x: 2, y: -6 - i }, by: [0, -1, -1][i], sway: [0, 1, 2][i], cape: { amp: 1.2, ph: i, st: 0 } }));
  // 跳躍して地面を打つ（衝撃波）：しゃがむ→跳ぶ→空中→叩きつけ
  POSES.jump = [
    { rot: 60, hand: { x: 1, y: -3 }, by: 3, lean: -1, sway: 1, cape: { amp: .8, ph: 0, st: 0 } },
    { rot: 72, hand: { x: 2, y: -6 }, hop: -10, sway: 2, lf: { x: 0, y: -2 }, lb: { x: 0, y: -2 }, cape: { amp: 1.4, ph: 1, st: -.5 } },
    { rot: 75, hand: { x: 2, y: -7 }, hop: -18, sway: 2, lf: { x: 0, y: -3 }, lb: { x: 1, y: -1 }, cape: { amp: 1.6, ph: 2, st: -.8 } },
    { rot: -70, hand: { x: -2, y: 4 }, by: 3, lean: -3, sway: -2, lf: { x: -2, y: 0 }, lb: { x: 2, y: 0 }, cape: { amp: 2, ph: 3, st: 1.5 } },
  ];
  // 力尽きる：膝をつく
  POSES.down = [{ eye: 1, rot: -80, hand: { x: -1, y: 6 }, by: 7, hy: 1, lean: -2, sway: 2, lf: { x: -2, y: 0 }, lb: { x: 2, y: 0 }, cape: { amp: .3, ph: 0, st: -.3 } }];
  // 被弾：のけぞる（後ろ＝右へ）
  POSES.hurt = [0, 1].map(i => ({ eye: 2, rot: 25, hand: { x: 1, y: -1 }, by: 1 - i, lean: 3 - i, sway: 2, cape: { amp: 1.5, ph: i * 2, st: -.6 } }));

  // ---------------------------------------------------------- コマのキャッシュ（必要な時に作り、残りは空き時間に）
  const sets = {}, queue = [];
  const blank = { n: G.canvas(FW, FH) }; blank.w = blank.n;
  function framesFor() {
    if (!SP) return null;
    if (sets.main) return sets.main;
    const o = {};
    for (const k in POSES) o[k] = POSES[k].map(p => {
      const fr = {};
      Object.defineProperty(fr, 'n', { configurable: true, get() { const c = compose(p); Object.defineProperty(fr, 'n', { value: c }); return c; } });
      queue.push(fr);
      return fr;
    });
    return sets.main = o;
  }
  setInterval(() => { framesFor(); const t0 = performance.now(); while (queue.length && performance.now() - t0 < 6) { const fr = queue.shift(); void fr.n; } }, 40);
  G.heroFrames = () => framesFor();
  G.prewarmHero = () => framesFor();
  G.heroPose = (k, i) => { const F = framesFor(); return F ? F[k][i].n : blank.n; };
  G.heroFrame = function (H) {
    if (G.S && G.S.cur && G.S.cur !== 'hero' && G.charFrame) { const cf = G.charFrame(H); if (cf) return cf; } // ガチャで仲間になったキャラ
    const F = framesFor(); if (!F) return blank;
    const A2 = H.anim, a = H.act;
    const pick = (arr, t) => arr[Math.max(0, Math.min(arr.length - 1, Math.floor(t * arr.length)))];
    let fr;
    if (H.dead) fr = H.deadT < .3 ? F.hurt[0] : F.down[0];
    else if (H.hurtT > 0 && !a) fr = F.hurt[H.hurtT > .15 ? 0 : 1];
    else if (a) {
      const p = Math.min(.999, a.t / a.dur);
      switch (a.k) {
        case 'atk': fr = pick(a.dir === 1 ? F.atkA : F.atkB, G.easeOut(p) * .9 + p * .1); break;
        case 'combo': { const nH = a.n || 4, idx = Math.min(nH - 1, Math.floor(p * nH)), sp = (p * nH) % 1; fr = pick(idx % 2 ? F.atkB : F.atkA, Math.min(.999, sp * 1.3)); break; }
        case 'dash': fr = p < .8 ? F.dash[Math.floor(a.t * 30) % 3] : pick(F.atkA, (p - .8) / .2 * .6 + .3); break;
        case 'spin': fr = pick(F.spin, p); break;
        case 'wave': fr = pick(F.atkA, p); break;
        case 'thunder': fr = p < .75 ? F.raise[Math.min(2, Math.floor(p / .25))] : pick(F.atkA, .5 + (p - .75) * 2); break;
        case 'quake': fr = F.jump[p < .2 ? 0 : p < .35 ? 1 : p < .6 ? 2 : 3]; break;
        case 'ult': fr = p < .45 ? F.raise[Math.min(2, Math.floor(p / .15))] : pick(F.atkA, Math.min(.999, (p - .45) / .3)); break; // 必殺技：振りかぶって振り下ろす
        default: fr = F.idle[0];
      }
    } else if (H.skidT > 0) fr = F.skid[H.skidT > .1 ? 0 : 1];
    else if (H.cheerT > 0) fr = F.raise[Math.min(2, Math.floor((.8 - H.cheerT) * 12))]; // レベルアップ：剣を掲げる
    else if (A2.mv > .45) {
      // 速く動いている時は前傾の走り（疾走中はさらに深く）、ゆっくりの時だけ歩き
      const spd = Math.hypot(H.vx || 0, H.vy || 0), cyc = A2.walk * .75 / TAU, idx = arr => arr[((Math.floor(cyc * arr.length) % arr.length) + arr.length) % arr.length];
      // 提供された走りの絵（左右・後ろ姿）が準備できていればそれを使う。上へ進む時は後ろ姿
      const up = (H.vy || 0) < 0 && Math.abs(H.vy) > Math.abs(H.vx || 0) * 1.1;
      const rf = G.heroRunFrame && G.heroRunFrame(up ? 'B' : H.face > 0 ? 'R' : 'L', cyc * (H.rush ? 1.1 : 1));
      fr = rf || (H.rush ? idx(F.sprint) : spd > 55 ? idx(F.run) : idx(F.walk));
    }
    else fr = (A2.blink > 0 ? F.blink : F.idle)[Math.floor(A2.t * 5) % 8];
    fr.w = fr.w || G.tintCanvas(fr.n, '#ffffff');
    return fr;
  };
  G.heroGhost = fr => fr.g || (fr.g = G.tintCanvas(fr.n, 'rgba(190,230,255,1)'));
  load();
})();
