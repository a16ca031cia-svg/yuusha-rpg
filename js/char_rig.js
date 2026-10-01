'use strict';
// ===== 追加キャラクターの「差分」アニメーション（部位に分けて動かす） =====
// 各画像を「武器（と持つ手）／手前の脚・奥の脚（背面は左右の脚）／なびく髪や布／体」に分け、
//   走り：脚を腰を軸に回して前後を入れ替え、足の裏を地面に合わせて体が上下、脚が開いた瞬間は宙に浮く。武器を持つ腕は脚と逆に振れる
//   背面：左右の脚を交互に持ち上げ、髪や布が波打つ
//   正面：待機は呼吸と髪のなびき、攻撃は武器を振りかぶって振り下ろす（杖は掲げて振る）
// 部位の座標は、1ドット単位に戻した各画像の上で測ったもの
(function () {
  const FW = 168, FH = 156, OX = 84, OY = 146;
  const box = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
  const seg = (x0, y0, x1, y1, r) => (x, y) => { const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy; let t = ((x - x0) * dx + (y - y0) * dy) / l2; t = Math.max(0, Math.min(1, t)); return Math.hypot(x - x0 - dx * t, y - y0 - dy * t) <= r; };
  const any = (...f) => (x, y) => f.some(g => g(x, y));
  const RIG = {
    thunder: {
      front: { fwd: -1, weapon: any(box(0, 69, 30, 95), box(28, 77, 46, 96)), shoulder: [52, 79], flow: (x, y) => x >= 86, neck: [80, 66], eyes: [[41, 44, 49, 57], [54, 42, 70, 58]], skin: [52, 51] },
      runL: { fwd: -1, weapon: any(box(0, 54, 24, 78), box(25, 62, 47, 81)), shoulder: [52, 66], near: (x, y) => y >= 84 && x <= 63, nearHip: [58, 84], far: any(box(70, 80, 88, 110), box(89, 88, 99, 110)), farHip: [76, 82], flow: (x, y) => x >= 84, neck: [70, 60] },
      runR: { fwd: 1, weapon: any(box(92, 79, 139, 93), box(112, 64, 139, 92)), shoulder: [86, 76], near: (x, y) => y >= 95 && x >= 76, nearHip: [82, 93], far: any(box(0, 97, 66, 120), box(50, 93, 66, 120)), farHip: [64, 92], flow: (x, y) => x <= 60, neck: [78, 66] },
      back: { back: true, weapon: box(87, 74, 135, 102), shoulder: [84, 80], legL: box(44, 107, 63, 128), legR: box(66, 108, 90, 128), flow: (x, y) => x <= 44, neck: [60, 66] },
    },
    ice: {
      front: { fwd: -1, staff: true, weapon: any(seg(8, 30, 42, 102, 4), box(0, 8, 25, 52), box(22, 62, 34, 75)), shoulder: [28, 68], flow: (x, y) => x >= 74 && y >= 38, neck: [60, 50], eyes: [[37, 38, 44, 51], [47, 35, 64, 50]], skin: [46, 46] },
      runL: { fwd: -1, staff: true, weapon: any(seg(4, 28, 42, 92, 4.5), box(0, 25, 20, 55), box(21, 58, 33, 68)), shoulder: [27, 63], near: (x, y) => y >= 80 && x <= 58, nearHip: [52, 80], far: box(74, 82, 93, 100), farHip: [74, 80], flow: (x, y) => x >= 94 || (y < 75 && x >= 66), neck: [68, 50] },
      runR: { fwd: 1, staff: true, scale: 1.3, weapon: any(seg(104, 18, 80, 68, 4), box(92, 12, 111, 32), box(86, 44, 96, 54)), shoulder: [91, 48], near: any(box(62, 58, 80, 84), box(70, 70, 86, 84)), nearHip: [66, 56], far: box(38, 62, 62, 76), farHip: [60, 58], flow: (x, y) => x <= 44, neck: [64, 30] },
      back: { back: true, staff: true, weapon: any(seg(112, 32, 100, 104, 3.5), box(95, 28, 116, 46), box(88, 64, 97, 76)), shoulder: [93, 70], legL: box(43, 100, 57, 121), legR: box(62, 100, 77, 121), flow: (x, y) => x <= 40, neck: [55, 60] },
    },
    samurai: {
      front: { fwd: -1, weapon: any(box(0, 70, 34, 97), box(33, 82, 52, 101)), shoulder: [55, 88], flow: (x, y) => x >= 96 && y <= 102, neck: [80, 55], eyes: [[48, 48, 55, 60], [63, 46, 77, 59]], skin: [58, 54] },
      runL: { fwd: -1, weapon: any(box(0, 61, 26, 80), box(26, 66, 40, 81)), shoulder: [45, 70], near: (x, y) => x <= 62 && y >= 80, nearHip: [58, 82], far: (x, y) => x >= 72 && y >= 92, farHip: [76, 88], flow: (x, y) => x >= 70 && y < 66, neck: [60, 45] },
      runR: { fwd: 1, weapon: any(box(113, 52, 136, 80), box(96, 63, 113, 80)), shoulder: [88, 62], near: (x, y) => x >= 78 && y >= 88, nearHip: [82, 86], far: any(box(52, 91, 76, 119), box(38, 94, 52, 119)), farHip: [70, 88], flow: (x, y) => (x <= 64 && y < 64) || x <= 30, neck: [84, 40] },
      back: { back: true, weapon: box(84, 64, 117, 92), shoulder: [76, 74], legL: box(37, 106, 53, 120), legR: box(63, 106, 82, 120), flow: (x, y) => x <= 36 && y <= 96, neck: [55, 55] },
    },
  };

  // ---------------------------------------------------------- 画像を部位の層に分ける
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
  function layer(px, w, h, test, sc) {
    const L = new Uint32Array(w * h); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1, n = 0;
    if (test) for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const i = y * w + x; if (!px[i] || !test(x / sc, y / sc)) continue;
      L[i] = px[i]; px[i] = 0; n++; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
    }
    return { px: L, n, bb: { x0, y0, x1, y1 }, x4: n ? epx2(epx2(L, w, h), w * 2, h * 2) : null };
  }
  function scaleUp(s, k) { // 小さく描かれた向きを拡大して他の向きと大きさを揃える
    const w = Math.round(s.w * k), h = Math.round(s.h * k), px = new Uint32Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px[y * w + x] = s.px[Math.floor(y / k) * s.w + Math.floor(x / k)];
    return { w, h, px };
  }
  // 「＞＜」の目：元の目（まつ毛・白目・光まで）を肌の色で消し、左の目に「＞」、右の目に「＜」を描く
  //   目の範囲の中で、目の中心から「肌ではない色」でつながっている所だけを消す（範囲に入った髪の毛は残す）
  function dizzyEyes(px, w, R) {
    const skin = px[R.skin[1] * w + R.skin[0]];
    const isSkin = v => { const r = v & 255, g = v >> 8 & 255, b = v >> 16 & 255; return r > 200 && g > 140 && b < g - 12; };
    R.eyes.forEach(([x0, y0, x1, y1], k) => {
      let lash = 0, dark = 1e9;
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) { const v = px[y * w + x]; if (!v) continue; const b = (v & 255) + (v >> 8 & 255) + (v >> 16 & 255); if (b < dark) { dark = b; lash = v; } }
      const mx = (x1 - x0) * .3, my = (y1 - y0) * .3, seen = new Set(), st = [];
      for (let y = Math.round(y0 + my); y <= y1 - my; y++) for (let x = Math.round(x0 + mx); x <= x1 - mx; x++) { const v = px[y * w + x]; if (v && !isSkin(v)) { seen.add(y * w + x); st.push([x, y]); } }
      while (st.length) {
        const [x, y] = st.pop();
        for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]]) {
          if (nx < x0 || nx > x1 || ny < y0 || ny > y1) continue; const i = ny * w + nx;
          if (seen.has(i) || !px[i] || isSkin(px[i])) continue; seen.add(i); st.push([nx, ny]);
        }
      }
      for (const i of seen) px[i] = skin;
      const hh = Math.max(2, Math.min(5, Math.floor((y1 - y0) / 2) - 1)), ww = Math.min(x1 - x0, hh + 1), cy = Math.round((y0 + y1) / 2) + 1;
      const left = Math.round((x0 + x1) / 2 - ww / 2), tip = k === 0 ? left + ww : left, base = k === 0 ? left : left + ww, d = tip > base ? -1 : 1;
      for (let i = 0; i <= hh; i++) {
        const x = Math.round(base + (tip - base) * i / hh);
        for (const yy of [cy - hh + i, cy + hh - i]) { px[yy * w + x] = lash; px[yy * w + x + d] = lash; }
      }
    });
  }
  const BUILT = {};
  function build(c, v, src, dizzy) {
    const R = RIG[c] && RIG[c][v]; if (!R || !src) return null;
    const sc = R.scale || 1, s = sc !== 1 ? scaleUp(src, sc) : src, w = s.w, h = s.h, px = s.px.slice();
    if (dizzy && R.eyes) dizzyEyes(px, w, R);
    const P = (p) => p && [p[0] * sc, p[1] * sc];
    const o = { R, w, h, sc };
    o.weapon = layer(px, w, h, R.weapon, sc);
    if (R.back) { o.legL = layer(px, w, h, R.legL, sc); o.legR = layer(px, w, h, R.legR, sc); }
    else if (R.near) { o.near = layer(px, w, h, R.near, sc); o.far = layer(px, w, h, R.far, sc); }
    o.flow = layer(px, w, h, R.flow, sc);
    // 正面の立ち絵は首から上（頭）を別の層にして、体と少しずらして動かせるようにする
    if (!R.back && !R.near && R.neck) o.head = layer(px, w, h, (x, y) => y <= R.neck[1], sc);
    o.body = { px, n: 1, bb: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } };
    o.shoulder = P(R.shoulder); o.nearHip = P(R.nearHip); o.farHip = P(R.farHip); o.neck = P(R.neck);
    o.ground = 0; let sx = 0, n = 0;
    for (let i = 0; i < w * h; i++) if (s.px[i]) o.ground = Math.max(o.ground, (i / w) | 0);
    for (let y = Math.floor(o.ground - h * .15); y <= o.ground; y++) for (let x = 0; x < w; x++) if (s.px[y * w + x]) { sx += x; n++; }
    o.ax = n ? sx / n : w / 2;
    // 腰の付け根を埋める色：腰のすぐ上にある体の色でいちばん多いもの（脚を回した時の隙間をふさぐ）
    if (o.nearHip) {
      const cnt = new Map();
      for (const hp of [o.nearHip, o.farHip]) for (let y = Math.round(hp[1] - 7); y <= hp[1]; y++) for (let x = Math.round(hp[0] - 5); x <= hp[0] + 5; x++) { const v = px[y * w + x]; if (!v) continue; const c = [v & 255, v >> 8 & 255, v >> 16 & 255]; if (c[0] + c[1] + c[2] < 90) continue; cnt.set(v, (cnt.get(v) || 0) + 1); }
      let best = 0; o.hipCol = 0; for (const [v, k] of cnt) if (k > best) { best = k; o.hipCol = v; }
    }
    // 脚を入れ替える角度：手前の脚と奥の脚の向き（腰→足先）の差
    if (o.near && o.near.n && o.far.n) {
      const dirOf = (L, hip) => { let mx = 0, my = 0, k = 0; for (let y = L.bb.y1 - 6; y <= L.bb.y1; y++) for (let x = L.bb.x0; x <= L.bb.x1; x++) if (L.px[y * w + x]) { mx += x; my += y; k++; } return Math.atan2(mx / k - hip[0], my / k - hip[1]); };
      o.swap = dirOf(o.far, o.farHip) - dirOf(o.near, o.nearHip); // 正＝奥の脚の方が後ろ側（画面上の時計回りの差）
    }
    return o;
  }

  // ---------------------------------------------------------- 1コマの合成
  function compose(S, P, raw) {
    const out = new Uint32Array(FW * FH), w = S.w, h = S.h, R = S.R;
    const rotInfo = (L, hip, ang) => { if (!L.n) return -1e9; const ca = Math.cos(ang), sa = Math.sin(ang), b = L.bb; let low = -1e9; for (const [x, y] of [[b.x0, b.y1 + 1], [b.x1 + 1, b.y1 + 1], [(b.x0 + b.x1) / 2, b.y1 + 1]]) low = Math.max(low, hip[1] + sa * (x - hip[0]) + ca * (y - hip[1])); return low; };
    let lock = 0;
    if (S.near && S.near.n) { const low = Math.max(rotInfo(S.near, S.nearHip, P.an || 0), rotInfo(S.far, S.farHip, P.af || 0)); lock = Math.round(S.ground - low - (P.air || 0)); }
    const ox = Math.round(OX - S.ax + (P.dx || 0)), oy = Math.round(OY - S.ground + lock + (P.by || 0));
    const lean = P.lean || 0, topH = Math.max(1, S.ground);
    const shx = y => Math.round(lean * Math.min(1, Math.max(0, (S.ground - y) / topH))); // 頭の先ほど横にずらす（前傾・のけぞり）
    const put = (X, Y, v) => { if (X >= 0 && Y >= 0 && X < FW && Y < FH) out[Y * FW + X] = v; };
    const blit = (L, dx, dy, hair) => { if (!L.n) return; const b = L.bb; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const v = L.px[y * w + x]; if (v) put(x + ox + dx + shx(y) + (hair ? hair(y) : 0), y + oy + dy, v); } };
    const rot = (L, piv, ang, dx, dy) => {
      if (!L.n) return; const b = L.bb, ca = Math.cos(ang), sa = Math.sin(ang), W4 = w * 4, H4 = h * 4;
      const hx = piv[0] + ox + (dx || 0) + shx(piv[1]), hy = piv[1] + oy + (dy || 0), r = Math.hypot(Math.max(piv[0] - b.x0, b.x1 + 1 - piv[0]), Math.max(piv[1] - b.y0, b.y1 + 1 - piv[1])) + 2;
      for (let Y = Math.floor(hy - r); Y <= hy + r; Y++) for (let X = Math.floor(hx - r); X <= hx + r; X++) {
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        const ddx = X + .5 - hx, ddy = Y + .5 - hy, ix = Math.floor((ca * ddx + sa * ddy + piv[0]) * 4), iy = Math.floor((-sa * ddx + ca * ddy + piv[1]) * 4);
        if (ix < 0 || iy < 0 || ix >= W4 || iy >= H4) continue;
        const v = L.x4[iy * W4 + ix]; if (v) out[Y * FW + X] = v;
      }
    };
    const hair = y => y < S.ground * .28 ? Math.round((P.hs || 0) * (1 - y / (S.ground * .28))) : 0;
    // 髪や布：首元から離れるほど大きく波打ち、後ろへ流れる（逆写像）
    const flow = () => {
      const L = S.flow; if (!L.n) return;
      const b = L.bb, back = R.back ? -1 : -(R.fwd || -1), [nx, ny] = S.neck, reach = 55 * S.sc;
      for (let Y = b.y0 + oy - 8; Y <= b.y1 + oy + 8; Y++) for (let X = b.x0 + ox - 10; X <= b.x1 + ox + 10; X++) {
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        let y0 = Y - oy, hx = 0;
        if (S.head && y0 - (P.hy || 0) <= S.neck[1]) { y0 -= P.hy || 0; hx = P.hx || 0; } // 首から上の髪は頭と一緒に動く
        const x0 = X - ox - hx - shx(y0) - hair(y0); // 頭の揺れ（hair）も体と同じだけずらして、つなぎ目に隙間ができないように
        const t = G.clamp(((x0 - nx) * back) / reach, 0, 1), tt = t * t;
        const sx = Math.round(x0 - back * (((P.fs || 0) * 2.5 + Math.sin((P.fph || 0) - (x0 - nx) * back * .1) * (P.famp || 0) * .5) * t));
        const sy = Math.round(y0 - Math.sin((P.fph || 0) + x0 * .15 * back) * (P.famp || 0) * 1.8 * tt + (P.flift || 0) * tt * 2.5);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const v = L.px[sy * w + sx]; if (v) out[Y * FW + X] = v;
      }
    };
    const wa = (P.wr || 0) * Math.PI / 180;
    if (R.back) {
      blit(S.legL, 0, -(P.lL || 0)); blit(S.legR, 0, -(P.lR || 0));
      blit(S.body, 0, 0, hair); flow(); rot(S.weapon, S.shoulder, wa, 0, P.wy || 0);
    } else if (S.near && S.near.n) {
      flow(); rot(S.far, S.farHip, P.af || 0, 0, 0);
      if (S.hipCol) for (const hp of [S.farHip, S.nearHip]) { const cx = hp[0] + ox + shx(hp[1]), cy = hp[1] + oy - 1; for (let Y = Math.floor(cy - 5); Y <= cy + 5; Y++) for (let X = Math.floor(cx - 5); X <= cx + 5; X++) { const d = Math.hypot(X + .5 - cx, Y + .5 - cy); if (d <= 4.6) put(X, Y, d > 3.7 ? 0xff120a10 : S.hipCol); } }
      blit(S.body, 0, 0, hair); rot(S.near, S.nearHip, P.an || 0, 0, 0); rot(S.weapon, S.shoulder, wa, 0, P.wy || 0);
    } else {
      // 正面の立ち絵：振りかぶった武器は体の後ろ、振り下ろしは手前
      flow(); if (P.wBack) rot(S.weapon, S.shoulder, wa, P.wx || 0, P.wy || 0);
      blit(S.body, 0, 0, hair); if (S.head) blit(S.head, P.hx || 0, P.hy || 0, hair);
      if (!P.wBack) rot(S.weapon, S.shoulder, wa, P.wx || 0, P.wy || 0);
    }
    for (let Y = 1; Y < FH - 1; Y++) for (let X = 1; X < FW - 1; X++) { const i = Y * FW + X; if (out[i] && !out[i - 1] && !out[i + 1] && !out[i - FW] && !out[i + FW]) out[i] = 0; }
    if (raw) return out;
    // すき間うめ：頭や武器をずらした所にできた細いすき間を、となりの色でふさぐ（動かさない絵で埋まっている所だけ）
    if (P.fill) {
      const ref = compose(S, { by: P.by, famp: P.famp, fph: P.fph }, true), at = (X, Y) => (X < 0 || Y < 0 || X >= FW || Y >= FH) ? 0 : out[Y * FW + X];
      const near = (X, Y, dx, dy) => at(X + dx, Y + dy) || at(X + dx * 2, Y + dy * 2);
      for (let Y = 1; Y < FH - 1; Y++) for (let X = 1; X < FW - 1; X++) {
        const i = Y * FW + X; if (out[i] || !ref[i]) continue;
        const u = near(X, Y, 0, -1), d = near(X, Y, 0, 1), l = near(X, Y, -1, 0), r = near(X, Y, 1, 0);
        if (u && d) out[i] = u; else if (l && r) out[i] = l;
      }
    }
    const c = G.canvas(FW, FH), x = c.getContext('2d'), img = x.createImageData(FW, FH);
    new Uint32Array(img.data.buffer).set(out); x.putImageData(img, 0, 0);
    return c;
  }

  // ---------------------------------------------------------- ポーズ
  const TAU = Math.PI * 2;
  function poses(S, view, set) {
    const R = S.R, f = R.fwd || -1;
    if (set === 'run') return Array.from({ length: 12 }, (_, i) => {
      const t = i / 12, ph = (1 - Math.cos(t * TAU)) / 2, c2 = Math.cos(t * 2 * TAU), A = S.swap || 1.6;
      // 手前の脚は奥の脚の向きへ、奥の脚は手前の脚の向きへ（半周期で入れ替わり、また戻る）
      return { an: -A * ph, af: A * ph, air: Math.max(0, c2) * 2.6, wr: -f * 6 * Math.cos(t * TAU), wy: Math.round(Math.sin(t * 2 * TAU) * .6), lean: f * 2, famp: 1.6, fph: t * 2 * TAU, fs: .3 + .3 * c2, flift: .3 + .3 * c2, hs: Math.round(-f * (1 + c2)) };
    });
    if (set === 'back') return Array.from({ length: 10 }, (_, i) => {
      const t = i / 10, s = Math.sin(t * TAU);
      return { lL: Math.round(Math.max(0, s) * 4.5), lR: Math.round(Math.max(0, -s) * 4.5), by: -Math.round(Math.abs(s) * 1.6), dx: Math.round(s), wr: 5 * Math.sin(t * TAU + 1), famp: 2.2, fph: t * 2 * TAU, fs: .4, hs: Math.round(s * 1.5) };
    });
    // 待機：体が呼吸で上下し、頭は少し遅れてついていく。武器はゆらゆら揺れ、髪がなびく（ずらしてできたすき間は fill でふさぐ）
    if (set === 'idle') return Array.from({ length: 8 }, (_, i) => { const q = i / 8 * TAU; return { by: [0, 0, 0, 1, 1, 1, 1, 0][i], hy: [0, 0, 0, -1, 0, 0, 0, 1][i], wy: [0, 0, 0, 1, 1, 1, 1, 0][i], wr: Math.sin(q) * 2, famp: .9, fph: q, fill: true }; });
    // 攻撃：剣・刀は振りかぶって（体の後ろ）振り下ろす。杖は掲げてから前へ振る
    // 角度は画面上の時計回りが正（左向きの絵では、正＝武器の先が上がる・振りかぶる）。lean は正＝のけぞる・負＝前へ倒れる
    if (set === 'atk' && R.staff) return [[10, 2, -1, .5], [24, 3, -2, 1], [30, 4, -3, 1.4], [-6, -3, -1, 2], [-16, -5, 0, 2.2], [-6, -2, 0, 1]].map(([wr, lean, wy, famp], i) => ({ wr, lean, wy, famp, fph: i, wBack: false, dx: i >= 3 ? f * 2 : 0 }));
    if (set === 'atk') return [[35, 3, false], [55, 5, false], [20, -3, false], [-30, -6, false], [-55, -7, false], [-30, -3, false]].map(([wr, lean, back], i) => ({ wr, lean, wBack: back, famp: 1.2 + i * .2, fph: i, dx: i >= 2 ? f * Math.min(4, i) : 0, wy: back ? -2 : 1 }));
    if (set === 'raise') return [0, 1, 2].map(i => ({ wr: 50 + i * 12, lean: 2 + i, wBack: true, by: -1 - i, famp: 1.4, fph: i, wy: -2 - i }));
    return null;
  }
  const CACHE = {};
  G.charRigFrame = function (c, view, set, i) {
    const key = c + view + set + i; if (CACHE[key] !== undefined) return CACHE[key];
    const src = G.charSrc && G.charSrc(c, view); if (!src) return null;
    const dz = set === 'idleX'; if (dz) set = 'idle'; // idleX＝「＞＜」の目の待機
    const bk = c + view + (dz ? 'X' : '');
    const S = BUILT[bk] || (BUILT[bk] = build(c, view, src, dz)); if (!S) return CACHE[key] = null;
    const P = poses(S, view, set); if (!P) return CACHE[key] = null;
    const p = P[Math.max(0, Math.min(P.length - 1, i))];
    return CACHE[key] = { n: compose(S, p), fix: view === 'runR' || view === 'back', ox: OX, oy: OY };
  };
  G.charRigCount = set => ({ run: 12, back: 10, idle: 8, idleX: 8, atk: 6, raise: 3 })[set] || 0;
  // 選択中のキャラのコマを空き時間に少しずつ先に作る（初めて使うコマで一瞬止まらないように）
  const JOBS = [['front', 'idle'], ['runL', 'run'], ['runR', 'run'], ['front', 'atk'], ['back', 'back'], ['front', 'raise'], ['front', 'idleX']];
  setInterval(() => {
    const c = G.S && G.S.cur; if (!c || c === 'hero' || !G.charSrc || !G.charSrc(c, 'front')) return;
    const t0 = performance.now();
    for (const [v, set] of JOBS) for (let i = 0; i < G.charRigCount(set); i++) {
      if (CACHE[c + v + set + i] !== undefined) continue;
      G.charRigFrame(c, v, set, i);
      if (performance.now() - t0 > 6) return;
    }
  }, 60);
  G.charRigDebug = (c, v) => BUILT[c + v] || (G.charSrc && (BUILT[c + v] = build(c, v, G.charSrc(c, v))));
})();
