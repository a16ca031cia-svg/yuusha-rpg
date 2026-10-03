'use strict';
// ===== 描画 =====
(function () {
  const T = G.TILE;
  let ctx, hc, hx, lc, lx;
  // 勇者は2倍解像度（1ドット=0.5ワールド単位）のキャンバスで合成し、半分の大きさで描く
  const HQ = 2, HCW = 144;
  const HO = { x: 72, y: 104 }; // 合成キャンバス内の足元原点（高解像度）
  const PX = G.PX;
  G.initRender = function (cv) {
    ctx = cv.getContext('2d');
    hc = G.canvas(HCW, HCW); hx = hc.getContext('2d'); hx.imageSmoothingEnabled = false;
    lc = G.canvas(8, 8); lx = lc.getContext('2d');
    G.afterPool = [];
  };
  const snap = v => Math.round(v * G.scale) / G.scale;

  // ------------------------------------------------------------ 多角形のドット塗り
  function fillPoly(c, pts, ox, oy, col) {
    let minY = 1e9, maxY = -1e9;
    for (const p of pts) { if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y; }
    c.fillStyle = col;
    const n = pts.length, xs = [];
    for (let y = Math.floor(minY); y <= Math.ceil(maxY); y++) {
      const yc = y + .5; xs.length = 0;
      for (let i = 0; i < n; i++) {
        const a = pts[i], b = pts[(i + 1) % n];
        if ((a.y <= yc && b.y > yc) || (b.y <= yc && a.y > yc)) xs.push(a.x + (yc - a.y) / (b.y - a.y) * (b.x - a.x));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const x0 = Math.round(xs[k]), x1 = Math.round(xs[k + 1]);
        if (x1 > x0) c.fillRect(ox + x0, oy + y, x1 - x0, 1);
      }
    }
  }
  function capePolys(H) {
    const pts = H.cape.map(p => ({ x: (p.x - H.x) * HQ, y: (p.y - H.y) * HQ }));
    const n = pts.length, L = [], Rr = [], C = [];
    for (let i = 0; i < n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
      let dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
      const w = (2.4 + i * 1.3) * HQ;
      L.push({ x: pts[i].x - dy * w, y: pts[i].y + dx * w });
      Rr.push({ x: pts[i].x + dy * w, y: pts[i].y - dx * w });
      C.push(pts[i]);
    }
    // ぼろぼろの裾
    const last = pts[n - 1], prev = pts[n - 2];
    let dx = last.x - prev.x, dy = last.y - prev.y; const d = Math.hypot(dx, dy) || 1; dx /= d; dy /= d;
    const bottom = [];
    const l = L[n - 1], r = Rr[n - 1];
    for (let k = 1; k <= 4; k++) {
      const t = k / 5, bx = G.lerp(l.x, r.x, t), by = G.lerp(l.y, r.y, t), ext = ((k % 2 ? 2.4 : -.6) + Math.sin(H.anim.t * 7 + k) * .6) * HQ;
      bottom.push({ x: bx + dx * ext, y: by + dy * ext });
    }
    const full = L.concat(bottom, Rr.slice().reverse());
    const shade = L.slice(1).concat(C.slice(1).reverse());
    return { full, shade, C };
  }
  function drawCape(c, H) {
    if (!H.cape.length) return;
    const P = capePolys(H), ox = HO.x, oy = HO.y;
    const o = '#1c110d';
    fillPoly(c, P.full, ox - 1, oy, o); fillPoly(c, P.full, ox + 1, oy, o);
    fillPoly(c, P.full, ox, oy - 1, o); fillPoly(c, P.full, ox, oy + 1, o);
    fillPoly(c, P.full, ox, oy, '#b9362d');
    // 陰側（裏地がのぞく側）
    fillPoly(c, P.shade, ox, oy, '#7c231f');
    // ハイライトの折り目（高解像度なので細い線で描ける）
    c.fillStyle = '#d65a48';
    for (let i = 1; i < P.C.length; i++) {
      const a = P.C[i - 1], b = P.C[i];
      for (let k = 0; k < 4; k++) {
        const x = G.lerp(a.x, b.x, k / 4) + H.face * 3, y = G.lerp(a.y, b.y, k / 4);
        c.fillRect(ox + Math.round(x), oy + Math.round(y), 1, 1);
      }
    }
    // 裾の縁取り
    c.fillStyle = '#9a2a24';
    for (const p of P.full.slice(P.C.length, P.C.length + 4)) c.fillRect(ox + Math.round(p.x), oy + Math.round(p.y) - 1, 1, 1);
  }

  // ------------------------------------------------------------ 勇者の合成
  function composeHero(H) {
    const A = H.anim, f = H.face, S_ = G.HS;
    hx.clearRect(0, 0, HCW, HCW);
    // 以下の座標はすべて高解像度ドット単位（ワールド1単位 = 2ドット）
    const hop = Math.round((A.hop || 0) * HQ);
    const P = (s, X, Y) => { if (f === 1) hx.drawImage(s.n, HO.x + X - 1, HO.y + Y - 1); else hx.drawImage(s.f, HO.x - X - (s.w - 2) - 1, HO.y + Y - 1); };
    const mv = A.mv, p = A.walk;
    const lf = { x: Math.round(Math.sin(p) * 4.5 * mv), y: -Math.round(Math.max(0, Math.cos(p)) * 3.5 * mv) };
    const lb = { x: Math.round(-Math.sin(p) * 4.5 * mv), y: -Math.round(Math.max(0, -Math.cos(p)) * 3.5 * mv) };
    const breath = (Math.sin(A.t * 2.4) + 1) * .9;
    const by = Math.round(-Math.abs(Math.sin(p)) * mv * 3 + (1 - mv) * breath + (A.lean || 0) * HQ) + hop;
    A.hy = G.lerp(A.hy || 0, by, .4);
    const hy = Math.round(A.hy);
    drawCape(hx, H);
    P(S_.leg, -12 + lb.x, -12 + lb.y + hop);
    const sh = { x: 6, y: -30 + by };
    const armB = { x: -12 + Math.round(-Math.sin(p) * 3 * mv), y: -30 + by };
    P(S_.arm, armB.x, armB.y);
    P(S_.torso, -14, -36 + by);
    P(S_.leg, -2 + lf.x, -12 + lf.y + hop);
    let head = S_.head;
    if (H.hurtT > 0 || H.dead) head = S_.hurt; else if (A.blink > 0) head = S_.blink;
    // 剣・腕・手
    const armA = A.armA;
    let hxp = Math.round(sh.x + Math.cos(armA) * 9.2), hyp = Math.round(sh.y + Math.sin(armA) * 9.2 + 2);
    if (A.raise) { hxp = 26; hyp = -36 + by; } // 振りかざし：頭の横で剣を掲げる
    const drawArm = () => {
      const cx = f === 1 ? HO.x + hxp + .5 : HO.x - hxp - .5, cy = HO.y + hyp + .5;
      hx.save(); hx.translate(cx, cy); hx.scale(f, 1); hx.rotate(A.swA);
      // 装備中の武器の種類で剣の見た目が変わる
      const wIt = G.S && G.itemById(G.S.equip.weapon), sw = (wIt && S_.swords[wIt.b]) || S_.sword;
      hx.drawImage(sw.n, -G.SWORD_PIVOT.x, -G.SWORD_PIVOT.y);
      hx.restore();
      // 袖（肩から手まで）
      const px = v => f === 1 ? HO.x + v : HO.x - v - 2;
      for (let k = 0; k <= 4; k++) {
        const ax = Math.round(G.lerp(sh.x, hxp, k / 5)), ay = Math.round(G.lerp(sh.y + 2, hyp, k / 5));
        hx.fillStyle = k < 3 ? '#f0e7d3' : '#cbbd9e';
        hx.fillRect(px(ax), HO.y + ay, 2, 3);
      }
      P(S_.hand, hxp - 4, hyp - 4);
    };
    // 剣を振り上げている時は頭の後ろ、それ以外は手前
    const sa = Math.atan2(Math.sin(A.swA), Math.cos(A.swA));
    const behind = !A.raise && sa < -.85 && sa > -2.7;
    if (behind) drawArm();
    P(head, -30, -74 + hy);
    if (!behind) drawArm();
  }
  // 勇者：ドット差分のコマを状態に応じて切り替えて描く
  const HF = G.HERO_FRAME;
  G.composeHero = H => G.heroFrame(H).n;
  function drawHero(H, alpha) {
    const fr = G.heroFrame(H), img = H.flash > 0 ? fr.w : fr.n;
    const w = img.width * PX, h = img.height * PX, ox = (fr.ox || HF.OX) * PX, oy = (fr.oy || HF.OY) * PX; // コマごとの大きさ・足元
    ctx.save(); ctx.translate(snap(H.x), snap(H.y));
    if (H.dead) {
      const t = G.clamp((H.deadT - .9) / .45, 0, 1); // 膝をついてから倒れる
      ctx.globalAlpha = Math.max(0, 1 - H.deadT / 2.2); ctx.rotate(-H.face * t * Math.PI / 2 * .95);
    } else {
      ctx.globalAlpha = alpha == null ? 1 : alpha; // 前傾はコマに描き込み済み（回転させずドットを崩さない）
    }
    const sx = fr.fix ? 1 : HF.left ? -H.face : H.face; // 元の立ち絵は左向き（右向き・後ろ姿の走りの絵はそのまま）
    ctx.scale(sx, 1);
    ctx.drawImage(img, -ox, -oy, w, h);
    ctx.restore(); ctx.globalAlpha = 1;
    // 残像（同じコマを青白く）
    if (H.afterReq) { H.afterReq = false; H.after.push({ c: G.heroGhost(fr), x: H.x, y: H.y, sx, ox: fr.ox || HF.OX, oy: fr.oy || HF.OY, t: 0 }); }
  }
  // ------------------------------------------------------------ 敵
  function drawWeap(e, sp, mt, ox, oy, K) {
    const wp = sp.weap, ES = G.ESC, hx = snap(e.x) + ox + e.face * mt.hand.u * K, hy = snap(e.y) + 2 - 1.5 * K + oy + mt.hand.v * K;
    const grip = e.type === 'goblin' ? [1, 5.5] : e.type === 'archer' ? [2, 4.5] : [1.2, 5.5];
    ctx.save(); ctx.translate(hx, hy); ctx.scale(e.face, 1); ctx.rotate(mt.hand.a || 0);
    ctx.drawImage(wp.n, -grip[0] * ES, -grip[1] * ES, wp.w * PX, wp.h * PX); ctx.restore();
    if (e.type === 'mage' && e.atk && !e.atkDone) { // 杖の先に火の玉を溜める
      const a = mt.hand.a || 0, tx = hx + e.face * Math.sin(a) * 4.3 * ES, ty = hy - Math.cos(a) * 4.3 * ES;
      ctx.globalAlpha = .5 + Math.sin(e.t * 30) * .3; ctx.fillStyle = '#ffd080'; ctx.beginPath(); ctx.arc(tx, ty, 2 + e.atkT * 4, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
    }
  }
  function drawEnemy(e) {
    const sp = G.enemySpr(e.type, e.tier, e.boss); // ボスは大きく描いた専用の絵
    // 状態ごとのコマの並び（待機・移動・攻撃の溜め・攻撃）から今のコマを選ぶ
    const S = sp.seq, K = sp.k, moving = Math.hypot(e.vx, e.vy) > 5, TAU = Math.PI * 2;
    const loop = (arr, t) => arr[((Math.floor(t * arr.length) % arr.length) + arr.length) % arr.length];
    const prog = (arr, p) => arr[G.clamp(Math.floor(p * arr.length), 0, arr.length - 1)];
    const wind = e.d.wind * (e.boss ? 1.1 : 1);
    let fi, oy = 0, ox = 0;
    if (e.dead || e.frozen > 0) fi = e.lastFi == null ? S.idle[0] : e.lastFi;
    else if (e.atk && !e.atkDone) fi = prog(S.wind, e.atkT / wind);
    else if (e.atk || e.lunge > 0) fi = prog(S.strike, e.atk ? (e.atkT - wind) / Math.min(.4, e.d.rec) : .99);
    else if (sp.walkBy === 'time') fi = loop(S.walk, e.t * sp.fps / S.walk.length);
    else if (moving && sp.walkBy === 'hop') fi = loop(S.walk, ((e.t * 6 - Math.PI / 2) / TAU)); // 移動の速さの波に合わせて跳ねる
    else if (moving) fi = loop(S.walk, (e.ph || 0) / (sp.stride * K / G.ESC)); // 進んだ距離で足を運ぶ（足が滑らない）
    else fi = loop(S.idle, (e.t + (e.id || 0) * .37) * 7 / S.idle.length);
    e.lastFi = fi;
    const mt = sp.meta[fi] || {};
    oy += (mt.oy || 0) * K;
    if (e.type === 'bat') oy += -8 + Math.round(Math.sin(e.t * 5) * 2);
    else if (e.type === 'mage') oy -= 2;
    if (e.hopT > 0) oy -= Math.sin(Math.min(1, e.hopT / .3) * Math.PI) * 5; // 目覚めて跳ねる
    if (e.atk && !e.atkDone && e.type !== 'slime') { ox = -e.face * Math.round(Math.min(1, e.atkT / wind) * 2); }
    if (e.lunge > 0) ox = e.face * 3;
    if (e.shake > 0) ox += Math.round((Math.random() - .5) * 2);    const s = sp.frames[fi];
    const sc = PX;
    const w = s.w * sc, h = s.h * sc;
    const flip = e.face < 0;
    const x = snap(e.x) - Math.floor(w / 2) + ox, y = snap(e.y) - h + 2 + oy;
    // 撃破時：白く光って弾ける
    if (e.dead) {
      const t = e.deadT / .5;
      ctx.globalAlpha = Math.max(0, 1 - t);
      const k = 1 + t * .6;
      ctx.drawImage(flip ? s.wf : s.wn, snap(e.x) - w * k / 2, snap(e.y) - h * k + 2, w * k, h * k);
      ctx.globalAlpha = 1; return;
    }
    if (e.elite || e.boss) {
      const au = (e.boss ? sp.gold : sp.aura)[fi], img = flip ? au.f : au.n;
      ctx.globalAlpha = .45 + Math.sin(G.W.time * 6) * .2;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) ctx.drawImage(img, x + dx * PX * 2, y + dy * PX * 2, w, h);
      ctx.globalAlpha = 1;
    }
    if (sp.weap && !e.boss && mt.hand && mt.hand.back) drawWeap(e, sp, mt, ox, oy, K);
    // 攻撃予兆（赤く点滅）
    const warn = e.atk && !e.atkDone && Math.floor(e.atkT * 20) % 2 === 0;
    ctx.drawImage(e.flash > 0 ? (flip ? s.wf : s.wn) : (flip ? s.f : s.n), x, y, w, h);
    if (warn) { ctx.globalAlpha = .45; ctx.drawImage(flip ? sp.aura[fi].f : sp.aura[fi].n, x, y, w, h); ctx.globalAlpha = 1; }
    if (e.frozen > 0) {
      ctx.globalAlpha = .6; ctx.drawImage(flip ? sp.ice[fi].f : sp.ice[fi].n, x, y, w, h); ctx.globalAlpha = 1;
      ctx.fillStyle = '#e8f8ff';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + (i * 5 + 2) % w, y + h - 3 - (i % 2) * 2, 1, 2);
    }
    if (e.poison) { ctx.globalAlpha = .18 + e.poison.st * .04; ctx.drawImage(flip ? G.tintFor(s, '#7fe04a').f : G.tintFor(s, '#7fe04a').n, x, y, w, h); ctx.globalAlpha = 1; }
    // 武器：コマごとの手の位置・角度に持たせる（振りかぶった時は体の後ろ）
    if (sp.weap && !e.boss && mt.hand && !mt.hand.back) drawWeap(e, sp, mt, ox, oy, K);
    // HPバー
    if (!e.boss && e.hpShow > 0 && e.hp < e.maxHp) {
      // 細いバー：暗い枠・減った分の下地・上側に光沢のある残量（フェードアウトする）
      const bw = Math.max(8, Math.round(w * .7 * 4) / 4), bx = snap(e.x - bw / 2), bY = snap(y - 2.5), fw = Math.max(.25, Math.round(bw * e.hp / e.maxHp * 4) / 4);
      ctx.globalAlpha = Math.min(1, e.hpShow * 2);
      ctx.fillStyle = 'rgba(10,6,8,.85)'; ctx.fillRect(bx - .25, bY - .25, bw + .5, 1.25);
      ctx.fillStyle = '#4a1616'; ctx.fillRect(bx, bY, bw, .75);
      ctx.fillStyle = e.elite ? '#e89030' : '#d8403a'; ctx.fillRect(bx, bY, fw, .75);
      ctx.fillStyle = e.elite ? '#ffd080' : '#ff8a70'; ctx.fillRect(bx, bY, fw, .25);
      ctx.globalAlpha = 1;
    }
  }
  // 癒やしの泉：石の縁に囲まれた丸い泉。水面がゆらめき、光の粒が昇る（使った後は光が消える）
  function drawSpring(x0, y0, used, t) {
    if (!used) { const g = ctx.createRadialGradient(x0, y0, 0, x0, y0, 40); g.addColorStop(0, 'rgba(140,220,255,.6)'); g.addColorStop(1, 'rgba(140,220,255,0)'); ctx.fillStyle = g; ctx.fillRect(x0 - 40, y0 - 40, 80, 80); }
    ctx.fillStyle = '#4a4658'; ctx.beginPath(); ctx.ellipse(x0, y0, 20, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#6a6680'; ctx.beginPath(); ctx.ellipse(x0, y0 - 1, 20, 9, 0, Math.PI, 7); ctx.fill();
    ctx.fillStyle = used ? '#2a4a5e' : '#2f7fb8'; ctx.beginPath(); ctx.ellipse(x0, y0, 16, 7, 0, 0, 7); ctx.fill();
    ctx.fillStyle = used ? '#3a6a80' : '#6fd0ff';
    for (let i = 0; i < 3; i++) { const w = 4 + ((t * 1.3 + i * .37) % 1) * 10, yy = y0 - 3 + i * 2.5; ctx.globalAlpha = used ? .4 : .5 + .3 * Math.sin(t * 3 + i); ctx.fillRect(Math.round(x0 - w / 2 + Math.sin(t * 2 + i) * 3), yy, Math.round(w), 1); }
    ctx.globalAlpha = 1;
    if (!used) for (let i = 0; i < 4; i++) { const p = (t * .6 + i / 4) % 1; ctx.globalAlpha = 1 - p; ctx.fillStyle = '#dff6ff'; ctx.fillRect(Math.round(x0 - 8 + i * 5 + Math.sin(t + i) * 2), Math.round(y0 - 2 - p * 22), 1, 1); }
    ctx.globalAlpha = 1;
  }
  // 隠し書庫：本棚と、宙に浮いて光る本（使った後は閉じて暗い）
  function drawLibrary(x0, y0, used, t, bob) {
    const cols = ['#a83a3a', '#3a68a8', '#c8a040', '#4a8a4a', '#7a4aa0', '#b8682a'];
    for (const sx of [-17, 9]) {
      ctx.fillStyle = '#4a2a16'; ctx.fillRect(x0 + sx, y0 - 22, 10, 23);
      ctx.fillStyle = '#6e4224'; ctx.fillRect(x0 + sx, y0 - 22, 10, 1);
      for (let row = 0; row < 3; row++) for (let k = 0; k < 4; k++) { ctx.fillStyle = cols[(row * 4 + k + (sx > 0 ? 3 : 0)) % cols.length]; ctx.fillRect(x0 + sx + 1 + k * 2, y0 - 20 + row * 7, 2, 5 - ((k + row) % 2)); }
    }
    if (!used) { const g = ctx.createRadialGradient(x0, y0 - 14, 0, x0, y0 - 14, 22); g.addColorStop(0, 'rgba(255,220,140,.6)'); g.addColorStop(1, 'rgba(255,220,140,0)'); ctx.fillStyle = g; ctx.fillRect(x0 - 22, y0 - 36, 44, 44); }
    ctx.fillStyle = '#3a2a1e'; ctx.fillRect(x0 - 2, y0 - 8, 4, 8); ctx.fillRect(x0 - 5, y0 - 1, 10, 2); // 書見台
    const by = y0 - 14 + bob;
    ctx.fillStyle = used ? '#5a4a3a' : '#f4e6c0'; ctx.fillRect(x0 - 6, by, 5, 4); ctx.fillRect(x0 + 1, by, 5, 4); // 開いた本
    ctx.fillStyle = used ? '#3a2e24' : '#8a5a2a'; ctx.fillRect(x0 - 1, by, 2, 4);
    if (!used) { ctx.fillStyle = '#b8a070'; for (let i = 0; i < 2; i++) { ctx.fillRect(x0 - 5, by + 1 + i * 2, 3, 1); ctx.fillRect(x0 + 2, by + 1 + i * 2, 3, 1); } if (Math.sin(t * 5) > .5) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x0 + 6, by - 3, 1, 1); } }
  }
  function drawBossTell(e, t) {
    const x = e.x, y = e.y;
    ctx.save();
    if (e.bk === 'king' && e.castT > 0) { // 手下を呼ぶ：紫の輪が集まってくる
      const p = 1 - e.castT / .9;
      ctx.translate(x, y); ctx.scale(1, .55);
      ctx.globalAlpha = .7; ctx.strokeStyle = '#c890ff'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i++) { const r = 50 * (1 - ((p + i / 3) % 1)); ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); }
      ctx.globalAlpha = .18 + p * .2; ctx.fillStyle = '#7a4ad0'; ctx.beginPath(); ctx.arc(0, 0, 46, 0, 7); ctx.fill();
    } else if (e.bk === 'core' && e.castT > 0) { // 全方位の弾：回る魔法陣が広がる
      const p = 1 - e.castT, r = 14 + p * 30;
      ctx.translate(x, y); ctx.scale(1, .55); ctx.rotate(t * 2);
      ctx.globalAlpha = .35 + p * .5; ctx.strokeStyle = '#ff9ad8'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, r * .7, 0, 7); ctx.stroke();
      ctx.beginPath(); for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2, b = (i + 2) / 6 * Math.PI * 2; ctx.moveTo(Math.cos(a) * r * .7, Math.sin(a) * r * .7); ctx.lineTo(Math.cos(b) * r * .7, Math.sin(b) * r * .7); } ctx.stroke();
      ctx.globalAlpha = .15 + p * .2; ctx.fillStyle = '#ff5ac0'; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
    } else if (e.bk === 'blade' && e.aimT > 0) { // 突進：進む先に赤い線（点滅しながら太くなる）
      const L = e.dashLen, p = 1 - e.aimT / .7, on = Math.floor(t * 16) % 2 === 0;
      ctx.translate(x, y - 6); ctx.rotate(e.dashA);
      ctx.globalAlpha = .18 + p * .25; ctx.fillStyle = '#ff3a2a'; ctx.fillRect(0, -6, L, 12);
      ctx.globalAlpha = on ? .9 : .5; ctx.fillStyle = '#ff6a4a'; ctx.fillRect(0, -.5, L * Math.min(1, p * 1.6), 1);
      ctx.beginPath(); ctx.moveTo(L, -6); ctx.lineTo(L + 7, 0); ctx.lineTo(L, 6); ctx.fill();
    }
    ctx.restore();
    // 鎧の巨兵の鎧：青く光る殻（鎧の残りに合わせて薄くなる）
    if (e.bk === 'armor' && e.armor > 0) {
      const a = e.armor / e.armorMax;
      ctx.globalAlpha = (.18 + a * .3) * (.8 + Math.sin(t * 4) * .2); ctx.strokeStyle = '#9fd0ff'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.ellipse(snap(x), snap(y) - 18, 17, 22, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha *= .3; ctx.fillStyle = '#9fd0ff'; ctx.fill(); ctx.globalAlpha = 1;
    }
    // すき（スタン）：頭の上を星が回る
    if (e.stun > 0) {
      ctx.fillStyle = '#fff4a0';
      for (let i = 0; i < 3; i++) { const a = t * 5 + i / 3 * Math.PI * 2; ctx.fillRect(snap(x + Math.cos(a) * 9) - 1, snap(y - 42 + Math.sin(a) * 3) - 1, 2, 2); }
    }
  }
  const tintCache = new Map();
  G.tintFor = (s, col) => { const k = s.n; let m = tintCache.get(k); if (!m) { m = {}; tintCache.set(k, m); } if (!m[col]) m[col] = { n: G.tintCanvas(s.n, col), f: G.tintCanvas(s.f, col) }; return m[col]; };

  // ------------------------------------------------------------ 雷の描画
  function jag(x0, y0, x1, y1, rnd, amp, depth, out) {
    if (depth <= 0) { out.push(x1, y1); return; }
    const mx = (x0 + x1) / 2 + (rnd() - .5) * amp, my = (y0 + y1) / 2 + (rnd() - .5) * amp;
    jag(x0, y0, mx, my, rnd, amp * .55, depth - 1, out);
    jag(mx, my, x1, y1, rnd, amp * .55, depth - 1, out);
  }
  function boltPath(x0, y0, x1, y1, seed, amp) {
    const r = new G.RNG(seed | 0), rnd = () => r.next();
    const out = [x0, y0];
    jag(x0, y0, x1, y1, rnd, amp, 4, out);
    return out;
  }
  function strokePath(pts, w, col) {
    ctx.strokeStyle = col; ctx.lineWidth = w; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pts[0], pts[1]);
    for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
    ctx.stroke();
  }
  function drawBolt(x0, y0, x1, y1, lv, seed, alpha) {
    // 付与レベルで太さ・枝分かれ・火花が成長する
    const tier = lv >= 10 ? 3 : lv >= 5 ? 2 : lv >= 3 ? 1 : 0;
    const d = Math.hypot(x1 - x0, y1 - y0);
    const pts = boltPath(x0, y0, x1, y1, seed, Math.min(26, d * .35));
    const wOut = [2, 3, 3.6, 5.5][tier], wIn = [.8, 1.1, 1.5, 2.4][tier];
    ctx.globalAlpha = alpha * .55; strokePath(pts, wOut + 2, '#3f7fff');
    ctx.globalAlpha = alpha; strokePath(pts, wOut, '#8fd0ff'); strokePath(pts, wIn, '#ffffff');
    if (tier >= 2) {
      const r = new G.RNG((seed | 0) + 7);
      const nb = tier === 3 ? 3 : 2;
      for (let b = 0; b < nb; b++) {
        const i = 2 * (2 + Math.floor(r.next() * (pts.length / 2 - 4)));
        const bx = pts[i], by = pts[i + 1], a = Math.atan2(y1 - y0, x1 - x0) + (r.next() - .5) * 2.2, l = 8 + r.next() * (tier === 3 ? 20 : 12);
        const bp = boltPath(bx, by, bx + Math.cos(a) * l, by + Math.sin(a) * l, seed + b * 13, 6);
        ctx.globalAlpha = alpha * .8; strokePath(bp, wIn + .6, '#9fd8ff');
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------ エフェクト
  function drawFx(W, H) {
    ctx.save();
    for (const f of W.fx) {
      const p = Math.min(1, f.t / f.dur);
      const fx = f.follow ? H.x : f.x, fy = f.follow ? H.y : f.y;
      switch (f.k) {
        case 'pillar': {
          // 氷柱：足元から一気に突き上がり、最後は砕けて消える
          const up = G.easeOut(Math.min(1, p / .22)), fade = p > .7 ? 1 - (p - .7) / .3 : 1, hh = f.h * up, w = f.r;
          ctx.save(); ctx.translate(f.x, f.y); ctx.globalAlpha = fade;
          for (const [dx, sc, hk] of [[-w * .7, .55, .6], [w * .75, .5, .55], [0, 1, 1]]) {
            const bw = w * sc, top = -hh * hk;
            ctx.fillStyle = '#7fc8ff'; ctx.beginPath(); ctx.moveTo(dx - bw, 0); ctx.lineTo(dx, top); ctx.lineTo(dx + bw, 0); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#e8f8ff'; ctx.beginPath(); ctx.moveTo(dx - bw * .35, 0); ctx.lineTo(dx, top); ctx.lineTo(dx + bw * .15, 0); ctx.closePath(); ctx.fill();
          }
          ctx.globalAlpha = fade * .45; ctx.fillStyle = '#bfeaff'; ctx.beginPath(); ctx.ellipse(0, 0, w * 1.6, w * .5, 0, 0, 7); ctx.fill();
          ctx.restore(); ctx.globalAlpha = 1;
          break;
        }
        case 'wind': {
          // 走る勇者の後ろへ流れる風の筋（進む向きと逆へ伸びて消える）
          const l = f.len * (.4 + G.easeOut(p) * .6), ca = Math.cos(f.ang), sa = Math.sin(f.ang), x0 = f.x - ca * p * 10, y0 = f.y - sa * p * 10;
          ctx.globalAlpha = (1 - p) * .55; ctx.strokeStyle = '#eaf4ff'; ctx.lineWidth = .5;
          ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x0 - ca * l, y0 - sa * l); ctx.stroke(); ctx.globalAlpha = 1;
          break;
        }
        case 'slash': {
          // 斬撃の軌跡（先端から尾へ消える帯）
          const e = G.easeOut(Math.min(1, p / .7));
          const head = f.a0 + (f.a1 - f.a0) * e, tail = f.a0 + (f.a1 - f.a0) * Math.max(0, e - .55 - p * .5);
          const alpha = 1 - Math.max(0, (p - .55) / .45);
          if (alpha <= 0 || Math.abs(head - tail) < .02) break;
          const cx = fx, cy = fy - 11, ccw = f.a1 < f.a0;
          ctx.save(); ctx.translate(cx, cy); ctx.scale(1, .78);
          const R0 = f.r * .74, R1 = R0 * f.w; // 小さな勇者に合わせて見た目だけ縮める
          ctx.globalAlpha = alpha * .55; ctx.fillStyle = f.col;
          ctx.beginPath(); ctx.arc(0, 0, R0, tail, head, ccw); ctx.arc(0, 0, R1, head, tail, !ccw); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = alpha; ctx.strokeStyle = f.col; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.arc(0, 0, R0, tail, head, ccw); ctx.stroke();
          ctx.globalAlpha = alpha * .9; ctx.fillStyle = '#ffffff';
          ctx.beginPath(); ctx.arc(Math.cos(head) * (R0 - 1), Math.sin(head) * (R0 - 1), 1.6, 0, 7); ctx.fill();
          ctx.restore();
          break;
        }
        case 'spin': {
          const a0 = -Math.PI / 2, sweep = Math.PI * 2 * G.easeOut(Math.min(1, p / .6)) * f.dir;
          const alpha = 1 - Math.max(0, (p - .5) / .5);
          ctx.save(); ctx.translate(fx, fy - 11); ctx.scale(1, .7);
          ctx.globalAlpha = alpha * .45; ctx.fillStyle = '#a8e0ff';
          ctx.beginPath(); ctx.arc(0, 0, f.r, a0, a0 + sweep, f.dir < 0); ctx.arc(0, 0, f.r * .55, a0 + sweep, a0, f.dir > 0); ctx.closePath(); ctx.fill();
          ctx.globalAlpha = alpha; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
          ctx.beginPath(); ctx.arc(0, 0, f.r, a0 + sweep - f.dir * 1.2, a0 + sweep, f.dir < 0); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'impact': {
          // 打撃の集中線：命中方向を中心に扇状、会心は金色で長い
          const n = f.crit ? 7 : 5, len = f.crit ? 16 : 10, e = G.easeOut(p), alpha = 1 - p;
          const rr = new G.RNG(f.seed | 0);
          ctx.globalAlpha = alpha; ctx.strokeStyle = f.crit ? '#ffe27a' : '#ffffff'; ctx.lineCap = 'round';
          for (let i = 0; i < n; i++) {
            const a = f.ang + (i / (n - 1) - .5) * 1.9 + (rr.next() - .5) * .3, l = len * (.6 + rr.next() * .6);
            const r0 = 2 + l * e * .5, r1 = 3 + l * (.35 + e * .9);
            ctx.lineWidth = (f.crit ? 1.6 : 1.1) * (1 - p) + .3;
            ctx.beginPath(); ctx.moveTo(f.x + Math.cos(a) * r0, f.y + Math.sin(a) * r0 * .8); ctx.lineTo(f.x + Math.cos(a) * r1, f.y + Math.sin(a) * r1 * .8); ctx.stroke();
          }
          if (f.crit && p < .35) { ctx.globalAlpha = (1 - p / .35) * .8; ctx.fillStyle = '#fffbe6'; ctx.beginPath(); ctx.arc(f.x, f.y, 5 * (1 - p), 0, 7); ctx.fill(); }
          ctx.globalAlpha = 1;
          break;
        }
        case 'pop': {
          // 撃破の衝撃リング（細い二重円）
          const e = G.easeOut(p), alpha = 1 - p;
          ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, .8);
          ctx.globalAlpha = alpha; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.5 * (1 - p) + .5;
          ctx.beginPath(); ctx.arc(0, 0, f.r * e, 0, 7); ctx.stroke();
          ctx.globalAlpha = alpha * .7; ctx.strokeStyle = f.col; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.arc(0, 0, f.r * e * .65, 0, 7); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'eslash': {
          const alpha = 1 - p;
          ctx.save(); ctx.translate(fx, fy); ctx.scale(1, .75); ctx.globalAlpha = alpha * .7; ctx.fillStyle = '#ff7a5a';
          ctx.beginPath(); ctx.arc(0, 0, f.r, f.ang - 1.2, f.ang - 1.2 + 2.4 * G.easeOut(p)); ctx.arc(0, 0, f.r * .5, f.ang - 1.2 + 2.4 * G.easeOut(p), f.ang - 1.2, true); ctx.fill();
          ctx.restore();
          break;
        }
        case 'xslash': {
          const alpha = 1 - p, l = f.r * G.easeOut(Math.min(1, p * 2.5));
          const col = f.lv >= 6 ? '#ffe0a0' : '#e0e8ff';
          ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = 1.2 + Math.min(2, f.lv * .15);
          ctx.beginPath(); ctx.moveTo(fx - Math.cos(f.ang) * l, fy - Math.sin(f.ang) * l); ctx.lineTo(fx + Math.cos(f.ang) * l, fy + Math.sin(f.ang) * l); ctx.stroke();
          ctx.strokeStyle = '#ffffff'; ctx.lineWidth = .7;
          ctx.beginPath(); ctx.moveTo(fx - Math.cos(f.ang) * l, fy - Math.sin(f.ang) * l); ctx.lineTo(fx + Math.cos(f.ang) * l, fy + Math.sin(f.ang) * l); ctx.stroke();
          break;
        }
        case 'bolt': {
          const alpha = f.t > f.dur - .15 ? (f.dur - f.t) / .15 : 1;
          const jit = Math.floor(W.time * 30);
          for (let i = 0; i < f.done; i++) {
            const a = f.pts[i], b = f.pts[i + 1];
            drawBolt(a.x, a.y, b.x, b.y, f.lv, f.seed + i * 31 + jit, alpha);
          }
          if (f.done < f.pts.length - 1 && f.done >= 0) {
            const a = f.pts[f.done], b = f.pts[f.done + 1], q = (f.t - f.done * f.hop) / f.hop;
            drawBolt(a.x, a.y, G.lerp(a.x, b.x, q), G.lerp(a.y, b.y, q), f.lv, f.seed + jit, alpha);
          }
          // 最初の着弾点の火花
          ctx.globalAlpha = alpha; ctx.fillStyle = '#ffffff';
          const s0 = f.pts[0]; ctx.beginPath(); ctx.arc(s0.x, s0.y, 2 + Math.min(4, f.lv * .4) * (1 - p), 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'strike': {
          const alpha = 1 - p, jit = Math.floor(W.time * 25);
          drawBolt(f.x + 6, f.y - 140, f.x, f.y - 6, 10, f.seed + jit, alpha);
          ctx.globalAlpha = alpha * .8; ctx.fillStyle = '#fff6c0';
          ctx.beginPath(); ctx.ellipse(f.x, f.y, 20 * (.5 + p), 8 * (.5 + p), 0, 0, 7); ctx.fill();
          ctx.globalAlpha = 1;
          break;
        }
        case 'boom': {
          // 爆発：付与レベルで範囲と爆炎が大きくなる
          const r = f.r * G.easeOut(Math.min(1, p / .35));
          ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, .8);
          if (p < .5) {
            ctx.globalAlpha = (1 - p / .5) * .7;
            const g = ctx.createRadialGradient(0, 0, 0, 0, 0, Math.max(1, r));
            g.addColorStop(0, '#ffffff'); g.addColorStop(.35, '#ffe07a'); g.addColorStop(.7, '#ff7a2a'); g.addColorStop(1, 'rgba(200,40,20,0)');
            ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.fill();
          }
          ctx.globalAlpha = Math.max(0, 1 - p) * .9; ctx.strokeStyle = f.lv >= 6 ? '#ffe7a0' : '#ffb060'; ctx.lineWidth = 1.5 + Math.min(3, f.lv * .25);
          ctx.beginPath(); ctx.arc(0, 0, f.r * (.4 + p * .75), 0, 7); ctx.stroke();
          ctx.restore();
          break;
        }
        case 'ring': {
          const alpha = 1 - p;
          ctx.save(); ctx.translate(f.x, f.y); ctx.scale(1, .6);
          ctx.globalAlpha = alpha; ctx.strokeStyle = f.col; ctx.lineWidth = 3 * (1 - p) + 1;
          ctx.beginPath(); ctx.arc(0, 0, f.r * G.easeOut(p), 0, 7); ctx.stroke();
          ctx.globalAlpha = alpha * .3; ctx.fillStyle = f.col; ctx.beginPath(); ctx.arc(0, 0, f.r * G.easeOut(p), 0, 7); ctx.fill();
          ctx.restore();
          break;
        }
        case 'crack': {
          const alpha = p > .6 ? (1 - p) / .4 : 1;
          const r = new G.RNG(f.seed | 0);
          ctx.globalAlpha = alpha * .8; ctx.strokeStyle = '#1a1210'; ctx.lineWidth = 1;
          for (let i = 0; i < 7; i++) {
            let a = i / 7 * Math.PI * 2 + r.next() * .5, x = f.x, y = f.y;
            ctx.beginPath(); ctx.moveTo(x, y);
            for (let k = 0; k < 4; k++) { a += (r.next() - .5) * .8; const l = f.r / 4 * (.7 + r.next() * .6); x += Math.cos(a) * l; y += Math.sin(a) * l * .6; ctx.lineTo(x, y); }
            ctx.stroke();
          }
          ctx.globalAlpha = 1;
          break;
        }
        case 'lvup': {
          const alpha = 1 - p, h = 60 * G.easeOut(Math.min(1, p * 3));
          const g = ctx.createLinearGradient(0, fy - h, 0, fy);
          g.addColorStop(0, 'rgba(255,240,160,0)'); g.addColorStop(1, 'rgba(255,240,160,.7)');
          ctx.globalAlpha = alpha; ctx.fillStyle = g; ctx.fillRect(H.x - 9, H.y - h, 18, h);
          ctx.strokeStyle = '#fff4b0'; ctx.lineWidth = 1;
          ctx.save(); ctx.translate(H.x, H.y); ctx.scale(1, .45); ctx.beginPath(); ctx.arc(0, 0, 10 + p * 18, 0, 7); ctx.stroke(); ctx.restore();
          ctx.globalAlpha = 1;
          break;
        }
        case 'shieldUp': case 'shieldHit': {
          const alpha = 1 - p;
          ctx.globalAlpha = alpha; ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = f.k === 'shieldUp' ? 2 : 1.5;
          ctx.beginPath(); ctx.ellipse(H.x, H.y - 14, 15 + p * 5, 19 + p * 5, 0, 0, 7); ctx.stroke();
          ctx.globalAlpha = 1;
          break;
        }
        case 'text': {
          const alpha = p > .7 ? (1 - p) / .3 : 1, yy = f.y - G.easeOut(Math.min(1, p * 2)) * 12;
          ctx.globalAlpha = alpha;
          ctx.font = `${f.size}px DotGothic16, monospace`; ctx.textAlign = 'center';
          ctx.fillStyle = '#000'; ctx.fillText(f.text, f.x + .6, yy + .6); ctx.fillText(f.text, f.x - .6, yy + .6);
          ctx.fillStyle = f.col; ctx.fillText(f.text, f.x, yy);
          ctx.globalAlpha = 1;
          break;
        }
      }
    }
    ctx.restore();
  }
  function drawProjs(W) {
    for (const p of W.projs) {
      if (p.k === 'arrow') {
        ctx.save(); ctx.translate(snap(p.x), snap(p.y)); ctx.rotate(p.ang);
        ctx.fillStyle = '#1c110d'; ctx.fillRect(-6, -1, 10, 3);
        ctx.fillStyle = '#c8a878'; ctx.fillRect(-5, 0, 8, 1);
        ctx.fillStyle = '#e8e8f0'; ctx.fillRect(3, -1, 2, 3);
        ctx.fillStyle = '#e04848'; ctx.fillRect(-6, -1, 2, 1); ctx.fillRect(-6, 1, 2, 1);
        ctx.restore();
      } else if (p.k === 'orb') {
        const pr = 3.2 + Math.sin(p.t * 20) * .5;
        ctx.globalAlpha = .45; ctx.fillStyle = '#ff7a2a'; ctx.beginPath(); ctx.arc(p.x, p.y, pr + 2.5, 0, 7); ctx.fill();
        ctx.globalAlpha = 1; ctx.fillStyle = '#ffb060'; ctx.beginPath(); ctx.arc(p.x, p.y, pr, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff4d0'; ctx.beginPath(); ctx.arc(p.x - .6, p.y - .6, pr * .45, 0, 7); ctx.fill();
      } else if (p.k === 'wave') {
        const a = 1 - Math.max(0, (p.t - p.life + .2) / .2);
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.ang); ctx.globalAlpha = a;
        ctx.fillStyle = p.col || 'rgba(120,220,255,.45)'; if (p.col) ctx.globalAlpha = a * .55; // 属性の色（雷・氷・居合・必殺技）
        ctx.beginPath(); ctx.arc(-4, 0, p.r + 2, -1.25, 1.25); ctx.arc(-9, 0, p.r - 1, 1.1, -1.1, true); ctx.fill();
        ctx.globalAlpha = a; ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.arc(-4, 0, p.r, -1.15, 1.15); ctx.arc(-7, 0, p.r - 1.5, 1.05, -1.05, true); ctx.fill();
        ctx.restore();
      }
    }
  }
  function drawNums(W) {
    for (const n of W.nums) {
      const cols = { n: '#ffffff', crit: '#ffe04a', chain: '#9fdcff', boom: '#ffa050', burn: '#ff8a3a', poison: '#a8f060', follow: '#dfe6ff', skill: '#fff0b0', hurt: '#ff5a4a', heal: '#7fff8a' };
      const dg = G.digits(cols[n.k] || '#ffffff');
      const str = G.fmt(n.v);
      const big = n.k === 'crit' ? 2 : 1;
      const up = G.easeOut(Math.min(1, n.t / .5)) * 14;
      const alpha = n.t > .65 ? Math.max(0, 1 - (n.t - .65) / .25) : 1;
      const pop = 1 + n.pop * (big > 1 ? .25 : .5);
      const sc = big * pop;
      const w = G.numWidth(str) * sc;
      let x = snap(n.x + n.dx * G.easeOut(Math.min(1, n.t / .4)) - w / 2), y = snap(n.y - up);
      if (G.cam && G.VW) { const l = G.cam.x - G.VW / 2 + 3, r = G.cam.x + G.VW / 2 - 3 - w; if (r > l) x = snap(G.clamp(x, l, r)); } // 画面のふちで見切れないように
      ctx.globalAlpha = alpha;
      for (const ch of str) {
        const g = dg[ch]; if (!g) continue;
        ctx.drawImage(g, x - PX * sc, y - PX * sc, g.width * PX * sc, g.height * PX * sc);
        x += ((g.width - 2) * PX + 1) * sc;
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------ メイン描画
  G.render = function () {
    const cv = G.cv, sc = G.scale, W = G.W, H = G.hero;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#07060b'; ctx.fillRect(0, 0, cv.width, cv.height);
    if (!W || !H) return;
    const VW = G.VW, VH = G.VH;
    const sh = G.shakeA;
    const camX = G.cam.x - VW / 2 + (sh ? (Math.random() - .5) * sh : 0), camY = G.cam.y - VH / 2 + (sh ? (Math.random() - .5) * sh : 0);
    const tx = Math.round(-camX * sc), ty = Math.round(-camY * sc);
    ctx.setTransform(sc, 0, 0, sc, tx, ty);
    const vx0 = -tx / sc, vy0 = -ty / sc;
    const D = W.D;
    // 地形（画面内だけ）
    // 地形：見えている範囲の塊（8x8マス・4倍の細かさ）だけ描く
    const CU = G.CHUNK * T;
    ctx.imageSmoothingEnabled = G.scale % 4 !== 0; // 1ドットが整数ピクセルにならない倍率ではなめらかに拡縮
    for (let cy = Math.max(0, Math.floor(vy0 / CU)); cy <= Math.min(Math.ceil(D.H / G.CHUNK) - 1, Math.floor((vy0 + VH) / CU)); cy++)
      for (let cx = Math.max(0, Math.floor(vx0 / CU)); cx <= Math.min(Math.ceil(D.W / G.CHUNK) - 1, Math.floor((vx0 + VW) / CU)); cx++)
        ctx.drawImage(G.getChunk(W, cx, cy), cx * CU, cy * CU, CU, CU);
    const t = W.time;
    // 階段の光（探索完了で強く）
    if (D.stairs) {
      const x = D.stairs.tx * T + 8, y = D.stairs.ty * T + 8;
      const a = W.complete ? .35 + Math.sin(t * 4) * .15 : .12;
      ctx.globalAlpha = a; ctx.fillStyle = '#9fdcff'; ctx.fillRect(x - 7, y - 6, 14, 13); ctx.globalAlpha = 1;
      if (W.complete && Math.random() < .3) G.part(x + (Math.random() - .5) * 12, y + 4, 0, -20, .8, '#bfeaff', 1, -5, .5);
    }
    // 焚き火（ホーム）
    if (W.home && W.fire) {
      const f = W.fire;
      ctx.drawImage(G.CAMPFIRE, f.x - 7, f.y - 5, G.CAMPFIRE.width * PX, G.CAMPFIRE.height * PX);
      const fl = G.FLAMES[Math.floor(t * 12) % 6];
      ctx.drawImage(fl, f.x - 3, f.y - 10, 7, 7);
      ctx.drawImage(G.FLAMES[(Math.floor(t * 12) + 3) % 6], f.x - 5, f.y - 8, 5, 6);
    }
    // 松明
    for (const tc of D.torches) {
      if (!W.explored[G.tileOfD(D, tc.x, tc.y)]) continue;
      ctx.drawImage(G.BRACKET, tc.x - 3, tc.y, G.BRACKET.width * PX, G.BRACKET.height * PX);
      const fl = G.FLAMES[Math.floor(t * 12 + tc.ph) % 6];
      ctx.drawImage(fl, tc.x - 2.5, tc.y - 5, fl.width * PX, fl.height * PX);
    }
    // 影
    ctx.globalAlpha = 1;
    const shadowAt = (x, y, w) => { const s = G.shadow(w); ctx.drawImage(s, snap(x) - s.width * PX / 2, snap(y) - s.height * PX / 2, s.width * PX, s.height * PX); };
    for (const e of W.enemies) if (!e.dead) shadowAt(e.x, e.y + 1, e.r * (e.boss ? 5.2 : 3.4));
    for (const d of W.drops) shadowAt(d.x, d.y + 2, 8);
    if (!H.dead) shadowAt(H.x, H.y + 1, 13 - Math.min(4, -(H.anim.hop || 0) * .25));
    // 残像
    for (let i = H.after.length - 1; i >= 0; i--) {
      const a = H.after[i]; a.t += 1 / 60;
      if (a.t > .22) { H.after.splice(i, 1); continue; }
      ctx.save(); ctx.globalAlpha = (1 - a.t / .22) * .45; ctx.translate(snap(a.x), snap(a.y)); ctx.scale(a.sx || 1, 1);
      ctx.drawImage(a.c, -(a.ox || HF.OX) * PX, -(a.oy || HF.OY) * PX, a.c.width * PX, a.c.height * PX); ctx.restore(); ctx.globalAlpha = 1;
    }
    // Yソートで描画
    const list = [];
    for (const c of W.chests) list.push({ y: c.y, k: 0, o: c });
    for (const s of W.specials || []) if (s.kind === 'altar' || s.kind === 'spring' || s.kind === 'library') list.push({ y: s.y, k: 4, o: s });
    for (const d of W.drops) list.push({ y: d.y, k: 1, o: d });
    for (const e of W.enemies) list.push({ y: e.y + (e.type === 'bat' ? 6 : 0), k: 2, o: e });
    list.push({ y: H.y, k: 3, o: H });
    list.sort((a, b) => a.y - b.y);
    for (const it of list) {
      if (it.k === 0) {
        const c = it.o;
        if (c.hidden || !W.explored[G.tileOfD(D, c.x, c.y)]) continue;
        const s = c.opened ? G.CHEST_OPEN : G.CHEST;
        let oy = 0; if (c.opened && c.openT < .25) oy = -Math.round(Math.sin(c.openT / .25 * Math.PI) * 3);
        ctx.drawImage(s.n, snap(c.x) - s.w * PX / 2, snap(c.y) - 11 + oy, s.w * PX, s.h * PX);
        if (!c.opened && Math.sin(t * 3 + c.x) > .92) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(snap(c.x) + 3, snap(c.y) - 9, 1, 1); }
      } else if (it.k === 1) {
        const d = it.o, rc = G.RARITY[d.it.rar].c;
        const bob = d.z > 0 ? -d.z : -Math.round(1 + Math.sin(t * 4 + d.x) * 1.2);
        if (d.it.rar >= 2) {
          // レア以上は光の柱
          const hgt = 14 + d.it.rar * 8;
          const g = ctx.createLinearGradient(0, d.y - hgt, 0, d.y);
          g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, rc);
          ctx.globalAlpha = .35 + Math.sin(t * 5) * .1; ctx.fillStyle = g; ctx.fillRect(d.x - 2, d.y - hgt, 4, hgt); ctx.globalAlpha = 1;
        }
        const ic = G.ICONW[d.it.slot], iw = ic.width * PX, ih = ic.height * PX;
        ctx.drawImage(ic, snap(d.x) - iw / 2, snap(d.y) - ih + 2 + bob, iw, ih);
        if (Math.sin(t * 6 + d.x) > .7) { ctx.fillStyle = rc; ctx.fillRect(snap(d.x) + 3, snap(d.y) - ih + 1 + bob, PX, PX); }
      } else if (it.k === 4) {
        // 祝福の祭壇：石の台の上に浮かぶ結晶。使う前は金色に光り、使った後は暗い
        const s = it.o; if (!W.explored[G.tileOfD(D, s.x, s.y)]) continue;
        const used = s.used || W.roomSeen[s.room], x0 = snap(s.x), y0 = snap(s.y), bob = used ? 0 : Math.sin(t * 2.5) * 1.5;
        if (s.kind === 'spring') { drawSpring(x0, y0, used, t); continue; }
        if (s.kind === 'library') { drawLibrary(x0, y0, used, t, bob); continue; }
        if (!used) { const g = ctx.createRadialGradient(x0, y0 - 10, 0, x0, y0 - 10, 26); g.addColorStop(0, 'rgba(255,230,140,.55)'); g.addColorStop(1, 'rgba(255,230,140,0)'); ctx.fillStyle = g; ctx.fillRect(x0 - 26, y0 - 36, 52, 52); }
        ctx.fillStyle = '#3a3448'; ctx.fillRect(x0 - 7, y0 - 6, 14, 7); ctx.fillStyle = '#5a5470'; ctx.fillRect(x0 - 7, y0 - 6, 14, 2); ctx.fillStyle = '#2a2436'; ctx.fillRect(x0 - 5, y0 - 10, 10, 4);
        ctx.fillStyle = used ? '#6a6480' : '#ffe27a'; ctx.beginPath(); ctx.moveTo(x0, y0 - 24 + bob); ctx.lineTo(x0 + 5, y0 - 17 + bob); ctx.lineTo(x0, y0 - 11 + bob); ctx.lineTo(x0 - 5, y0 - 17 + bob); ctx.closePath(); ctx.fill();
        ctx.fillStyle = used ? '#8a84a0' : '#fffbe6'; ctx.fillRect(x0 - 2, y0 - 21 + bob, 2, 3);
        if (!used && Math.sin(t * 4 + s.x) > .6) { ctx.fillStyle = '#fff6c0'; ctx.fillRect(x0 + 4, y0 - 26 + bob, 1, 1); }
      } else if (it.k === 2) drawEnemy(it.o);
      else drawHero(H);
    }
    drawProjs(W);
    // 障壁
    if (H.shield > 0 && !H.dead) {
      const lvl = H.st.barrierLv || 1, a = .25 + Math.min(.35, H.shield / H.st.maxHp);
      ctx.globalAlpha = a * (.8 + Math.sin(t * 5) * .2); ctx.strokeStyle = '#bff0ff'; ctx.lineWidth = 1 + Math.min(2, lvl * .2);
      ctx.beginPath(); ctx.ellipse(snap(H.x), snap(H.y) - 10, 10, 13, 0, 0, 7); ctx.stroke();
      ctx.globalAlpha = a * .25; ctx.fillStyle = '#8fe3ff'; ctx.fill(); ctx.globalAlpha = 1;
    }
    // 敵の地面攻撃予告
    for (const e of W.enemies) {
      if (e.dead || !e.atk || e.atkDone || !(e.d.heavy || (e.boss && e.type === 'golem'))) continue;
      const r = e.boss ? 40 : 26, p = Math.min(1, e.atkT / e.d.wind);
      ctx.save(); ctx.translate(e.x + e.face * 6, e.y); ctx.scale(1, .6);
      ctx.globalAlpha = .25 + p * .25; ctx.fillStyle = '#ff3a2a'; ctx.beginPath(); ctx.arc(0, 0, r * p, 0, 7); ctx.fill();
      ctx.globalAlpha = .7; ctx.strokeStyle = '#ff6a4a'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(0, 0, r, 0, 7); ctx.stroke();
      ctx.restore();
    }
    // 固有ボスの予兆（呼び出し・魔法陣・突進の線）
    if (W.boss && !W.boss.dead && W.boss.bk) drawBossTell(W.boss, t);
    // 霧（未探索は黒・探索済みで視界外は暗く）
    if (W.fogDirty) updateFog(W);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(W.fogCv, 0, 0, D.W * T, D.H * T);
    // 光と闇
    drawLighting(W, H, vx0, vy0, VW, VH);
    ctx.imageSmoothingEnabled = false;
    // 発光するエフェクト・パーティクルは闇の上に描く
    for (const p of W.parts) {
      const a = 1 - p.t / p.life;
      ctx.globalAlpha = a < .3 ? a / .3 : 1; ctx.fillStyle = p.col;
      const ps = p.s * .5; // 粒も細かいドットで
      ctx.fillRect(snap(p.x - ps / 2), snap(p.y - ps / 2), ps, ps);
    }
    ctx.globalAlpha = 1;
    drawFx(W, H);
    drawNums(W);
    // 画面遷移
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (G.trans) {
      const tr = G.trans, half = tr.dur / 2;
      const a = tr.t < half ? tr.t / half : 1 - (tr.t - half) / half;
      ctx.fillStyle = `rgba(4,3,8,${G.clamp(a * 1.15, 0, 1)})`; ctx.fillRect(0, 0, cv.width, cv.height);
    }
    // ごく弱い周辺減光（奥行き）
    if (!G._vig || G._vig.w !== cv.width || G._vig.h !== cv.height) {
      const vc = G.canvas(cv.width, cv.height), vx = vc.getContext('2d'), g = vx.createRadialGradient(cv.width / 2, cv.height / 2, Math.min(cv.width, cv.height) * .38, cv.width / 2, cv.height / 2, Math.max(cv.width, cv.height) * .72);
      g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.42)'); vx.fillStyle = g; vx.fillRect(0, 0, cv.width, cv.height);
      G._vig = { c: vc, w: cv.width, h: cv.height };
    }
    ctx.drawImage(G._vig.c, 0, 0);
    // 低HPの赤い縁
    if (!W.home && !H.dead && H.hp / H.st.maxHp < .3) {
      const a = (.3 - H.hp / H.st.maxHp) / .3 * (.35 + Math.sin(t * 6) * .12);
      const g = ctx.createRadialGradient(cv.width / 2, cv.height / 2, cv.height * .35, cv.width / 2, cv.height / 2, cv.height * .8);
      g.addColorStop(0, 'rgba(160,0,0,0)'); g.addColorStop(1, `rgba(160,0,0,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, cv.width, cv.height);
    }
  };
  G.tileOfD = (D, x, y) => Math.floor(y / T) * D.W + Math.floor(x / T);

  function updateFog(W) {
    const D = W.D, c = W.fogCv.getContext('2d'), img = c.createImageData(D.W, D.H), d = img.data;
    for (let i = 0; i < D.W * D.H; i++) {
      d[i * 4] = 7; d[i * 4 + 1] = 6; d[i * 4 + 2] = 11;
      d[i * 4 + 3] = !W.explored[i] ? 255 : W.vis[i] ? 0 : 120;
    }
    c.putImageData(img, 0, 0);
    W.fogDirty = false;
  }
  function drawLighting(W, H, vx0, vy0, VW, VH) {
    const q = 3, lw = Math.ceil(VW / q) + 2, lh = Math.ceil(VH / q) + 2;
    if (lc.width !== lw || lc.height !== lh) { lc.width = lw; lc.height = lh; }
    const th = W.D.theme, dark = W.home ? .5 : th.dark * .85;
    lx.globalCompositeOperation = 'source-over';
    lx.clearRect(0, 0, lw, lh);
    // 闇の色はエリアごとに変える（石=青紫、砂=琥珀、氷=青、溶岩=赤、深淵=紫）
    const AMB = [[6, 5, 16], [16, 9, 4], [3, 9, 22], [22, 5, 3], [12, 3, 22]], ai = W.home ? [10, 6, 4] : AMB[G.THEMES.indexOf(th) % 5] || AMB[0];
    lx.fillStyle = `rgba(${ai[0]},${ai[1]},${ai[2]},${dark})`; lx.fillRect(0, 0, lw, lh);
    lx.globalCompositeOperation = 'destination-out';
    const hole = (x, y, r, a) => {
      const X = (x - vx0) / q, Y = (y - vy0) / q, Rr = r / q;
      if (X < -Rr || Y < -Rr || X > lw + Rr || Y > lh + Rr) return;
      const g = lx.createRadialGradient(X, Y, 0, X, Y, Rr);
      g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(.55, `rgba(0,0,0,${a * .75})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      lx.fillStyle = g; lx.fillRect(X - Rr, Y - Rr, Rr * 2, Rr * 2);
    };
    const t = W.time;
    hole(H.x, H.y - 8, 150, 1);
    for (const tc of W.D.torches) if (W.explored[G.tileOfD(W.D, tc.x, tc.y)]) hole(tc.x, tc.y + 6, 62 + Math.sin(t * 8 + tc.ph) * 3 + Math.sin(t * 13 + tc.ph * 2) * 2, .8);
    if (W.fire) hole(W.fire.x, W.fire.y - 4, 110 + Math.sin(t * 9) * 5, 1);
    for (const l of W.lights) hole(l.x, l.y, l.r * (1 - l.t / l.dur * .5), 1 - l.t / l.dur);
    for (const d of W.drops) if (d.it.rar >= 2) hole(d.x, d.y, 30, .6);
    for (const p of W.projs) if (p.k === 'orb') hole(p.x, p.y, 34, .8);
    if (W.D.stairs && W.complete) hole(W.D.stairs.tx * T + 8, W.D.stairs.ty * T + 8, 60, .7);
    lx.globalCompositeOperation = 'source-over';
    ctx.drawImage(lc, vx0, vy0, lw * q, lh * q);
    // 暖色の光（加算）
    ctx.globalCompositeOperation = 'lighter';
    const glow = (x, y, r, col, a) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, col.replace('A', a)); g.addColorStop(1, col.replace('A', 0));
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    };
    const tl = th.light;
    for (const tc of W.D.torches) if (W.explored[G.tileOfD(W.D, tc.x, tc.y)]) glow(tc.x, tc.y, 34 + Math.sin(t * 8 + tc.ph) * 2, `rgba(${tl[0]},${tl[1]},${tl[2]},A)`, .16);
    if (W.fire) glow(W.fire.x, W.fire.y - 6, 70 + Math.sin(t * 9) * 4, 'rgba(255,150,70,A)', .22);
    // 一時的な光は数と明るさを制限（白飛びで位置が分からなくならないように）
    let budget = .5;
    for (let i = W.lights.length - 1; i >= 0 && budget > 0; i--) {
      const l = W.lights[i], a = Math.min(budget, (1 - l.t / l.dur) * .13); budget -= a;
      const c = G.rgb(l.col); glow(l.x, l.y, Math.min(70, l.r * .5), `rgba(${c[0]},${c[1]},${c[2]},A)`, a);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
})();
