'use strict';
// ===== 敵・宝箱・小物の立体ドット =====
(function () {
  const RES = G.RES, E = G.P3ell, C = G.P3cap, PL = G.P3poly, RC = G.P3rect, U = G.P3union;
  const col = h => [parseInt(h.substr(1, 2), 16), parseInt(h.substr(3, 2), 16), parseInt(h.substr(5, 2), 16)];
  const R = (name, hex, n, sp, hs) => { if (G.rampId(name) == null) G.defRamp(name, G.makeRamp(hex, n || 7, sp == null ? .55 : sp, hs)); return name; };
  // 階層帯ごとの色（0:通常 1:赤 2:青 3:冥 4:黄金）
  const TIER = {
    slime: ['#4fbf5a', '#d9543e', '#3f86dc', '#9448c8', '#e8b834'],
    goblin: ['#6fb43f', '#cf6c3c', '#4a8cc8', '#8c62b8', '#c8a632'],
    bone: ['#e6dfcc', '#ecc2b0', '#c2d8ea', '#d2c2e8', '#eedc98'],
    rock: ['#86806e', '#95604c', '#6682a2', '#6a5684', '#b09a5a'],
    core: ['#5ff0dc', '#ffa84a', '#a8ecff', '#ff66cc', '#ffffff'],
    bat: ['#654884', '#843838', '#385684', '#3a2a4a', '#84743a'],
    robe: ['#6446a4', '#a23c46', '#3666a4', '#382a48', '#b08e36'],
    eye: ['#ffe060', '#9fffd0', '#ffb0ff', '#ff5050', '#ffffff'],
    wood: ['#9a5e30', '#8a3a3a', '#3a5a7a', '#4a3a5a', '#a88a40'],
  };
  const ramp = (kind, tier, n, sp) => R(kind + tier, TIER[kind][tier % 5], n, sp);
  R('ironR', '#8a93a0', 7, .6); R('goldR', '#d4a93c', 7, .6); R('leatherR', '#6a4428', 6, .5); R('clothR', '#8a2a2a', 6, .5);
  R('woodR', '#9a6436', 7, .55); R('darkIn', '#1a1020', 4, .2); R('rockStone', '#7a7470', 5, .5); R('gemR', '#e0303a', 5, .5); R('teeth', '#f2eee0', 5, .4); R('tongue', '#d04860', 5, .45);

  // 描いて輪郭まで仕上げ、左右反転・白抜きを付ける
  // 図形の拡大率：勇者（提供ドット絵・約30単位）と釣り合うよう通常の敵は1.8倍、ボスは3.4倍の大きさで細かく描く
  G.ESC = 1.8; G.ESC_BOSS = 3.4;
  let KC = G.ESC;
  function sprite(wu, hu, draw, o) {
    const b = new G.P3Buf(wu * KC, hu * KC, wu * KC / 2 * RES, (hu - 1.5) * KC * RES, KC);
    draw(b);
    return G.wrapSprite(G.P3finish(b, o));
  }
  const D = (b, s, mat, z, ex) => G.P3(b, s, mat, z, ex);
  const eyeDot = (b, x, y, rx, ry, c, z) => { D(b, E(x, y, rx, ry), null, z, { color: () => col(c) }); D(b, E(x + rx * .3, y - ry * .35, rx * .35, ry * .3), null, z + .1, { color: () => col('#ffffff') }); };

  // ---------------------------------------------------------- 各種の敵
  // 1コマ＝ポーズの数値（足・手・体の上下・口・目など）。同じ部品をポーズごとに描き直してドットの差分を作る。
  // 可愛い丸みは残しつつ、怒り眉・牙・角・光る目でモンスターらしく
  const TAU = Math.PI * 2, sn = Math.sin, cs = Math.cos;
  const flat = c => ({ color: () => col(c) });
  R('hairG', '#3a2a3a', 6, .45); R('rag', '#4a4058', 6, .45); R('moss', '#5f9a3a', 6, .5); R('mleg', '#5a3444', 6, .45); R('claw', '#e8dcc0', 5, .4);
  // 大きな目：縁・色の瞳・瞳孔・光（closed で閉じた目）
  function bigEye(b, x, y, rx, ry, iris, z, o) {
    o = o || {};
    if (o.closed) { D(b, C(x - rx * .9, y + ry * .15, x + rx * .9, y + ry * .15, .13), null, z, flat('#1a0e12')); return; }
    D(b, E(x, y, rx, ry), null, z, flat('#1a0e12'));
    D(b, E(x + rx * .08, y + ry * .1, rx * .74, ry * .78), null, z + .05, flat(iris));
    D(b, E(x + rx * .2, y + ry * .12, rx * (o.slit ? .16 : .4), ry * (o.slit ? .62 : .5)), null, z + .1, flat('#120a0c'));
    D(b, E(x - rx * .28, y - ry * .36, rx * .3, ry * .24), null, z + .15, flat('#ffffff'));
    if (o.glow) D(b, E(x, y, rx * 1.6, ry * 1.5), null, z - .05, { color: () => col(iris), blend: .35 });
  }
  const brow = (b, x0, y0, x1, y1, z, c) => D(b, C(x0, y0, x1, y1, .16, .11), null, z, flat(c || '#1a0e12'));
  const fang = (b, x, y, w, l, z, up) => D(b, PL(up ? [[x - w, y], [x + w, y], [x + w * .2, y - l]] : [[x - w, y], [x + w, y], [x + w * .2, y + l]], .12), 'teeth', z, { lv: 3.6 });
  const blush = (b, x, y, z) => D(b, E(x, y, .42, .22), null, z, { color: () => col('#ff7a90'), blend: .45 });

  function slime(t, p) {
    const m = ramp('slime', t, 8, .6), sq = -p.sq, ln = p.lean || 0; // p.sq>0 で縦に伸び、<0 でつぶれる
    return [12, 10.5, b => {
      const rx = 3.7 * (1 + sq * .22), ry = 3.0 * (1 - sq * .25), cy = -ry * .95;
      // しずく形の体（頭のとんがりが揺れる）。底は床に接して平ら
      const body = U(E(ln * .35, cy, rx, ry), C(ln * .5, cy - ry * .4, ln * 1.6 - .2, cy - ry - 1.15 * (1 - sq * .35), 1.2, .2));
      D(b, { bb: body.bb, inside: (u, v) => body.inside(u, v) && v <= .05, h: body.h }, m, 1, { spec: .8, shin: 16, bulge: 1.5, amb: .1, dith: .3, shade: (s, u, v) => s * .8 - (v > -.6 ? .2 : 0) });
      // 中の泡
      D(b, E(-1.5 * (1 + sq * .2) + ln * .3, cy + ry * .35, .5, .5), m, 1.2, { lv: 6.4 });
      D(b, E(-.6 + ln * .3, cy + ry * .64, .3, .3), m, 1.2, { lv: 5.6 });
      // 顔：大きな目・怒り眉・牙の見える口・ほっぺ
      const fx = 1 + ln * .55, ey = cy - ry * .02;
      bigEye(b, fx - .25, ey, .5, .74, '#3a2438', 2, { closed: p.blink });
      bigEye(b, fx + 1.3, ey, .46, .7, '#3a2438', 2, { closed: p.blink });
      brow(b, fx - .8, ey - 1.1, fx + .15, ey - .78, 2.2); brow(b, fx + .95, ey - .8, fx + 1.8, ey - 1.08, 2.2);
      blush(b, fx - .75, ey + .75, 2.1); blush(b, fx + 1.85, ey + .72, 2.1);
      const my = ey + .95, mo = p.mouth || 0;
      if (mo > .15) {
        D(b, E(fx + .55, my + mo * .28, .42 + mo * .38, .14 + mo * .5), null, 2.3, flat('#3a0f1a'));
        D(b, E(fx + .55, my + mo * .62, .28 + mo * .22, .1 + mo * .16), 'tongue', 2.4, { lv: 3 });
        fang(b, fx + .08, my - .06, .16, .32 + mo * .18, 2.5); fang(b, fx + 1.02, my - .06, .16, .32 + mo * .18, 2.5);
      } else { D(b, C(fx + .05, my, fx + 1.05, my, .1), null, 2.3, flat('#3a0f1a')); fang(b, fx + .85, my + .05, .15, .38, 2.5); }
    }];
  }
  function goblin(t, p) {
    const sk = ramp('goblin', t, 7, .55), bob = p.bob || 0, ln = p.lean || 0, hd = p.hd || 0;
    return [12.5, 12, b => {
      const hip = -2.1 + bob;
      const leg = (hx, ax, ay, z) => {
        D(b, C(hx, hip, ax, ay - .35, .5, .42), sk, z, { bulge: 1 });
        D(b, E(ax + .35, ay - .32, .85, .45), sk, z + .1, { bulge: 1.2 });
        D(b, C(ax + .95, ay - .2, ax + 1.3, ay - .08, .1), 'claw', z + .15, { lv: 3 });
      };
      leg(-.6, -.7 + p.bx, p.by, 1);
      // 後ろの腕
      D(b, C(-1.5 + ln, -4.3 + bob, -2.1 + p.armB, -2.4 + bob, .45, .4), sk, 1.5, { bulge: 1 });
      D(b, E(-2.1 + p.armB, -2.2 + bob, .5, .5), sk, 1.6, { bulge: 1.2 });
      // 胴：緑のお腹・ぼろ布の腰巻き・たすき・牙の首飾り
      D(b, E(.3 + ln * .5, -3.3 + bob, 1.9, 1.75), sk, 2, { bulge: 1.4 });
      D(b, PL([[-1.8, -2.3 + bob], [2.1, -2.3 + bob], [1.7, -.9 + bob], [.9, -1.3 + bob], [.4, -.5 + bob], [-.3, -1.2 + bob], [-1.1, -.6 + bob], [-1.7, -1.1 + bob]], .4), 'leatherR', 2.3, { bulge: 1.2 });
      D(b, C(-1.8, -2.2 + bob, 2.1, -2.2 + bob, .22), 'leatherR', 2.35, { lv: 1.5 });
      D(b, C(-1.1 + ln * .5, -4.7 + bob, 1.9 + ln * .5, -2.4 + bob, .2), 'leatherR', 2.4, {});
      for (let i = 0; i < 3; i++) D(b, PL([[-.1 + i * .55 + ln * .5, -4.55 + bob], [.25 + i * .55 + ln * .5, -4.55 + bob], [.08 + i * .55 + ln * .5, -4.0 + bob]], .1), 'claw', 2.45, { lv: 3.2 });
      leg(.8, .9 + p.fx, p.fy, 2.6);
      // 頭：大きめの丸い頭・長いとがり耳（歩くとぱたぱた）・とさか髪・小さな角
      const hx = .5 + ln, hy = -6.9 + bob + hd;
      D(b, C(hx - 1.6, hy - .2, hx - 4.6, hy - 1.3 + p.ear * .9, .8, .12), sk, 2.9, { bulge: 1.3 });
      D(b, C(hx - 1.9, hy - .2, hx - 3.9, hy - .95 + p.ear * .8, .35, .08), 'tongue', 2.95, { lv: 1.5 });
      D(b, E(hx, hy, 2.55, 2.3), sk, 3, { bulge: 1.3, spec: .2 });
      D(b, C(hx + 1.9, hy - .3, hx + 4.9, hy - 1.2 + p.ear * .9, .75, .12), sk, 3.05, { bulge: 1.3 });
      for (let i = 0; i < 3; i++) D(b, PL([[hx - 1.5 + i * 1.05, hy - 1.9], [hx - .6 + i * 1.05, hy - 2.1], [hx - 1.3 + i * 1.05 - .5 + p.ear * .3, hy - 3.3 + (i === 1 ? -.4 : 0)]], .25), 'hairG', 3.1, { bulge: 1.2 });
      D(b, C(hx + .6, hy - 1.95, hx + 1.2, hy - 2.9, .28, .06), 'claw', 3.2, { spec: .4 });
      // 目（黄色・縦長の瞳）・怒り眉・大きな鼻・下あごの牙
      bigEye(b, hx - .45, hy - .1, .6, .66, '#ffd23a', 3.5, { slit: true, closed: p.blink });
      bigEye(b, hx + 1.3, hy - .1, .56, .62, '#ffd23a', 3.5, { slit: true, closed: p.blink });
      brow(b, hx - 1.15, hy - 1.05, hx - .05, hy - .72, 3.7, '#2a3a1a'); brow(b, hx + .85, hy - .75, hx + 1.9, hy - 1.05, 3.7, '#2a3a1a');
      D(b, E(hx + .55, hy + .7, .5, .38), sk, 3.8, { bulge: 1.2 });
      const mo = p.mouth || 0, my = hy + 1.45;
      D(b, E(hx + .5, my + mo * .2, .95 + mo * .2, .12 + mo * .38), null, 3.85, flat('#3a1a14'));
      if (mo > .3) D(b, E(hx + .5, my + mo * .45, .5, .12 + mo * .12), 'tongue', 3.9, { lv: 3 });
      fang(b, hx - .25, my + .15 + mo * .35, .17, .5, 3.95, true); fang(b, hx + 1.25, my + .15 + mo * .35, .17, .5, 3.95, true);
      // 前の腕（棍棒は別に描く）
      const az = p.hand.v < -5.5 ? 2.85 : 4; // 振りかぶった腕は頭の後ろ
      D(b, C(1.9 + ln * .5, -4.3 + bob, p.hand.u, p.hand.v, .45, .42), sk, az, { bulge: 1 });
      D(b, E(p.hand.u, p.hand.v, .55, .55), sk, az + .1, { bulge: 1.2 });
    }];
  }
  function skeleton(t, p) {
    const bn = ramp('bone', t, 7, .5), bob = p.bob || 0, ln = p.lean || 0, eyeC = TIER.eye[(t + 3) % 5];
    return [12, 12.5, b => {
      const hip = -2.7 + bob;
      const leg = (hx, ax, ay, z) => { D(b, C(hx, hip, ax, ay - .25, .32), bn, z, { bulge: 1 }); D(b, E(ax + .3, ay - .15, .65, .3), bn, z + .1, {}); };
      leg(-.5, -.7 + p.bx, p.by, 1);
      // 引く方の腕（肩→手）
      D(b, C(-1.2 + ln, -5.6 + bob, p.hb.u, p.hb.v, .25), bn, 1.6, {});
      D(b, E(.1, hip, 1.3, .6), bn, 2, { bulge: 1.3 });
      D(b, C(.1 + ln * .5, -6.2 + bob, .1, hip, .3), bn, 2.1, {});
      for (let i = 0; i < 3; i++) D(b, C(-1.3 + i * .15 + ln * .6, -5.7 + i * .7 + bob, 1.5 - i * .15 + ln * .6, -5.7 + i * .7 + bob, .26), bn, 2.2 + i * .01, { bulge: 1.2 });
      // ぼろぼろのマフラー
      D(b, PL([[-1.5 + ln, -6.6 + bob], [1.7 + ln, -6.6 + bob], [1.3 + ln, -5.9 + bob], [-1.4 + ln, -5.9 + bob]], .3), 'rag', 2.5, { bulge: 1.2 });
      D(b, PL([[-1.3 + ln, -6.3 + bob], [-.6 + ln, -6.2 + bob], [-1.4 + p.scarf, -4.4 + bob], [-1.9 + p.scarf, -4.9 + bob], [-2.3 + p.scarf, -4.3 + bob]], .3), 'rag', 1.8, { bulge: 1 });
      leg(.7, .8 + p.fx, p.fy, 2.6);
      // 大きな頭蓋骨・ひび・光る目・カタカタ動く下あご
      const hx = .3 + ln, hy = -8.5 + bob;
      D(b, E(hx, hy, 2.2, 2.0), bn, 4, { bulge: 1.5, spec: .2 });
      D(b, C(hx - 1.4, hy - 1.3, hx - .8, hy - .4, .07), null, 4.05, flat('#8a8070'));
      const jw = p.jaw || 0;
      D(b, RC(hx - .8, hy + 1.1 + jw, hx + 1.7, hy + 2.0 + jw, .35, .3), bn, 4.1, { bulge: 1 });
      for (let i = 0; i < 4; i++) D(b, C(hx - .45 + i * .6, hy + 1.2 + jw, hx - .45 + i * .6, hy + 1.55 + jw, .08), null, 4.2, flat('#5a5048'));
      D(b, E(hx - .5, hy, .62, .7), null, 4.2, flat('#1a1016')); D(b, E(hx + 1.05, hy, .6, .68), null, 4.2, flat('#1a1016'));
      for (const ex of [hx - .45, hx + 1.1]) { D(b, E(ex, hy + .05, .5, .5), null, 4.25, { color: () => col(eyeC), blend: .35 * (p.glow || 1) }); D(b, E(ex, hy + .05, .2, .24), null, 4.3, flat(eyeC)); }
      D(b, PL([[hx + .25, hy + .6], [hx + .45, hy + 1.0], [hx + .05, hy + 1.0]], .1), null, 4.2, flat('#2a2024'));
      // 矢（引いている間）と弓を持つ前の腕
      if (p.arrow) { D(b, C(p.hb.u, p.hb.v, p.hand.u + .9, p.hand.v, .09), 'woodR', 4.4, { lv: 3 }); D(b, PL([[p.hand.u + .8, p.hand.v - .3], [p.hand.u + 1.5, p.hand.v], [p.hand.u + .8, p.hand.v + .3]], .1), 'ironR', 4.45, { lv: 5 }); D(b, PL([[p.hb.u - .1, p.hb.v], [p.hb.u + .5, p.hb.v - .35], [p.hb.u + .5, p.hb.v + .35]], .1), null, 4.45, flat('#e05050')); }
      D(b, C(1.4 + ln, -5.6 + bob, p.hand.u, p.hand.v, .25), bn, 4.5, {});
    }];
  }
  function golem(t, p) {
    const rk = ramp('rock', t, 8, .55), cr = ramp('core', t, 5, .35), bob = p.bob || 0, sw = p.sway || 0;
    return [16, 15.5, b => {
      const rock = (s, z) => D(b, s, rk, z, { bulge: 2, shade: (x, u, v) => x + (G.P3noise(u * 1.4, v * 1.4) - .5) * .35 });
      rock(PL([[-2.8 + p.bx, -3 + bob * .5], [-.5 + p.bx, -3 + bob * .5], [-.4 + p.bx, .2 + p.by], [-3 + p.bx, .2 + p.by]], .6), 1);
      // 後ろの腕
      const sh = -7.4 + bob;
      rock(C(-3.8 + sw, sh, p.hl.u, p.hl.v, 1.05, .95), 1.5);
      rock(E(p.hl.u, p.hl.v, 1.35, 1.2), 1.6);
      // 胴：丸い岩の体・苔・光る核（ひびから光が漏れる）
      rock(PL([[-3.7 + sw, -8.4 + bob], [3.9 + sw, -8.7 + bob], [4.4 + sw * .5, -3.4 + bob], [2.9, -2.1 + bob], [-2.9, -2.1 + bob], [-4.2 + sw * .5, -3.7 + bob]], 1.1), 2);
      rock(PL([[.5 + p.fx, -3 + bob * .5], [2.8 + p.fx, -3 + bob * .5], [3 + p.fx, .2 + p.fy], [.4 + p.fx, .2 + p.fy]], .6), 2.2);
      const gl = p.core == null ? .6 : p.core;
      D(b, E(.2 + sw * .7, -5.4 + bob, 1.1, 1.2), cr, 3.5, { spec: 1, amb: .4 + gl * .5, bulge: 1.2 });
      D(b, E(.2 + sw * .7, -5.4 + bob, 2.1, 2.1), null, 3.4, { color: () => col(TIER.core[t % 5]), blend: .12 + gl * .3 });
      for (const [a, l] of [[.6, 2.2], [2.4, 1.8], [4.1, 2]]) D(b, C(.2 + sw * .7 + cs(a) * 1.1, -5.4 + bob + sn(a) * 1.1, .2 + sw * .7 + cs(a) * l, -5.4 + bob + sn(a) * l, .1, .05), cr, 3.45, { lv: 3 + gl });
      // 頭：苔の帽子・光る目（細い）
      rock(PL([[-2 + sw * 1.2, -10.9 + bob], [2.2 + sw * 1.2, -11.1 + bob], [2.5 + sw * 1.2, -8.2 + bob], [-2.2 + sw * 1.2, -8 + bob]], .7), 2.6);
      D(b, PL([[-2.3 + sw * 1.2, -10.6 + bob], [2.5 + sw * 1.2, -10.9 + bob], [2.2 + sw * 1.2, -11.7 + bob], [.6 + sw * 1.2, -12.1 + bob], [-1.4 + sw * 1.2, -11.8 + bob]], .5), 'moss', 2.7, { bulge: 1.4, dith: .4 });
      const ey = -9.6 + bob;
      for (const ex of [-.9, 1]) { D(b, C(ex - .45 + sw * 1.2, ey, ex + .45 + sw * 1.2, ey + (ex < 0 ? .25 : -.25) * (p.angry ? 1 : .3), .24), cr, 3.6, { lv: 3.5 + gl }); D(b, E(ex + sw * 1.2, ey, .9, .55), null, 3.55, { color: () => col(TIER.core[t % 5]), blend: .25 }); }
      // 肩の結晶
      D(b, PL([[3 + sw, -8.4 + bob], [3.9 + sw, -8.2 + bob], [4.4 + sw, -10.4 + bob]], .2), cr, 2.8, { spec: 1, amb: .6 });
      D(b, PL([[-3.4 + sw, -8.2 + bob], [-2.6 + sw, -8.3 + bob], [-3.6 + sw, -9.8 + bob]], .2), cr, 1.9, { spec: 1, amb: .6 });
      // 前の腕
      rock(C(3.9 + sw, sh, p.hr.u, p.hr.v, 1.05, .95), 3.8);
      rock(E(p.hr.u, p.hr.v, 1.4, 1.25), 3.9);
    }];
  }
  function bat(t, p) {
    const m = ramp('bat', t, 7, .5), dy = p.dy || 0, f = p.f;
    return [14, 11.5, b => {
      for (const s of [-1, 1]) {
        const sh = [s * .9, -5.4 + dy], tip = [s * (4.3 + (1 - Math.abs(f)) * 1.3 - (p.fold || 0) * 1.8), -5.4 - f * 3.4 + dy + (p.fold || 0) * 1.2];
        const el = [s * (2.4 - (p.fold || 0) * .6), -5.6 - f * 1.9 + dy], base = [s * 1.25, -3.7 + dy];
        const lp = (a, bb, k, up) => [a[0] + (bb[0] - a[0]) * k, a[1] + (bb[1] - a[1]) * k - up];
        const w = [sh, el, tip, lp(tip, base, .22, -1.0), lp(tip, base, .42, -.15), lp(tip, base, .6, -1.25), lp(tip, base, .78, -.35), lp(tip, base, .9, -1.0), base];
        D(b, PL(w, .45), m, s < 0 ? 1 : 2, { bulge: 1.2, shade: x => x - .08, dith: .3 });
        D(b, C(sh[0], sh[1], el[0], el[1], .17), m, 2.1, { lv: 1.2 }); D(b, C(el[0], el[1], tip[0], tip[1], .13), m, 2.1, { lv: 1.2 });
        D(b, C(el[0], el[1], w[4][0], w[4][1], .08), m, 2.1, { lv: 1 });
        D(b, PL([[tip[0], tip[1]], [tip[0] + s * .45, tip[1] - .5], [tip[0] - s * .05, tip[1] - .25]], .08), 'claw', 2.2, { lv: 3 });
      }
      // ふわふわの丸い体・大きな耳・赤い目・牙
      D(b, E(0, -5 + dy, 1.85, 1.65), m, 3, { bulge: 1.5, spec: .15 });
      D(b, E(0, -4.4 + dy, 1.05, .8), m, 3.05, { lv: 5 - (p.mouth || 0), dith: .6 });
      D(b, PL([[-1.3, -5.8 + dy], [-1.2 - p.ear * .3, -7.9 + dy], [-.25, -6.3 + dy]], .3), m, 3, { bulge: 1.2 }); D(b, PL([[.25, -6.3 + dy], [1.2 + p.ear * .3, -7.9 + dy], [1.3, -5.8 + dy]], .3), m, 3, { bulge: 1.2 });
      D(b, PL([[-1.1, -6.1 + dy], [-1.1 - p.ear * .25, -7.3 + dy], [-.55, -6.3 + dy]], .2), 'tongue', 3.02, { lv: 1.5 }); D(b, PL([[.55, -6.3 + dy], [1.1 + p.ear * .25, -7.3 + dy], [1.1, -6.1 + dy]], .2), 'tongue', 3.02, { lv: 1.5 });
      bigEye(b, -.62, -5.35 + dy, .42, .46, '#ff3a3a', 3.5, { glow: true }); bigEye(b, .62, -5.35 + dy, .42, .46, '#ff3a3a', 3.5, { glow: true });
      brow(b, -1.15, -6.05 + dy, -.3, -5.8 + dy, 3.7); brow(b, .3, -5.8 + dy, 1.15, -6.05 + dy, 3.7);
      const mo = p.mouth || 0;
      if (mo > .2) D(b, E(0, -4.3 + dy + mo * .15, .5, .12 + mo * .3), null, 3.6, flat('#3a0f1a'));
      fang(b, -.28, -4.4 + dy, .12, .38 + mo * .12, 3.7); fang(b, .3, -4.4 + dy, .12, .38 + mo * .12, 3.7);
      for (const s of [-1, 1]) D(b, C(s * .45, -3.6 + dy, s * .55, -3.0 + dy + (p.fold ? -.3 : 0), .12), 'claw', 2.9, { lv: 2.5 });
    }];
  }
  function mage(t, p) {
    const m = ramp('robe', t, 7, .5), eye = TIER.eye[t % 5], bob = p.bob || 0, ph = p.ph || 0, ln = p.lean || 0;
    return [12, 13.5, b => {
      // すそがぼろぼろにたなびく、足のないローブ
      const hem = []; for (let k = 0; k <= 6; k++) hem.push([-2.8 + k * .97 + sn(ph + k * .9) * .25, (k % 2 ? -.9 : -.05) + sn(ph * 1 + k * 1.3) * .35 + bob * .3]);
      D(b, PL([[-1.6 + ln, -5.2 + bob], [1.9 + ln, -5.2 + bob], [2.9 + sn(ph) * .2, -.8 + bob * .5], ...hem.reverse(), [-2.8 + sn(ph + 2) * .2, -.8 + bob * .5]], .9), m, 1, { bulge: 1.6, h: (u, v) => .5 + .35 * Math.sin(u * 2.2) + .15, dith: .3 });
      D(b, C(-1.9 + ln, -4.7 + bob, -2.3 + sn(ph) * .2, -2.8 + bob, .6, .7), m, 1.5, { bulge: 1.3 }); // 後ろの袖
      D(b, E(.2 + ln, -4.8 + bob, 2.2, 1.4), m, 2, { bulge: 1.3 });
      // フード：垂れたとんがり・小さな角
      const hx = .3 + ln, hy = -7.2 + bob;
      D(b, C(hx - .6, hy - 1.4, hx - 2.7 + sn(ph) * .35, hy - 2.1 + cs(ph) * .2, .95, .2), m, 2.9, { bulge: 1.3 });
      D(b, C(hx - .5, hy - 1.7, hx - 1.2, hy - 3.1, .26, .07), 'claw', 2.95, { spec: .4 }); D(b, C(hx + 1.3, hy - 1.8, hx + 1.9, hy - 3.2, .26, .07), 'claw', 3.2, { spec: .4 });
      D(b, E(hx, hy, 2.15, 2.05), m, 3, { bulge: 1.5 });
      // 暗い顔の中に光る目とにやりと笑う口
      D(b, E(hx + .55, hy + .3, 1.35, 1.15), 'darkIn', 3.5, { lv: .5 });
      const gl = p.glow || 0;
      for (const ex of [hx + .05, hx + 1.05]) { D(b, E(ex, hy + .1, .45 + gl * .2, .4 + gl * .2), null, 3.55, { color: () => col(eye), blend: .3 + gl * .3 }); D(b, E(ex, hy + .1, .2, .17), null, 3.6, flat(p.blink ? '#3a2a40' : eye)); }
      for (let i = 0; i < 4; i++) D(b, C(hx + .05 + i * .33, hy + .85 + (i % 2) * .15, hx + .25 + i * .33, hy + .85 + ((i + 1) % 2) * .15, .06), null, 3.6, { color: () => col(eye), blend: .7 });
      D(b, E(.3 + ln, -4.6 + bob, .45, .45), 'goldR', 3.2, { spec: .8 });
      // 前の腕（杖は別に描く）：袖と骨ばった手。詠唱中は手が光る
      D(b, C(1.6 + ln, -5 + bob, p.hand.u - .2, p.hand.v, .6, .75), m, 3.3, { bulge: 1.3 });
      D(b, E(p.hand.u, p.hand.v, .38, .38), 'bone0', 3.4, { bulge: 1.2 });
      if (gl > .2) D(b, E(p.hand.u + .3, p.hand.v - .4, .9 * gl + .3, .9 * gl + .3), null, 3.45, { color: () => col(eye), blend: .25 + gl * .3 });
    }];
  }
  function mimic(t, p) {
    const wd = ramp('wood', t, 7, .55), op = p.open || 0, lh = p.legs ? .9 : 0, bob = (p.bob || 0) - lh, sx = p.shift || 0;
    return [13, 12, b => {
      // 小さな虫のような脚（歩く時だけ出す）
      if (p.legs) for (let k = 0; k < 4; k++) {
        const x = -2.7 + k * 1.8, ph = p.legPh + (k % 2) * Math.PI, dx = sn(ph) * .5, lf = Math.max(0, cs(ph)) * .4;
        D(b, C(x + sx, bob + .1, x + dx + sx + .3, -.15 - lf, .3, .2), 'mleg', k % 2 ? 1 : .5, { bulge: 1 });
        D(b, C(x + dx + sx + .3, -.15 - lf, x + dx + sx + .7, -lf, .12), 'claw', k % 2 ? 1.1 : .6, { lv: 3 });
      }
      // 箱の本体・フタ（口）・金具
      const top = -3.2 + bob, my0 = top - .4 - op * 1.7;
      D(b, RC(-3.8 + sx, top, 3.8 + sx, bob, .4, .5), wd, 1, { bulge: 1.4, shade: (s, u) => s - ((Math.floor((u + 4) * 1.2) % 2) ? .06 : 0) });
      D(b, RC(-3.4 + sx, my0 + .2, 3.4 + sx, top + .5, .2, .1), 'darkIn', .8, { lv: .3 });
      if (p.tongue > 0) { const tl = p.tongue; D(b, C(.5 + sx, top - .1, 1.2 + sx + tl * 3.2, top + .9 + tl * .8, .6, .38), 'tongue', 3.4, { bulge: 1.2, spec: .5 }); }
      else D(b, E(.3 + sx, top - .1 - op * .5, 1.4, .4 + op * .3), 'tongue', .9, { bulge: 1.2 });
      D(b, RC(-3.9 + sx, my0 - 2.7, 3.9 + sx, my0, .8, .6), wd, 2, { bulge: 1.4 });
      for (const y of [bob - .9, top - .2]) D(b, RC(-3.9 + sx, y - .35, 3.9 + sx, y + .35, .15, .2), 'goldR', 1.5, { spec: .5 });
      D(b, RC(-3.9 + sx, my0 - .85, 3.9 + sx, my0 - .35, .15, .2), 'goldR', 2.5, { spec: .5 });
      for (let i = 0; i < 7; i++) {
        const x = -3 + i + sx;
        fang(b, x, my0 - .05, .34, .75 + (i % 2) * .25, 3.5);
        if (op > .2) fang(b, x, top + .15, .34, .6 + ((i + 1) % 2) * .2, 3.5, true);
      }
      // フタの上の目：普段は細目、怒ると大きく見開く
      const ey = my0 - 1.2;
      bigEye(b, -1.5 + sx, ey - .55, .5, p.eyes > .5 ? .55 : .5, '#ff3030', 4, { closed: p.eyes < .5, slit: true, glow: p.eyes > .5 });
      bigEye(b, 1.7 + sx, ey - .55, .5, p.eyes > .5 ? .55 : .5, '#ff3030', 4, { closed: p.eyes < .5, slit: true, glow: p.eyes > .5 });
      brow(b, -2.2 + sx, ey - 1.35, -1.0 + sx, ey - 1.0, 4.2, '#2a1408'); brow(b, 1.2 + sx, ey - 1.0, 2.4 + sx, ey - 1.35, 4.2, '#2a1408');
    }];
  }

  // ---------------------------------------------------------- ポーズ表（コマの一覧と、状態ごとの並び）
  // seq: idle=待機 walk=移動 wind=攻撃の溜め strike=攻撃。meta: コマごとの手の位置（武器を持たせる）・上下の浮き
  function slimePoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p, m) => { seq[k].push(F.length); F.push(p); meta.push(m || {}); };
    for (let i = 0; i < 8; i++) { const q = i / 8 * TAU; add('idle', { sq: sn(q) * .12, lean: sn(q + 1) * .25, blink: i === 5 }); }
    // 跳ねて進む：溜め→飛び出し（伸びる）→空中→着地でつぶれる
    const hs = [-.55, -.25, .55, .75, .45, .1, -.3, -.65], hl = [0, .3, .7, .6, .3, -.2, -.4, -.2], ho = [0, -.4, -2.6, -3.9, -3.5, -1.6, 0, 0], hm = [0, 0, .35, .35, .2, 0, 0, 0];
    for (let i = 0; i < 8; i++) add('walk', { sq: hs[i], lean: hl[i], mouth: hm[i] }, { oy: ho[i] });
    [[-.3, -.3, .3], [-.5, -.5, .5], [-.65, -.6, .8], [-.72, -.6, 1]].forEach(([sq, lean, mouth]) => add('wind', { sq, lean, mouth }));
    [[.8, 1, 1], [.6, .8, 1], [.3, .4, .6], [0, .1, .2]].forEach(([sq, lean, mouth]) => add('strike', { sq, lean, mouth }));
    return { F, seq, meta, walkBy: 'hop' };
  }
  function goblinPoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p, a) => { seq[k].push(F.length); F.push(p); meta.push({ hand: { u: p.hand.u, v: p.hand.v, a, back: p.hand.v < -5.5 } }); };
    for (let i = 0; i < 6; i++) { const q = i / 6 * TAU, bob = sn(q) * .12; add('idle', { fx: 0, fy: 0, bx: 0, by: 0, bob, armB: 0, ear: i === 3 ? -.7 : sn(q) * .15, blink: i === 4, hand: { u: 2.9, v: -2.6 + bob } }, .35 + sn(q) * .05); }
    for (let i = 0; i < 8; i++) {
      const q = i / 8 * TAU, s = sn(q), c = cs(q), bob = -.4 * (1 - Math.abs(s));
      add('walk', { fx: s * 1.1, fy: -Math.max(0, c) * .75, bx: -s * 1.1, by: -Math.max(0, -c) * .75, bob, lean: .15, hd: -bob * .4, armB: s * .6, ear: sn(2 * q + 1) * .55, hand: { u: 2.9 - s * .45, v: -2.6 + bob } }, .35 - s * .25);
    }
    for (let k = 0; k < 4; k++) { const s = k / 3; add('wind', { fx: .3 * s, fy: 0, bx: -.3 * s, by: 0, bob: .15 * s, lean: -.45 * s, armB: .3 * s, ear: -.4 * s, mouth: s * .8, hand: { u: 2.9 - 2.6 * s, v: -2.6 - 5.6 * s } }, .35 - 2.2 * s); }
    [[4.4, -4.9, .9, .6, 1.2, 1], [4.7, -2.5, 1.9, .7, 1.3, .9], [4.1, -1.9, 2.1, .45, 1.1, .5]].forEach(([u, v, a, lean, fx, mouth]) => add('strike', { fx, fy: 0, bx: -.4, by: 0, bob: .25, lean, armB: -.4, ear: .5, mouth, hand: { u, v } }, a));
    return { F, seq, meta, walkBy: 'dist', stride: 15 };
  }
  function skeletonPoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p) => { seq[k].push(F.length); F.push(p); meta.push({ hand: { u: p.hand.u, v: p.hand.v, a: p.ba || 0 } }); };
    for (let i = 0; i < 6; i++) { const q = i / 6 * TAU, bob = sn(q) * .1; add('idle', { fx: 0, fy: 0, bx: 0, by: 0, bob, jaw: i === 2 || i === 3 ? .35 : 0, scarf: sn(q) * .2, ba: .55, hand: { u: 2.4, v: -3.0 + bob }, hb: { u: -1.9, v: -3.4 + bob } }); }
    for (let i = 0; i < 8; i++) {
      const q = i / 8 * TAU, s = sn(q), c = cs(q), bob = -.35 * (1 - Math.abs(s));
      add('walk', { fx: s * 1, fy: -Math.max(0, c) * .6, bx: -s * 1, by: -Math.max(0, -c) * .6, bob, lean: .1, jaw: i % 2 ? .3 : 0, scarf: -.4 - Math.abs(s) * .3, ba: .55 + s * .1, hand: { u: 2.4 - s * .3, v: -3.0 + bob }, hb: { u: -1.9 + s * .5, v: -3.4 + bob } });
    }
    for (let k = 0; k < 4; k++) { const s = k / 3; add('wind', { fx: .4, fy: 0, bx: -.4, by: 0, bob: .1, lean: -.2 * s, jaw: 0, scarf: -.2, glow: 1 + s, arrow: true, hand: { u: 3.6, v: -5.6 }, hb: { u: 2.8 - 2.2 * s, v: -5.6 } }); }
    [[.3, -.3], [.15, -.15]].forEach(([jaw, lean]) => add('strike', { fx: .4, fy: 0, bx: -.4, by: 0, bob: .1, lean, jaw, scarf: -.6, hand: { u: 3.5, v: -5.5 }, hb: { u: -.6, v: -5.2 } }));
    return { F, seq, meta, walkBy: 'dist', stride: 13 };
  }
  function golemPoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p) => { seq[k].push(F.length); F.push(p); meta.push({}); };
    for (let i = 0; i < 6; i++) { const q = i / 6 * TAU, bob = sn(q) * .12; add('idle', { fx: 0, fy: 0, bx: 0, by: 0, bob, sway: 0, core: .5 + .5 * sn(q), hl: { u: -5.1, v: -3.2 + bob }, hr: { u: 5.3, v: -3.2 + bob } }); }
    for (let i = 0; i < 8; i++) {
      const q = i / 8 * TAU, s = sn(q), c = cs(q), bob = .45 * Math.abs(s) - .2;
      add('walk', { fx: s * .9, fy: -Math.max(0, c) * 1, bx: -s * .9, by: -Math.max(0, -c) * 1, bob, sway: s * .4, core: .6, hl: { u: -5 + s * .7, v: -3.2 + bob }, hr: { u: 5.2 - s * .7, v: -3.2 + bob } });
    }
    for (let k = 0; k < 4; k++) { const s = k / 3; add('wind', { fx: 0, fy: 0, bx: 0, by: 0, bob: -.4 * s, sway: -.3 * s, core: .6 + .4 * s, angry: true, hl: { u: -5.1 + 2.1 * s, v: -3.2 - 8.6 * s }, hr: { u: 5.3 - 1.8 * s, v: -3.2 - 9 * s } }); }
    [[[-1, -8], [4, -8.5], -.2], [[2.5, -1.4], [6, -1.2], .9], [[3, -1.2], [6.4, -1], .7]].forEach(([hl, hr, bob]) => add('strike', { fx: .6, fy: 0, bx: -.4, by: 0, bob, sway: .5, core: 1, angry: true, hl: { u: hl[0], v: hl[1] }, hr: { u: hr[0], v: hr[1] } }));
    return { F, seq, meta, walkBy: 'dist', stride: 16 };
  }
  function batPoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p) => { seq[k].push(F.length); F.push(p); meta.push({}); };
    for (let i = 0; i < 8; i++) { const f = cs(i / 8 * TAU); add('idle', { f, dy: f * .5, ear: -f * .3 }); }
    seq.walk = seq.idle;
    [[1, .5, .4], [1, .6, .7], [.85, .6, 1]].forEach(([f, dy, mouth]) => add('wind', { f, dy, mouth, ear: .5 }));
    [[-.4, -.3, 1, .8], [-.7, -.4, 1, 1], [-.2, 0, .6, .4]].forEach(([f, dy, mouth, fold]) => add('strike', { f, dy, mouth, fold, ear: -.6 }));
    return { F, seq, meta, walkBy: 'time', fps: 20 };
  }
  function magePoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p) => { seq[k].push(F.length); F.push(p); meta.push({ hand: { u: p.hand.u, v: p.hand.v, a: p.sa || .15, back: p.hand.v < -6.5 } }); };
    for (let i = 0; i < 8; i++) { const ph = i / 8 * TAU, bob = sn(ph) * .3; add('idle', { ph, bob, blink: i === 6, hand: { u: 2.6, v: -3.6 + bob } }); }
    seq.walk = seq.idle;
    for (let k = 0; k < 4; k++) { const s = k / 3; add('wind', { ph: k * .8, bob: -.2 * s, lean: -.25 * s, glow: s, sa: .15 - .7 * s, hand: { u: 2.6 - .2 * s, v: -3.6 - 3.8 * s } }); }
    [[3.8, -6, .5, 1, .25], [3.4, -5, .3, .5, .1]].forEach(([u, v, sa, glow, lean]) => add('strike', { ph: 4, bob: 0, lean, glow, sa, hand: { u, v } }));
    return { F, seq, meta, walkBy: 'time', fps: 9 };
  }
  function mimicPoses() {
    const F = [], seq = { idle: [], walk: [], wind: [], strike: [] }, meta = [];
    const add = (k, p) => { seq[k].push(F.length); F.push(p); meta.push({}); };
    for (let i = 0; i < 6; i++) { const q = i / 6 * TAU; add('idle', { open: .12 + .08 * sn(q), eyes: i === 4 ? 0 : 1 }); }
    for (let i = 0; i < 8; i++) { const q = i / 8 * TAU; add('walk', { legs: true, legPh: q * 2, open: .25 + .25 * sn(2 * q), bob: -.2 * Math.abs(sn(2 * q)), eyes: 1, tongue: 0 }); }
    [[.5, .15], [.9, .35], [1.2, .55]].forEach(([open, tongue]) => add('wind', { open, tongue, eyes: 1, bob: -.2 }));
    [[1.2, 1, .5], [.2, .3, .6], [0, 0, .2]].forEach(([open, tongue, shift]) => add('strike', { open, tongue, shift, eyes: 1 }));
    return { F, seq, meta, walkBy: 'dist', stride: 12 };
  }
  const KINDS = {
    slime: [slime, slimePoses], goblin: [goblin, goblinPoses], archer: [skeleton, skeletonPoses], golem: [golem, golemPoses],
    bat: [bat, batPoses], mage: [mage, magePoses], mimic: [mimic, mimicPoses],
  };
  R('bone0', TIER.bone[0], 7, .5);

  // ---------------------------------------------------------- 敵スプライト（キャッシュ・必要な時に作り、残りは空き時間に）
  const cache = {}, old = G.enemySpr, bgq = [];
  // 大きさだけ先に決め、絵は初めて使う時（または空き時間）に作る
  function lazy(wu, hu, k, draw) {
    const s = { w: Math.round(wu * k * RES), h: Math.round(hu * k * RES) };
    let done = null;
    s.make = () => { if (!done) { const b = new G.P3Buf(wu * k, hu * k, wu * k / 2 * RES, (hu - 1.5) * k * RES, k); draw(b); done = G.wrapSprite(G.P3finish(b)); } return done; };
    for (const key of ['n', 'f', 'wn', 'wf']) Object.defineProperty(s, key, { get: () => s.make()[key] });
    return s;
  }
  function lazyTint(s, c) {
    const o = {}; let n = null, f = null;
    Object.defineProperty(o, 'n', { get: () => n || (n = G.tintCanvas(s.n, c)) });
    Object.defineProperty(o, 'f', { get: () => f || (f = G.tintCanvas(s.f, c)) });
    return o;
  }
  setInterval(() => { const t0 = performance.now(); while (bgq.length && performance.now() - t0 < 6) bgq.shift().make(); }, 50);
  G.enemySpr = function (type, tier, big) {
    const key = type + tier + (big ? 'B' : '');
    if (cache[key]) return cache[key];
    const K = KINDS[type];
    if (!K) return old(type, tier);
    const t = tier % 5, k = big ? G.ESC_BOSS : G.ESC, P = K[1]();
    const o = { seq: P.seq, meta: P.meta, walkBy: P.walkBy, stride: P.stride, fps: P.fps, k };
    o.frames = P.F.map(p => { const [wu, hu, draw] = K[0](t, p); return lazy(wu, hu, k, draw); });
    // 移動と待機のコマを先に、残りを後から作る
    for (const i of [...P.seq.walk, ...P.seq.idle, ...P.seq.wind, ...P.seq.strike]) bgq.push(o.frames[i]);
    if (type === 'goblin') o.weap = G.WEAP3D.club;
    else if (type === 'archer') o.weap = G.WEAP3D.bow;
    else if (type === 'mage') o.weap = G.WEAP3D.staff;
    o.aura = o.frames.map(s => lazyTint(s, '#ff5a3a'));
    o.gold = o.frames.map(s => lazyTint(s, '#ffd84d'));
    o.ice = o.frames.map(s => lazyTint(s, '#bfeaff'));
    return cache[key] = o;
  };

  const oldColors = G.enemyColors;
  G.enemyColors = (type, tier) => {
    const k = { slime: 'slime', goblin: 'goblin', archer: 'bone', golem: 'rock', bat: 'bat', mage: 'robe', mimic: 'wood' }[type];
    if (!k) return oldColors(type, tier);
    const r = G.makeRamp(TIER[k][tier % 5], 3, .4);
    return [r[1], r[0], r[2]];
  };

  // ---------------------------------------------------------- 宝箱・小物
  function chest(open) {
    return sprite(10, 9, b => {
      D(b, RC(-3.6, -3.4, 3.6, 0, .35, .5), 'woodR', 1, { bulge: 1.4, shade: (s, u) => s - ((Math.floor((u + 4) * 1.1) % 2) ? .07 : 0) });
      if (open) {
        D(b, RC(-3.6, -6.4, 3.6, -3.2, .6, .5), 'woodR', .5, { bulge: 1.2, shade: s => s * .6 }); // 本体の後ろに立ち上がったフタ（内側）
        D(b, RC(-3.3, -3.9, 3.3, -3.1, .2, .2), 'darkIn', 1.5, { lv: .8 });
        D(b, E(0, -3.5, 2.6, .5), 'goldR', 1.6, { lv: 5.5 }); // 中の輝き
      } else D(b, RC(-3.7, -6, 3.7, -3.3, .9, .6), 'woodR', 2, { bulge: 1.5 });
      for (const [y0, y1] of open ? [[-1.3, -.7]] : [[-1.3, -.7], [-3.7, -3.1]]) D(b, RC(-3.7, y0, 3.7, y1, .1, .2), 'goldR', 2.5, { spec: .5 });
      for (const x of [-3.2, 2.6]) D(b, RC(x, open ? -3.4 : -6, x + .6, 0, .1, .2), 'goldR', 2.4, { spec: .4 });
      if (!open) { D(b, RC(-.55, -3.9, .55, -2.4, .2, .25), 'goldR', 3, { spec: .8 }); D(b, E(0, -3.2, .18, .28), null, 3.1, { color: () => col('#1a0f08') }); }
    });
  }
  G.CHEST = chest(false); G.CHEST_OPEN = chest(true);
  const prop = (wu, hu, draw) => { const b = new G.P3Buf(wu, hu, wu / 2 * RES, (hu - .5) * RES, 1); draw(b); return G.P3finish(b); };
  G.PROPS.barrel = prop(8, 10, b => {
    D(b, RC(-2.8, -8.6, 2.8, 0, 1.3, 2.4), 'woodR', 1, { h: (u, v) => Math.sqrt(Math.max(0, 1 - (u / 2.9) ** 2)), bulge: 1.6, shade: (s, u) => s - ((Math.floor((u + 3) * 1.4) % 2) ? .06 : 0) });
    for (const y of [-7, -1.7]) D(b, RC(-2.9, y - .35, 2.9, y + .35, .3, .3), 'ironR', 2, { h: (u, v) => Math.sqrt(Math.max(0, 1 - (u / 3) ** 2)), spec: .5, bulge: 1.4 });
    D(b, E(0, -8.6, 2.5, .7), 'woodR', 2.5, { lv: 2.5 });
  });
  G.PROPS.crate = prop(8, 9, b => {
    D(b, RC(-3, -7, 3, 0, .2, .5), 'woodR', 1, { bulge: 1.2, shade: (s, u, v) => s - ((Math.floor((v + 7) * 1.1) % 2) ? .05 : 0) });
    D(b, C(-2.5, -6.5, 2.5, -.5, .35), 'woodR', 2, { lv: 3.8 }); D(b, C(2.5, -6.5, -2.5, -.5, .35), 'woodR', 2, { lv: 3.2 });
  });
  // 敵の武器（立体）：棍棒・弓・杖（柄の根元が原点付近）
  const weap = (wu, hu, ox, oy, draw) => { const K = G.ESC, b = new G.P3Buf(wu * K, hu * K, ox * RES * K, oy * RES * K, K); draw(b); return G.wrapSprite(G.P3finish(b)); };
  G.WEAP3D = {
    club: weap(4, 6, 1, 5.5, b => { D(b, C(.2, -.2, 1.5, -4.2, .35, .85), 'woodR', 1, { bulge: 1.4 }); for (const [x, y] of [[1.1, -3.4], [1.9, -4.3], [.8, -4.4]]) D(b, E(x, y, .22, .22), 'ironR', 2, { spec: .6 }); }),
    bow: weap(3.5, 9, 1, 4.5, b => {
      const arc = { bb: [-1, -4.4, 2.2, 4.4], inside: (u, v) => { const x = 1.3 * Math.cos(Math.asin(G.clamp(v / 4.2, -1, 1))) - .3; return Math.abs(u - x) < .32 && Math.abs(v) < 4.2; }, h: () => .8 };
      D(b, arc, 'woodR', 1, { bulge: 1 }); D(b, C(-.3, -4.1, -.3, 4.1, .06), null, 2, { color: () => col('#e8e0d0') });
    }),
    staff: weap(3.5, 11, 1.2, 9.5, b => { D(b, C(0, 0, 0, -8, .28), 'woodR', 1, { bulge: 1.2 }); D(b, E(0, -8.8, .95, .95), 'gemR', 2, { spec: 1.1, amb: .5, bulge: 1.5 }); D(b, C(-.7, -8, .7, -8, .2), 'goldR', 2.1, { spec: .6 }); }),
  };
  // 松明の金具・焚き火の薪
  G.BRACKET = prop(3, 3, b => { D(b, C(-1, -1.8, 1, -1.8, .45), 'ironR', 1, { spec: .6 }); D(b, C(0, -1.8, 0, -.4, .3), 'ironR', 1.2, { spec: .4 }); });
  G.CAMPFIRE = prop(8, 4, b => {
    for (const [x0, y0, x1, y1] of [[-3, -.6, 2.6, -1.8], [-2.6, -1.8, 3, -.5], [-3.2, -1.2, 3.2, -1.2]]) D(b, C(x0, y0, x1, y1, .55), 'woodR', 1, { bulge: 1.3 });
    for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2; D(b, E(Math.cos(a) * 3.4, -.9 + Math.sin(a) * .9, .6, .45), 'rockStone', .5, { bulge: 1.2 }); }
  });
  // 地面に落ちる装備アイコン（立体）
  const icon = draw => prop(6, 6, draw);
  R('gemR', '#e0303a', 5, .5);
  G.ICONW = {
    weapon: icon(b => { D(b, C(-1.8, -.9, 1.9, -4.6, .42, .2), 'ironR', 1, { spec: .8, bulge: 1 }); D(b, C(-2.4, -1.6, -1, -.2, .28), 'goldR', 2, { spec: .6 }); D(b, C(-2.2, -.3, -2.9, .4, .3), 'leatherR', 1.5, {}); }),
    head: icon(b => { D(b, { ...E(0, -2.2, 2.4, 2.2), inside: (u, v) => E(0, -2.2, 2.4, 2.2).inside(u, v) && v < -.6 }, 'ironR', 1, { spec: .9, shin: 14, bulge: 1.4 }); D(b, RC(-2.4, -1.2, 2.4, -.5, .2, .2), 'ironR', 2, { lv: 2 }); D(b, C(-1.2, -2, 1.2, -2, .18), null, 2.5, { color: () => col('#1a1a22') }); }),
    body: icon(b => { D(b, PL([[-2.4, -4.2], [-1, -4.6], [0, -3.8], [1, -4.6], [2.4, -4.2], [2, -.4], [-2, -.4]], .8), 'leatherR', 1, { bulge: 1.5 }); D(b, E(0, -2.6, .6, .6), 'goldR', 2, { spec: .7 }); }),
    feet: icon(b => { D(b, C(-.6, -4.2, -.6, -1.4, .95), 'leatherR', 1, { bulge: 1.3 }); D(b, E(.4, -.9, 1.8, .85), 'leatherR', 1.5, { bulge: 1.3 }); D(b, C(-1.1, -4, -.1, -4, 1.1), 'woodR', 2, { lv: 4 }); }),
    acc: icon(b => { const o = E(0, -1.8, 2, 1.5), i = E(0, -1.8, 1.2, .8); D(b, { bb: o.bb, inside: (u, v) => o.inside(u, v) && !i.inside(u, v), h: (u, v) => Math.max(0, 1 - Math.abs(Math.sqrt(((u) / 1.6) ** 2 + ((v + 1.8) / 1.15) ** 2) - 1) * 3) }, 'goldR', 1, { spec: .9, bulge: 1.2 }); D(b, E(0, -3.4, .85, .85), 'gemR', 2, { spec: 1.2, shin: 10, bulge: 1.5 }); }),
  };
  const bcache = {};
  G.banner = hex => bcache[hex] || (bcache[hex] = prop(8, 11, b => {
    const m = R('ban' + hex, hex, 6, .5);
    D(b, C(-3, -10.2, 3, -10.2, .35), 'ironR', 2, { spec: .5 });
    D(b, PL([[-2.6, -10], [2.6, -10], [2.6, -1.4], [1.3, -2.6], [0, -1.2], [-1.3, -2.6], [-2.6, -1.4]], .5), m, 1, { h: (u) => .5 + .4 * Math.sin(u * 2.4), bulge: 1.4, dith: .3 });
    D(b, E(0, -6.4, 1.1, 1.2), 'goldR', 1.5, { spec: .5 });
    D(b, E(0, -6.4, .45, .5), m, 1.6, { lv: 1 });
  }));
})();
