'use strict';
// ===== 追加キャラクター（ガチャのUR3人）のドット絵アニメーション =====
// 提供された「正面立ち絵・左向き走り・右向き走り・背面」の4枚から、足元を軸にした変形でコマを作る。
//   待機：呼吸で上下し髪先が揺れる / 攻撃：振りかぶり（後ろへ反る）→踏み込み（前へ傾く）
//   走り：弾むように跳ね、着地でつぶれ、前へ傾いて髪がなびく / 背面：左右に揺れながら弾む
(function () {
  const FW = 168, FH = 156, OX = 84, OY = 146; // コマの大きさと足元の位置
  const SRC = {}, CACHE = {};
  const SCALE = { ice: { runR: 1.3 } }; // 元の絵で小さく描かれている向きは拡大して揃える

  function load() {
    if (!G.CHAR_SRC) return;
    for (const c in G.CHAR_SRC) for (const v in G.CHAR_SRC[c]) {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth, h = img.naturalHeight, cv = G.canvas(w, h), x = cv.getContext('2d');
        x.drawImage(img, 0, 0);
        const px = new Uint32Array(x.getImageData(0, 0, w, h).data.buffer.slice(0));
        for (let i = 0; i < px.length; i++) if ((px[i] >>> 24) < 128) px[i] = 0; else px[i] |= 0xff000000;
        // 足元：一番下の行、足の中心：下から15%の範囲の不透明な点の平均
        let y1 = 0; for (let i = 0; i < px.length; i++) if (px[i]) y1 = Math.max(y1, (i / w) | 0);
        let sx = 0, n = 0; for (let y = Math.floor(y1 - h * .15); y <= y1; y++) for (let xx = 0; xx < w; xx++) if (px[y * w + xx]) { sx += xx; n++; }
        (SRC[c] || (SRC[c] = {}))[v] = { w, h, px, fy: y1, fx: n ? sx / n : w / 2, s: (SCALE[c] && SCALE[c][v]) || 1 };
      };
      img.src = G.CHAR_SRC[c][v];
    }
  }
  // 1コマ：dx,dy＝ずらし、lean＝頭の先の横ずれ（足元は固定）、sq＝縦のつぶれ（＋で伸び）、sway＝髪先の揺れ
  function compose(s, P) {
    const out = new Uint32Array(FW * FH), sc = s.s, sy = sc * (1 + (P.sq || 0)), sx = sc * (1 - (P.sq || 0) * .5);
    const ax = OX + (P.dx || 0), ay = OY + (P.dy || 0), topH = s.fy * sc;
    for (let Y = 0; Y < FH; Y++) {
      const yy = Y - ay; // 足元からの高さ（上がマイナス）
      const srcY = Math.floor(s.fy + yy / sy); if (srcY < 0 || srcY >= s.h) continue;
      const k = Math.min(1, -yy / Math.max(1, topH)), hair = srcY < s.fy * .3 ? (P.sway || 0) * (1 - srcY / (s.fy * .3)) : 0;
      const shift = (P.lean || 0) * k + hair;
      for (let X = 0; X < FW; X++) {
        const srcX = Math.floor(s.fx + (X - ax - shift) / sx); if (srcX < 0 || srcX >= s.w) continue;
        const v = s.px[srcY * s.w + srcX]; if (v) out[Y * FW + X] = v;
      }
    }
    const c = G.canvas(FW, FH), x = c.getContext('2d'), img = x.createImageData(FW, FH);
    new Uint32Array(img.data.buffer).set(out); x.putImageData(img, 0, 0);
    return c;
  }
  const TAU = Math.PI * 2;
  // コマの並び（前＝絵の左向き：lean がマイナスで前へ傾く）
  const POSE = {
    idle: Array.from({ length: 8 }, (_, i) => ({ dy: [0, 0, 0, 1, 1, 1, 1, 0][i], sway: Math.round(Math.sin(i / 8 * TAU) * 1.5), sq: [0, 0, 0, -.012, -.012, -.012, -.012, 0][i] })),
    atk: [{ lean: 5, dx: 2, sq: .02 }, { lean: 7, dx: 3, sq: .03 }, { lean: -6, dx: -5, sq: -.04, sway: 2 }, { lean: -8, dx: -6, sq: -.05, sway: 3 }, { lean: -4, dx: -3, sq: -.02, sway: 2 }, { lean: -1, dx: -1 }],
    cast: [{ dy: -1, lean: 3, sq: .03 }, { dy: -3, lean: 4, sq: .05 }, { dy: -2, lean: -4, dx: -2, sq: -.02, sway: 2 }, { dy: -1, lean: -6, dx: -3, sq: -.03, sway: 3 }, { lean: -3, dx: -2, sway: 2 }, { lean: -1 }],
    raise: [{ dy: -2, lean: 3, sq: .04 }, { dy: -4, lean: 4, sq: .06 }, { dy: -5, lean: 5, sq: .07, sway: 1 }],
    hurt: [{ lean: 6, dx: 3, sq: -.02 }, { lean: 3, dx: 1 }],
    down: [{ dy: 4, sq: -.1, lean: 4 }],
    // 走り：跳ねる高さ（hop）・着地でつぶれる・前へ傾く・髪が後ろへなびく
    run: Array.from({ length: 10 }, (_, i) => { const q = i / 10, s2 = Math.abs(Math.sin(q * TAU)); return { dy: -Math.round(s2 * 4), sq: s2 < .3 ? -.05 : .025 * s2, lean: -3 - Math.round(Math.sin(q * TAU * 2) * 1.5), sway: 2 + Math.round(s2) }; }),
    back: Array.from({ length: 10 }, (_, i) => { const q = i / 10, s = Math.sin(q * TAU), s2 = Math.abs(s); return { dy: -Math.round(s2 * 3.5), sq: s2 < .3 ? -.045 : .02, lean: Math.round(s * 3), dx: Math.round(s * 1.2), sway: Math.round(-s * 2) }; }),
  };
  function frame(c, view, set, i) {
    const key = c + view + set + i;
    if (CACHE[key]) return CACHE[key];
    const s = SRC[c] && SRC[c][view]; if (!s) return null;
    let P = POSE[set][i];
    if (view === 'runR') P = Object.assign({}, P, { lean: -(P.lean || 0), sway: -(P.sway || 0) }); // 右向きの絵は前後が逆
    return CACHE[key] = { n: compose(s, P), fix: view === 'runR' || view === 'back', ox: OX, oy: OY };
  }
  G.charReady = c => !!(SRC[c] && SRC[c].front);
  G.charSrc = (c, v) => SRC[c] && SRC[c][v] ? { w: SRC[c][v].w, h: SRC[c][v].h, px: SRC[c][v].px } : null; // 部位分け（char_rig.js）用
  // 今のコマ（勇者以外のキャラ）
  G.charFrame = function (H) {
    const c = G.S.cur; if (!G.charReady(c)) return null;
    const A = H.anim, a = H.act, ranged = G.CHARS[c].ranged;
    // 部位に分けて動かす差分（char_rig.js）があればそれを使い、なければ全体を変形したコマ
    const pick = (set, t, view) => {
      const rs = set === 'cast' ? 'atk' : set, rn = G.charRigCount ? G.charRigCount(rs) : 0;
      if (rn) { const rf = G.charRigFrame(c, view || 'front', rs, Math.max(0, Math.min(rn - 1, Math.floor(t * rn)))); if (rf) return rf; }
      const n = POSE[set].length; return frame(c, view || 'front', set, Math.max(0, Math.min(n - 1, Math.floor(t * n))));
    };
    let fr;
    if (H.dead) fr = H.deadT < .3 ? pick('hurt', 0) : pick('down', 0);
    else if (H.hurtT > 0 && !a) fr = pick('hurt', H.hurtT > .15 ? 0 : .99);
    else if (a) {
      const p = Math.min(.999, a.t / a.dur);
      if (a.k === 'ult' && p < .4) fr = pick('raise', p / .4);
      else if (a.k === 'combo') fr = pick(ranged ? 'cast' : 'atk', ((p * (a.n || 4)) % 1));
      else if (a.k === 'ult') fr = pick(ranged ? 'cast' : 'atk', (p - .4) / .6);
      else fr = pick(ranged ? 'cast' : 'atk', G.easeOut(p));
    } else if (A.mv > .45) {
      const up = (H.vy || 0) < 0 && Math.abs(H.vy) > Math.abs(H.vx || 0) * 1.1, view = up ? 'back' : H.face > 0 ? 'runR' : 'runL';
      const t = ((A.walk * .75 / TAU) % 1 + 1) % 1;
      fr = pick(up ? 'back' : 'run', t, view) || pick('idle', 0);
    } else fr = pick('idle', (A.t * 5 % 8) / 8);
    if (!fr) return null;
    fr.w = fr.w || G.tintCanvas(fr.n, '#ffffff');
    return fr;
  };
  // 一覧やカットイン用：待機の1コマ目
  G.charPortrait = c => G.charReady(c) ? frame(c, 'front', 'idle', 0).n : null;
  load();
})();
