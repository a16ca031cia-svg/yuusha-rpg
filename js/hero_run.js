'use strict';
// ===== 主人公の走り（左右）と後ろ姿：提供されたドット絵を部位に分け、差分を作って動かす =====
// 各画像を「マント／奥の脚／後ろのこぶし／体／手前の脚／剣を持つ腕」に分ける。
// 走り：両脚を腰を軸に回して前後を入れ替え（前へ伸ばした脚→真下→後ろへ蹴った脚）、
//       接地している足を地面に合わせて体を上下させ、脚が開いた瞬間は宙に浮く。腕は脚と逆に振り、マントと髪は後ろへなびく。
// 後ろ姿：左右の足を交互に持ち上げ、体を弾ませ、マントを大きく波打たせる。
(function () {
  const HF = G.HERO_FRAME, FW = HF.FW, FH = HF.FH, GROUND = HF.OY; // 足元の高さ（コマ内のドット）
  const rgb = v => [v & 255, v >> 8 & 255, v >> 16 & 255];
  const isRed = c => c[0] > 125 && c[0] > c[1] * 2.3 && c[0] > c[2] * 1.9; // マントの鮮やかな赤（赤茶のブーツや肌は含めない）
  const isDark = c => c[0] + c[1] + c[2] < 150;
  const capeish = c => c[0] > 60 && c[0] > c[1] * 2; // マントの影の暗い赤も含めた「赤っぽい」色

  // 画像ごとの部位の決め方（座標は1ドット単位に戻した絵の上で測ったもの）
  const RIGS = {
    L: { fwd: -1, ax: 60, neck: [58, 64], capeOut: x => x > 84,
      sword: (x, y, c) => x <= 41 && (x <= 26 || y >= 68) && y >= 63 && y <= 93 && !isRed(c), shoulder: [47, 76],
      fist: (x, y, c) => x >= 78 && x <= 93 && y >= 70 && y <= 87 && !capeish(c) && !isDark(c),
      near: (x, y) => y >= 97 && x <= 62, nearHip: [54, 96],
      far: (x, y, c) => y >= 92 && x >= 63 && x <= 96 && !isRed(c), farHip: [66, 95] },
    R: { fwd: 1, ax: 72, neck: [78, 64], capeOut: x => x < 50,
      sword: (x, y, c) => x >= 92 && (x >= 113 || y >= 68) && y >= 63 && y <= 96 && !isRed(c), shoulder: [86, 76],
      fist: (x, y, c) => x >= 42 && x <= 58 && y >= 68 && y <= 85 && !capeish(c) && !isDark(c),
      near: (x, y) => y >= 98 && x >= 76, nearHip: [80, 96],
      far: (x, y, c) => ((x <= 56 && y >= 86) || (x <= 66 && y >= 96)) && y <= 108 && !isRed(c), farHip: [64, 95] },
    B: { back: true, ax: 60, neck: [62, 60], capeOut: x => x < 42,
      sword: (x, y, c) => x >= 76 && y >= 72 && y <= 100 && !isRed(c), shoulder: [74, 78],
      legL: (x, y) => y >= 103 && x >= 41 && x <= 59, legR: (x, y) => y >= 104 && x >= 61 && x <= 84 },
  };
  const SRC = {}; // 各画像の部位の層
  G.heroRunReady = () => !!(SRC.L && SRC.R && SRC.B);

  // 2倍に拡大（EPX）。回転しても線がガタガタになりにくいよう、4倍の絵から拾う
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
  function layer(px, w, h, test) {
    const L = new Uint32Array(w * h); let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = y * w + x, v = px[i]; if (!v || !test(x, y, rgb(v))) continue; L[i] = v; px[i] = 0; x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
    return { px: L, bb: { x0, y0, x1, y1 }, x4: epx2(epx2(L, w, h), w * 2, h * 2) };
  }
  // 層のまわりの暗い輪郭のドットも層に加える（動かした時に輪郭が付いてくるように）
  function grow(L, px, w, h) {
    const add = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, v = px[i]; if (!v || !isDark(rgb(v))) continue; if (L.px[i - 1] || L.px[i + 1] || L.px[i - w] || L.px[i + w]) add.push(i); }
    for (const i of add) { L.px[i] = px[i]; px[i] = 0; const x = i % w, y = (i / w) | 0; L.bb.x0 = Math.min(L.bb.x0, x); L.bb.x1 = Math.max(L.bb.x1, x); L.bb.y0 = Math.min(L.bb.y0, y); L.bb.y1 = Math.max(L.bb.y1, y); }
    L.x4 = epx2(epx2(L.px, w, h), w * 2, h * 2);
    return L;
  }
  function build(key, s) {
    const R = RIGS[key], w = s.w, h = s.h, px = s.px.slice(), o = { w, h, R };
    const red = (x, y) => { const v = s.px[y * w + x]; return v && isRed(rgb(v)); };
    // 剣・腕・脚を先に切り出し、残りからマント（赤い布と、体から離れた所の赤に接する輪郭）を取る
    o.sword = layer(px, w, h, R.sword);
    if (R.back) { o.legL = layer(px, w, h, R.legL); o.legR = layer(px, w, h, R.legR); }
    else { o.fist = grow(layer(px, w, h, R.fist), px, w, h); o.near = layer(px, w, h, R.near); o.far = layer(px, w, h, R.far); }
    o.cape = layer(px, w, h, (x, y, c) => y >= R.neck[1] - 8 && (isRed(c) || (isDark(c) && R.capeOut(x) && [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => x + dx >= 0 && y + dy >= 0 && x + dx < w && y + dy < h && red(x + dx, y + dy)))));
    o.body = { px, bb: { x0: 0, y0: 0, x1: w - 1, y1: h - 1 } };
    // 腰の付け根を埋める色（半ズボンの灰色）：脚を回した時に付け根に隙間が出ないように
    if (!R.back) {
      const cnt = new Map();
      for (const [hx, hy] of [R.nearHip, R.farHip]) for (let y = hy - 8; y <= hy + 2; y++) for (let x = hx - 6; x <= hx + 6; x++) { const v = s.px[y * w + x]; if (!v) continue; const c = rgb(v), sat = Math.max(...c) - Math.min(...c), br = c[0] + c[1] + c[2]; if (sat < 40 && br > 150 && br < 450) cnt.set(v, (cnt.get(v) || 0) + 1); }
      let best = 0; o.hipCol = 0xff5a5048; for (const [v, n] of cnt) if (n > best) { best = n; o.hipCol = v; }
    }
    o.ground = 0; for (let i = 0; i < w * h; i++) if (s.px[i]) o.ground = Math.max(o.ground, (i / w) | 0);
    SRC[key] = o;
  }

  // ---------------------------------------------------------- 1コマの合成
  function compose(key, P) {
    const S = SRC[key], R = S.R, w = S.w, h = S.h, out = new Uint32Array(FW * FH);
    const ox = HF.OX - R.ax; // 絵の x → コマの x
    let lock = 0;
    const rotInfo = (L, hip, ang) => { // 回転した脚の一番下の点（接地の判定用）
      const ca = Math.cos(ang), sa = Math.sin(ang); let low = -1e9;
      const b = L.bb; for (const [x, y] of [[b.x0, b.y1 + 1], [b.x1 + 1, b.y1 + 1], [b.x0, b.y0], [b.x1 + 1, b.y0], [(b.x0 + b.x1) / 2, b.y1 + 1]]) low = Math.max(low, hip[1] + sa * (x - hip[0]) + ca * (y - hip[1]));
      return low;
    };
    if (!R.back) {
      const low = Math.max(rotInfo(S.near, R.nearHip, P.an), rotInfo(S.far, R.farHip, P.af));
      lock = Math.round(S.ground - low - (P.air || 0)); // 低い方の足の裏を地面に合わせ、宙に浮くコマは持ち上げる
    }
    const oy = GROUND - S.ground + lock + (P.by || 0);
    const put = (X, Y, v) => { if (X >= 0 && Y >= 0 && X < FW && Y < FH) out[Y * FW + X] = v; };
    const blit = (L, dx, dy, fx) => { const b = L.bb; for (let y = b.y0; y <= b.y1; y++) for (let x = b.x0; x <= b.x1; x++) { const v = L.px[y * w + x]; if (v) put(x + ox + dx + (fx ? fx(x, y) : 0), y + oy + dy, v); } };
    // 回転：4倍の絵から逆に拾う（hip を中心に ang 回し、hip の位置を dx,dy ずらす）
    const rot = (L, hip, ang, dx, dy) => {
      const b = L.bb, ca = Math.cos(ang), sa = Math.sin(ang), W4 = w * 4, H4 = h * 4;
      const hx = hip[0] + ox + (dx || 0), hy = hip[1] + oy + (dy || 0), r = Math.hypot(Math.max(hip[0] - b.x0, b.x1 + 1 - hip[0]), Math.max(hip[1] - b.y0, b.y1 + 1 - hip[1])) + 2;
      for (let Y = Math.floor(hy - r); Y <= hy + r; Y++) for (let X = Math.floor(hx - r); X <= hx + r; X++) {
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        const ddx = X + .5 - hx, ddy = Y + .5 - hy, ix = Math.floor((ca * ddx + sa * ddy + hip[0]) * 4), iy = Math.floor((-sa * ddx + ca * ddy + hip[1]) * 4);
        if (ix < 0 || iy < 0 || ix >= W4 || iy >= H4) continue;
        const v = L.x4[iy * W4 + ix]; if (v) out[Y * FW + X] = v;
      }
    };
    // マント：首元から離れるほど大きく波打ち、後ろへ流れる（逆写像）
    const cape = () => {
      const L = S.cape, b = L.bb, back = R.back ? -1 : -R.fwd, [nx, ny] = R.neck, reach = R.back ? 50 : 60;
      for (let Y = b.y0 + oy - 8; Y <= b.y1 + oy + 8; Y++) for (let X = (back < 0 ? b.x0 : b.x0) + ox - 10; X <= b.x1 + ox + 10; X++) {
        if (X < 0 || Y < 0 || X >= FW || Y >= FH) continue;
        const x0 = X - ox, y0 = Y - oy - (P.cy || 0);
        const t = G.clamp(((x0 - nx) * back) / reach, 0, 1), tt = R.back ? Math.pow(t, 1.6) : t;
        const sx = Math.round(x0 - back * ((P.cs || 0) * 3 + Math.sin(P.cph - (x0 - nx) * back * .1) * P.camp * .6) * tt);
        const sy = Math.round(y0 - Math.sin(P.cph + x0 * .15 * back) * P.camp * 2 * tt * tt + (P.clift || 0) * tt * tt * 3);
        if (sx < 0 || sy < 0 || sx >= w || sy >= h) continue;
        const v = L.px[sy * w + sx]; if (v) out[Y * FW + X] = v;
      }
    };
    const hair = (x, y) => y < 26 ? Math.round((P.hs || 0) * (26 - y) / 26) : 0; // 髪先のなびき
    if (R.back) {
      // 後ろ姿：足は体の後ろ（半ズボンが上を隠す）で交互に持ち上げる
      blit(S.legL, P.sx || 0, -(P.lL || 0)); blit(S.legR, P.sx || 0, -(P.lR || 0));
      blit(S.body, P.sx || 0, 0, hair);
      rot(S.sword, R.shoulder, (P.sr || 0) * Math.PI / 180, P.sx || 0, 0);
      cape();
    } else {
      cape();
      rot(S.far, R.farHip, P.af, 0, 0);
      for (const [hx, hy] of [R.farHip, R.nearHip]) { // 腰の付け根
        const cx = hx + ox, cy = hy + oy - 1;
        for (let Y = Math.floor(cy - 6); Y <= cy + 6; Y++) for (let X = Math.floor(cx - 6); X <= cx + 6; X++) { const d = Math.hypot(X + .5 - cx, Y + .5 - cy); if (d <= 5.2) put(X, Y, d > 4.2 ? 0xff0f0723 : S.hipCol); }
      }
      blit(S.fist, Math.round(P.fx || 0), Math.round(P.fy || 0));
      blit(S.body, 0, 0, hair);
      rot(S.near, R.nearHip, P.an, 0, 0);
      rot(S.sword, R.shoulder, (P.sr || 0) * Math.PI / 180, 0, Math.round(P.sy || 0));
    }
    for (let Y = 1; Y < FH - 1; Y++) for (let X = 1; X < FW - 1; X++) { const i = Y * FW + X; if (out[i] && !out[i - 1] && !out[i + 1] && !out[i - FW] && !out[i + FW]) out[i] = 0; }
    const c = G.canvas(FW, FH), x = c.getContext('2d'), img = x.createImageData(FW, FH);
    new Uint32Array(img.data.buffer).set(out); x.putImageData(img, 0, 0);
    return c;
  }

  // ---------------------------------------------------------- ポーズ（周期 t：0→1で2歩）
  const TAU = Math.PI * 2, A = 115 * Math.PI / 180; // 手前の脚（前へ約40°）と奥の脚（後ろへ約75°）がちょうど入れ替わる角度
  function sidePoses(key) {
    const f = RIGS[key].fwd, n = 12;
    return Array.from({ length: n }, (_, i) => {
      const t = i / n, ph = (1 - Math.cos(t * TAU)) / 2, c2 = Math.cos(t * 2 * TAU);
      return {
        an: f * A * ph, af: -f * A * ph,                   // 手前の脚：前→後ろ、奥の脚：後ろ→前（半周期で入れ替わり、また戻る）
        air: Math.max(0, c2) * 2.6,                        // 脚が大きく開いた瞬間は宙に浮く
        sr: -f * 7 * Math.cos(t * TAU), sy: Math.round(Math.sin(t * 2 * TAU) * .6), // 剣を持つ腕は脚と逆に振る
        fx: -f * 3 * Math.cos(t * TAU), fy: Math.round(-Math.abs(Math.sin(t * TAU)) * 1.2),
        camp: 1.5, cph: t * 2 * TAU, cs: .25 + .25 * c2, clift: .3 + .3 * c2, hs: Math.round(-f * (1 + c2)),
      };
    });
  }
  function backPoses() {
    const n = 10;
    return Array.from({ length: n }, (_, i) => {
      const t = i / n, s = Math.sin(t * TAU);
      return {
        lL: Math.round(Math.max(0, s) * 4.5), lR: Math.round(Math.max(0, -s) * 4.5),
        by: -Math.round(Math.abs(s) * 1.6), sx: Math.round(s * 1), sr: 5 * Math.sin(t * TAU + 1),
        camp: 2.4, cph: t * 2 * TAU, cs: .5, clift: .3 * Math.cos(t * 2 * TAU), hs: Math.round(s * 1.5),
      };
    });
  }

  // ---------------------------------------------------------- 読み込み・コマの準備（空き時間に少しずつ）
  const FR = {}, queue = [];
  function lazyFrames(key, poses) {
    return poses.map(p => {
      const fr = { fix: key !== 'L' }; // 右向き・後ろ姿は反転せずそのまま描く
      Object.defineProperty(fr, 'n', { configurable: true, get() { const c = compose(key, p); Object.defineProperty(fr, 'n', { value: c }); return c; } });
      queue.push(fr); return fr;
    });
  }
  function start() {
    if (!G.HERO_RUN_SRC || !G.pixelize) return;
    const keys = ['L', 'R', 'B'];
    const next = () => {
      const k = keys.shift(); if (!k) return;
      const img = new Image();
      img.onload = () => {
        build(k, G.pixelize(img, 48));
        FR[k] = lazyFrames(k, k === 'B' ? backPoses() : sidePoses(k));
        setTimeout(next, 30); // 1枚ずつ間を空けて処理（起動時に固まらないように）
      };
      img.src = G.HERO_RUN_SRC[k];
    };
    next();
  }
  setInterval(() => { const t0 = performance.now(); while (queue.length && performance.now() - t0 < 6) { const fr = queue.shift(); void fr.n; } }, 40);
  // 走りのコマ：dir 'L'/'R'/'B'、cyc は周期（0→1で2歩）。まだ準備できていなければ null
  G.heroRunFrame = (dir, cyc) => { const F = FR[dir]; if (!F) return null; return F[((Math.floor(cyc * F.length) % F.length) + F.length) % F.length]; };
  G.heroRunFrames = () => FR;
  G.heroRunSrc = k => SRC[k]; // 確認用
  start();
})();
