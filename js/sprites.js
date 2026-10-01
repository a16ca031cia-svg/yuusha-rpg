'use strict';
// ===== ドット絵スプライト（文字列で記述し、自動で輪郭線を付ける） =====
(function () {
  const colCache = {};
  const OUTLINE = '#1c110d';
  function rgb(hex) {
    if (colCache[hex]) return colCache[hex];
    const h = hex.replace('#', '');
    return colCache[hex] = [parseInt(h.substr(0, 2), 16), parseInt(h.substr(2, 2), 16), parseInt(h.substr(4, 2), 16), h.length > 6 ? parseInt(h.substr(6, 2), 16) : 255];
  }
  G.rgb = rgb;

  function build(rows, pal, outline) {
    if (outline === undefined) outline = OUTLINE;
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const P = outline ? 1 : 0, cw = w + 2 * P, ch = h + 2 * P;
    const c = G.canvas(cw, ch), x = c.getContext('2d'), img = x.createImageData(cw, ch), d = img.data, f = new Uint8Array(cw * ch);
    for (let j = 0; j < h; j++) {
      const row = rows[j];
      for (let i = 0; i < w; i++) {
        const k = row[i];
        if (!k || k === '.' || k === ' ') continue;
        const col = pal[k]; if (!col) continue;
        const id = (j + P) * cw + i + P; f[id] = 1; d.set(rgb(col), id * 4);
      }
    }
    if (outline) {
      const v = rgb(outline);
      for (let j = 0; j < ch; j++) for (let i = 0; i < cw; i++) {
        const id = j * cw + i; if (f[id]) continue;
        if ((i > 0 && f[id - 1]) || (i < cw - 1 && f[id + 1]) || (j > 0 && f[id - cw]) || (j < ch - 1 && f[id + cw])) d.set(v, id * 4);
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  }
  function flip(src) { const c = G.canvas(src.width, src.height), x = c.getContext('2d'); x.translate(src.width, 0); x.scale(-1, 1); x.drawImage(src, 0, 0); return c; }
  function tint(src, color) { const c = G.canvas(src.width, src.height), x = c.getContext('2d'); x.drawImage(src, 0, 0); x.globalCompositeOperation = 'source-in'; x.fillStyle = color; x.fillRect(0, 0, c.width, c.height); return c; }
  function scaleUp(src, k) { const c = G.canvas(src.width * k, src.height * k), x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(src, 0, 0, c.width, c.height); return c; }
  function wrap(n) {
    const s = { n, f: flip(n), w: n.width, h: n.height };
    s.wn = tint(n, '#ffffff'); s.wf = flip(s.wn);
    return s;
  }
  // 2倍の解像度に拡大しつつ斜めの段差をなめらかにする（EPX/Scale2x）。
  // 輪郭線は拡大後に1ドットで付けるので、線が細く描き込みの密度が2倍になる。
  function epx(rows) {
    const h = rows.length, w = Math.max(...rows.map(r => r.length));
    const at = (x, y) => (y < 0 || y >= h || x < 0 || x >= w) ? '.' : (rows[y][x] || '.');
    const out = [];
    for (let y = 0; y < h; y++) {
      let r0 = '', r1 = '';
      for (let x = 0; x < w; x++) {
        const P = at(x, y), A = at(x, y - 1), B = at(x + 1, y), C = at(x - 1, y), D = at(x, y + 1);
        let p1 = P, p2 = P, p3 = P, p4 = P;
        if (C === A && C !== D && A !== B) p1 = A;
        if (A === B && A !== C && B !== D) p2 = B;
        if (D === C && D !== B && C !== A) p3 = C;
        if (B === D && B !== A && D !== C) p4 = D;
        r0 += p1 + p2; r1 += p3 + p4;
      }
      out.push(r0, r1);
    }
    return out;
  }
  G.epx = epx;
  const put2 = (rows, r, c, s) => { if (r < 0 || r >= rows.length) return; rows[r] = rows[r].substr(0, c) + s + rows[r].substr(c + s.length); };
  function mk(rows, pal, outline) { return wrap(build(rows, pal, outline)); }
  // 高解像度スプライト（世界座標では0.5倍で描く）
  function mkHi(rows, pal, outline, patch) { const r = epx(rows); if (patch) patch(r); return wrap(build(epx(r), pal, outline)); }
  function hi(rows, pal, outline) { return build(epx(epx(rows)), pal, outline); }
  G.PX = 0.25; // スプライト1ドット = 0.25ワールド単位（4倍の細かさ）
  G.buildSprite = build; G.flipCanvas = flip; G.tintCanvas = tint; G.mkSprite = mk; G.mkHi = mkHi; G.wrapSprite = wrap; G.scaleCanvas = scaleUp;

  // ===================== 勇者 =====================
  // 参考画像から抽出した色（砂色の髪・深みのある赤マント・生成りの服・茶革）
  const HP = {
    l: '#e2c9a0', H: '#c4a37c', h: '#9e7e5b', j: '#775a40', d: '#523b2b',
    S: '#fde4ce', s: '#efc3a2', p: '#f3a39a',
    E: '#2c1a12', e: '#6a4028', w: '#ffffff',
    T: '#f0e7d3', t: '#cbbd9e', k: '#6a4630',
    B: '#6e4629', b: '#48291a', G: '#dcae44', g: '#9a7426',
    R: '#b9362d', r: '#7c231f', q: '#d65a48',
    P: '#58565f', o: '#3b3943',
    N: '#7a4b2e', n: '#4b2d1c', c: '#9c6b45',
    W: '#eef0f2', v: '#b7bcc4', x: '#80868f', L: '#ffffff',
  };
  G.HERO_PAL = HP;
  // 頭（24x20・右向き3/4ビュー）。顔より大きく広がる癖っ毛、外ハネ、アホ毛、縦長の大きな瞳
  const put = (rows, r, c, s) => { rows[r] = rows[r].substr(0, c) + s + rows[r].substr(c + s.length); };
  // 小さな顔に縦長の大きな瞳、頬にかかる前髪の房、耳、濃い色の襟足
  const HEAD = [
    '...........hlHh.........',
    '..........hH...h........',
    '.......hhhHHhhh.........',
    '.....hhHHHHHHHHhhh......',
    '....hHHHllHHHHHHHHh.....',
    '...hHHHlllHHHHlllHHh....',
    '..hhHHHHlHHHHHHllHHHh...',
    '.hjhHHHHHHhHHHHHHHHHHh..',
    'hjjhHHHHHhHHHHhHHHHHHHh.',
    'hjjhhHHHHhHHHhHHHhHHHHhh',
    'djjjhhhHHjSHHHjSSHHjHHhh',
    'djjjhhhhjSSSHHjSSSSHjHHh',
    'djjjhhhjsSSEEESSSEEEjHHh',
    'djjjhhhssSSEEwSSSEEwjHHh',
    'djjjhhhssSSEEESSSEEESjHh',
    '.djjhhhjsSSeEeSSSeEeSSjh',
    '.ddjjhhjsSSSeSSSSSeSSSjh',
    '..ddjjhhjSSppSSSSSpSSSj.',
    '...ddjjhhsSSSSSSSSSSsj..',
    '....dd.j..sSSSSSSSs.....',
    '.....d..................',
  ].map(r => '..' + r + '..');
  // シルエットのハネ：後ろ髪（左）と前髪の外ハネ（右）で癖っ毛の輪郭にする
  // （外ハネは高解像度側で先細りの線として描く：hairDetail参照）
  const BLINK = HEAD.slice();
  const EX = 2; // 左右の余白ぶんのずれ
  for (const r of [12, 13, 15, 16]) { put(BLINK, r, 11 + EX, 'SSS'); put(BLINK, r, 17 + EX, 'SSS'); }
  const HURT = BLINK.slice();
  put(HURT, 14, 11 + EX, 'SSS'); put(HURT, 14, 17 + EX, 'SSS');
  [[12, 11], [13, 12], [14, 13], [15, 12], [16, 11], [12, 19], [13, 18], [14, 17], [15, 18], [16, 19]].forEach(([r, c]) => put(HURT, r, c + EX, 'E'));
  // 胴（14x12）：首元でたまった赤いフード、金の丸いブローチ、斜めの革ベルト、大きな金のバックル、腰のポーチ
  // （ブローチ・斜めベルト・刺繍・バックルは高解像度側で描く：torsoDetail参照）
  const TORSO = [
    '..rrRRRRRRRr..',
    '.rRRRqqRRRRRr.',
    'rRRRRRRRRRRRRr',
    'rrRrTTTTTTTTTt',
    '.rrTTTTTTTTTTt',
    '.rrTTTTTTTTTTt',
    '.rrBBBBBBBBBBB',
    '..rNBBBBBBBBBB',
    '..NcNTTTTTTTTt',
    '..nNnTtTTtTTt.',
    '...oPPPPPPPPo.',
    '...PPPPPPPPPo.',
    '...oPPo..oPPo.',
  ];
  // ブーツ（7x6）：折り返しの履き口と金の留め具
  const LEG = [
    '.cccc..',
    '.NNNn..',
    '.NGGn..',
    '.NNNNN.',
    'nNNNNNN',
    'nnnnnnn',
  ];
  // 大きな革のミトン
  const ARM = ['TT.', 'Tt.', 'NNN', 'NcN', 'nNn'];
  const HAND = ['.NN.', 'NcNN', 'NNNN', 'nNNn'];
  // 幅広で先の尖った剣
  const SWORD = [
    '....g..........',
    '...gGWWWWWWWWL.',
    'nNNGGvvvvvvvvvW',
    '...gGxxxxxxxxx.',
    '....g..........',
  ];
  // --- 高解像度での描き込み（瞳・髪の毛束） ---
  const EYE = ['SEEEES', 'EEEEEE', 'EEEEww', 'EEEEww', 'EEEEEE', 'EEEEEE', 'eEEEEe', 'ewEeee', 'SeeeeS', 'SSeeSS'];
  const EYE_SHUT = ['SSSSSS', 'SSSSSS', 'SSSSSS', 'SSSSSS', 'SSSSSS', 'ESSSSE', 'SEEEES', 'SSSSSS', 'SSSSSS', 'SSSSSS'];
  const EYES_AT = [[26, 24], [38, 24]];
  function stroke(rows, pts, ch, onto) {
    for (let i = 0; i + 1 < pts.length; i++) {
      const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let k = 0; k <= n; k++) {
        const x = Math.round(x0 + (x1 - x0) * k / n), y = Math.round(y0 + (y1 - y0) * k / n);
        if (y >= 0 && y < rows.length && onto.includes(rows[y][x])) put2(rows, y, x, ch);
      }
    }
  }
  function hairDetail(r) {
    // 毛束の境目（暗い線）とツヤ（明るい線）
    const dark = [[[24, 5], [20, 10], [15, 17], [12, 21]], [[28, 5], [27, 12], [25, 19]], [[31, 6], [34, 12], [37, 18]],
      [[35, 7], [41, 11], [45, 16]], [[19, 8], [13, 13], [9, 20]], [[40, 12], [44, 20], [46, 25]], [[10, 14], [7, 22], [6, 28]]];
    for (const s of dark) stroke(r, s, 'h', 'Hl');
    const shine = [[[17, 9], [20, 8], [23, 8]], [[31, 9], [34, 9], [37, 11]], [[25, 11], [27, 10]]];
    for (const s of shine) stroke(r, s, 'l', 'H');
  }
  function eyes(r, pat) { for (const [ex, ey] of EYES_AT) pat.forEach((row, j) => put2(r, ey + j, ex, row)); }
  // 外ハネ：根元が太く先が細い、くさび形の毛の房（[根元1, 根元2, 毛先, 色]）
  const TUFTS = [
    [[8, 13], [5, 21], [1, 19], 'h'], [[6, 27], [10, 33], [2, 34], 'j'], [[11, 35], [17, 38], [10, 41], 'd'],
    [[50, 18], [50, 25], [55, 24], 'h'],
  ];
  function flicks(r) {
    for (const [a, b, c, col] of TUFTS) {
      const x0 = Math.min(a[0], b[0], c[0]), x1 = Math.max(a[0], b[0], c[0]), y0 = Math.min(a[1], b[1], c[1]), y1 = Math.max(a[1], b[1], c[1]);
      const ar = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const w0 = ((b[0] - x - .5 + .5) * (c[1] - y) - (c[0] - x) * (b[1] - y)) / ar;
        const w1 = ((c[0] - x) * (a[1] - y) - (a[0] - x) * (c[1] - y)) / ar;
        const w2 = 1 - w0 - w1;
        if (w0 >= -.02 && w1 >= -.02 && w2 >= -.02 && y >= 0 && y < r.length && x >= 0 && r[y][x] === '.') put2(r, y, x, col);
      }
      // 房の中心に明るい筋
      stroke(r, [[Math.round((a[0] + b[0]) / 2), Math.round((a[1] + b[1]) / 2)], [Math.round((a[0] + b[0] + c[0] * 2) / 4), Math.round((a[1] + b[1] + c[1] * 2) / 4)]], col === 'h' ? 'H' : 'h', 'hjd');
    }
  }
  function torsoDetail(r) {
    // ブローチ（丸い金具にハイライト）
    ['.gg.', 'gGLg', 'gGGg', '.gg.'].forEach((row, j) => { for (let i = 0; i < 4; i++) if (row[i] !== '.') put2(r, 2 + j, 19 + i, row[i]); });
    // 肩から腰へ斜めの革ベルト
    stroke(r, [[24, 6], [15, 12]], 'B', 'Tt');
    stroke(r, [[25, 6], [16, 12]], 'B', 'Tt');
    stroke(r, [[25, 7], [16, 13]], 'b', 'Tt');
    // 胸のX字の縫い目
    stroke(r, [[8, 8], [11, 11]], 'k', 'T'); stroke(r, [[11, 8], [8, 11]], 'k', 'T');
    // 大きな金のバックル
    ['GGGGGG', 'GbbbbG', 'GbbbbG', 'GGGGGG'].forEach((row, j) => put2(r, 12 + j, 17, row));
    // 裾の点線ステッチ
    for (let x = 6; x < 26; x += 3) if ('Tt'.includes(r[19][x])) put2(r, 19, x, 't');
  }
  G.HS = {
    head: mkHi(HEAD, HP, undefined, r => { flicks(r); hairDetail(r); eyes(r, EYE); }),
    blink: mkHi(HEAD, HP, undefined, r => { flicks(r); hairDetail(r); eyes(r, EYE_SHUT); }),
    hurt: mkHi(HURT, HP, undefined, r => { flicks(r); hairDetail(r); }),
    torso: mkHi(TORSO, HP, undefined, r => torsoDetail(r)), leg: mkHi(LEG, HP), arm: mkHi(ARM, HP), hand: mkHi(HAND, HP),
    sword: mkHi(SWORD, HP),
  };
  // 剣の握り（元の(1,2)）の高解像度での中心
  G.SWORD_PIVOT = { x: 4, y: 6 };
  // 武器の種類ごとの剣（握りの位置はすべて(1,2)にそろえる）
  const SW_ROWS = {
    'ショートソード': [SWORD, HP],
    'ブロードソード': [['....gWWWWWWWW...', '...gGWWWWWWWWWL.', 'nNNGGvvvvvvvvvvW', '...gGxxxxxxxxxx.', '....gxxxxxxxx...'], HP],
    'レイピア': [['...gg.............', '..g.G.............', 'nNNGGWWWWWWWWWWWWL', '..g.G.............', '...gg.............'], HP],
    'バスタードソード': [['....gWWWWWWWWWWW...', '...gGWWWWWWWWWWWWL.', 'nNNGGvvvvvvvvvvvvvW', '...gGxxxxxxxxxxxx..', '....gxxxxxxxxxxx...'], HP],
    'ルーンブレード': [['....g...........', '...gGWWrWWrWWWL.', 'nNNGGvvvvvvvvvvW', '...gGxxrxxrxxxx.', '....g...........'], Object.assign({}, HP, { W: '#d8f4ff', v: '#7fd0ff', x: '#3f8fd0', r: '#1f4f9f', L: '#ffffff' })],
    '竜牙の剣': [['....g..........WL', '...gGWWWWWWWWWWL.', 'nNNGGvvvvvvvvvv..', '...gGrrrrrrrrr...', '....g............'], Object.assign({}, HP, { W: '#f4ecdc', v: '#d8ccb0', r: '#c03a2a', L: '#ffffff' })],
  };
  G.HS.swords = {};
  for (const k in SW_ROWS) G.HS.swords[k] = mkHi(SW_ROWS[k][0], SW_ROWS[k][1]);
  // ドット差分アニメーション（hero_anim.js）用に元の絵を公開
  G.HERO_ART = { HP, HEAD, BLINK, HURT, LEG, ARM, HAND, SW_ROWS };
  // 斬撃の軌跡の色（武器のレア度）
  G.SLASH_COL = ['#ffffff', '#bfe4ff', '#fff0a0', '#e6c2ff', '#ffc890'];

  // ===================== 敵 =====================
  const TIER_COLS = {
    slime: [
      { A: '#62cf6c', a: '#2f8a45', L: '#c2f7b0' },
      { A: '#e2644c', a: '#9a2f2a', L: '#ffc0a6' },
      { A: '#4f93e4', a: '#2a4f9a', L: '#b0dcff' },
      { A: '#a15ad4', a: '#5f2f8a', L: '#e6b8ff' },
      { A: '#f0c440', a: '#a07818', L: '#fff4b0' },
    ],
    goblin: [
      { G: '#7cc24f', g: '#4a8030' }, { G: '#dc7a4a', g: '#8f4424' }, { G: '#5a9ad4', g: '#305a8a' },
      { G: '#9c72c4', g: '#5a3a80' }, { G: '#d4b440', g: '#8a7020' },
    ],
    archer: [
      { W: '#ece6d6', v: '#a8a090' }, { W: '#f0c8b8', v: '#b08070' }, { W: '#c8e0f0', v: '#7890a8' },
      { W: '#d8c8f0', v: '#8a78a8' }, { W: '#f4e2a0', v: '#b09850' },
    ],
    golem: [
      { S: '#8a8474', s: '#5e584c', m: '#6ff0e0' }, { S: '#9a6450', s: '#643a2c', m: '#ffb050' }, { S: '#6a88a8', s: '#44586e', m: '#b0f0ff' },
      { S: '#6e5a88', s: '#46385a', m: '#ff70d0' }, { S: '#b8a060', s: '#7a6634', m: '#ffffff' },
    ],
    mage: [
      { P: '#6a4aa8', p: '#44307a', Y: '#ffe060' }, { P: '#a8404a', p: '#702830', Y: '#9fffd0' }, { P: '#3a6aa8', p: '#26447a', Y: '#ffb0ff' },
      { P: '#3a2a4a', p: '#22182e', Y: '#ff5050' }, { P: '#b8963a', p: '#7a6224', Y: '#ffffff' },
    ],
    mimic: [
      { N: '#9a5e30', n: '#643818' }, { N: '#8a3a3a', n: '#5a2020' }, { N: '#3a5a7a', n: '#20364a' }, { N: '#4a3a5a', n: '#2a2034' }, { N: '#a88a40', n: '#6a5424' },
    ],
    bat: [
      { K: '#6a4c8a', k: '#432e5c', R: '#ff5050' }, { K: '#8a3a3a', k: '#5a2020', R: '#ffe050' }, { K: '#3a5a8a', k: '#20365a', R: '#80ffff' },
      { K: '#3a2a4a', k: '#1e1428', R: '#ff60ff' }, { K: '#8a7a3a', k: '#5a4a1e', R: '#ffffff' },
    ],
  };
  const GOB = [
    '....gGGg....',
    '...gGGGGg...',
    'gg.GGGGGG.gg',
    '.gGGGGGGGGg.',
    '..GYkGGYkG..',
    '..GGGGGGGG..',
    '...GwgwgG...',
    '....BBBB....',
    '..GBBbbBBG..',
    '..gBBBBBBg..',
    '...BbBBbB...',
    '...bb..bb...',
    '..bbb..bbb..',
  ];
  const GOB2 = GOB.slice(); // 歩行フレーム
  GOB2[11] = '...bb...bb..'; GOB2[12] = '..bbb...bbb.';
  const GOB_PAL = { Y: '#ffe14a', k: '#1a1010', w: '#ffffff', B: '#8a5a34', b: '#5c3a20' };
  const CLUB = ['..NN', '.NNN', 'NNn.', 'Nn..', 'n...'];
  const SKEL = [
    '....WWWW....',
    '...WWWWWW...',
    '...WkkWkkW..',
    '...WkkWkkW..',
    '....WWWWW...',
    '....WkWkW...',
    '.....vvv....',
    '...WvWWWvW..',
    '..W.vWvW.W..',
    '....vWWWv...',
    '.....WvW....',
    '....W...W...',
    '....W...W...',
    '...WW...WW..',
  ];
  const SKEL2 = SKEL.slice(); SKEL2[11] = '....W..W....'; SKEL2[12] = '...W....W...'; SKEL2[13] = '..WW....WW..';
  const SK_PAL = { k: '#241820' };
  const BOW = ['.NN.', 'N..v', 'N..v', 'N..v', 'N..v', 'N..v', 'N..v', '.NN.'];
  const GOL = [
    '.....SSSSSSSS.....',
    '....SSSSSSSSSs....',
    '....SsmmssmmSs....',
    '....SSSSSSSSSs....',
    '.SSSSssssssssSSSS.',
    'SSSSSSSSSSSSSSSSSs',
    'SSSsSSSSmmSSSSsSSs',
    'SSSsSSSmmmmSSSsSSs',
    'sSSs.SSSmmSSSS.sSs',
    '.ss..SSSSSSSSs..s.',
    '.....SSSSSSSSs....',
    '.....SSSs.SSSs....',
    '.....SSSs.SSSs....',
    '....sSSSs.sSSSs...',
  ];
  const GOL2 = GOL.slice(); GOL2[11] = '.....SSSs..SSSs...'; GOL2[12] = '....SSSs...SSSs...'; GOL2[13] = '...sSSSs..sSSSs...';
  const BAT1 = [
    'K............K',
    'KK..........KK',
    'KKK..kKKk..KKK',
    '.KKKKKRKRKKKK.',
    '..KK.kKKk.KK..',
    '......kk......',
  ];
  const BAT2 = [
    '..............',
    '.....kKKk.....',
    '....KKRKRK....',
    '.KKKKKKKKKKKK.',
    'KKK...kk...KKK',
    'KK..........KK',
    'K............K',
  ];
  const WEAP_PAL = { N: '#7e4c2a', n: '#52301a', v: '#d8d0c0' };
  // 歩行4コマ（右足・揃え・左足・揃え）と攻撃の予備動作コマ
  const GOB3 = GOB.slice(); GOB3[11] = '..bb..bb....'; GOB3[12] = '.bbb..bbb...';
  const GOB_ATK = GOB.slice(); GOB_ATK[7] = '.G..BBBB..G.'; GOB_ATK[8] = '..GBBbbBBG..'; GOB_ATK[9] = '...BBBBBB...'; GOB_ATK[2] = 'gg.GGGGGG.gg';
  const SKEL3 = SKEL.slice(); SKEL3[11] = '...W..W.....'; SKEL3[12] = '..W....W....'; SKEL3[13] = '.WW....WW...';
  const SKEL_ATK = SKEL.slice(); SKEL_ATK[7] = '...WvWWWvWWW'; SKEL_ATK[8] = '..W.vWvW....';
  const GOL3 = GOL.slice(); GOL3[11] = '....SSSs..SSSs....'; GOL3[12] = '....SSSs...SSSs...'; GOL3[13] = '...sSSSs...sSSSs..';
  const GOL_ATK = ['.SS..SSSSSSSS..SS.', '.SS.SSSSSSSSSs.SS.', '.SS.SsmmssmmSs.SS.', '.SSSSSSSSSSSSsSSS.', '..SSSssssssssSSS..',
    '.....SSSSSSSSs....', '.....SSSSmmSSs....', '.....SSSmmmmSs....', '.....SSSSmmSSs....', '.....SSSSSSSSs....', '.....SSSSSSSSs....',
    '.....SSSs.SSSs....', '.....SSSs.SSSs....', '....sSSSs.sSSSs...'];
  // 魔導士（フードの奥に光る目、金の留め具）
  const MAGE = [
    '.....PP.....',
    '....PPPP....',
    '...PPPPPP...',
    '..PPPPPPPP..',
    '.PPPPPPPPPP.',
    '..pkYkkYkp..',
    '...kkkkkk...',
    '..PPPPPPPP..',
    '.PPpPPPPpPP.',
    '.PpPPGGPPpP.',
    '.PPPPPPPPPP.',
    '..PpPPPPpP..',
    '..PPPPPPPP..',
    '.pPPPPPPPPp.',
  ];
  const MAGE2 = MAGE.slice(); MAGE2[13] = '..pPPPPPPp..'; MAGE2[12] = '.PPPPPPPPPP.';
  const STAFF = ['.OO.', 'OooO', 'OooO', '.OO.', '.N..', '.N..', '.N..', '.N..', '.N..', '.n..'];
  // ミミック（宝箱に化けた敵：赤い目と牙）
  const MIMIC = [
    '..nnnnnnnnnn..',
    '.nNNNNNNNNNNn.',
    'nNNrNNNNNNrNNn',
    'nGGGGGGGGGGGGn',
    'nwkwkwkwkwkwkn',
    'nNNNNNGGNNNNNn',
    'nNNNNNNNNNNNNn',
    'nGGGGGGGGGGGGn',
    'nnnnnnnnnnnnnn',
  ];
  const MIMIC2 = [
    '..nnnnnnnnnn..',
    '.nNNNNNNNNNNn.',
    'nNNrNNNNNNrNNn',
    'nGGGGGGGGGGGGn',
    'nwkwkwkwkwkwkn',
    'nkkkkRRRRkkkkn',
    'nkkkkkRRkkkkkn',
    'nwkwkwkwkwkwkn',
    'nGGGGGGGGGGGGn',
    'nnnnnnnnnnnnnn',
  ];

  function slimeRows(sq) {
    const w = Math.round(14 + sq * 3), h = Math.round(10 - sq * 2.5);
    const cx = (w - 1) / 2, rows = [];
    for (let y = 0; y < h; y++) {
      let r = '';
      for (let x = 0; x < w; x++) {
        const nx = (x - cx) / (w / 2), ny = (y - (h - 1)) / (h - 0.5);
        const inside = nx * nx + ny * ny <= 1.0 && (y < h - 1 || Math.abs(nx) < 0.86);
        if (!inside) { r += '.'; continue; }
        const lt = -nx * 0.45 - ny * 0.55;
        let c = 'A';
        if (lt < -0.05 || y === h - 1) c = 'a';
        if (lt > 0.62) c = 'L';
        r += c;
      }
      rows.push(r);
    }
    const put = (x, y, c) => { if (y >= 0 && y < h && x >= 0 && x < w && rows[y][x] !== '.') rows[y] = rows[y].substr(0, x) + c + rows[y].substr(x + 1); };
    const ex = Math.round(cx + 1), ey = h - 5;
    put(ex, ey, 'k'); put(ex, ey + 1, 'k'); put(ex + 3, ey, 'k'); put(ex + 3, ey + 1, 'k');
    put(Math.round(cx - 3), Math.max(1, Math.round(h * 0.25)), 'W'); put(Math.round(cx - 2), Math.max(1, Math.round(h * 0.25)), 'W');
    return rows;
  }

  // 撃破時の破片の色（種族・階層帯ごとの本体色と影色）
  const MAIN_KEY = { slime: ['A', 'a', 'L'], goblin: ['G', 'g'], archer: ['W', 'v'], golem: ['S', 's', 'm'], bat: ['K', 'k'], mage: ['P', 'p', 'Y'], mimic: ['N', 'n'] };
  G.enemyColors = (type, tier) => { const tc = TIER_COLS[type][tier % 5]; return MAIN_KEY[type].map(k => tc[k]); };
  const sprCache = {};
  G.enemySpr = function (type, tier) {
    const key = type + tier;
    if (sprCache[key]) return sprCache[key];
    const tc = TIER_COLS[type][tier % 5];
    const o = {};
    if (type === 'slime') {
      const pal = Object.assign({ k: '#14202a', W: '#ffffff' }, tc);
      o.frames = [-0.6, -0.4, -0.2, 0, 0.25, 0.5, 0.8].map(s => mkHi(slimeRows(s), pal));
    } else if (type === 'goblin') {
      const pal = Object.assign({}, GOB_PAL, tc);
      const g0 = mkHi(GOB, pal); o.frames = [g0, mkHi(GOB2, pal), g0, mkHi(GOB3, pal), mkHi(GOB_ATK, pal)];
      o.weap = mkHi(CLUB, WEAP_PAL);
    } else if (type === 'archer') {
      const pal = Object.assign({}, SK_PAL, tc);
      const s0 = mkHi(SKEL, pal); o.frames = [s0, mkHi(SKEL2, pal), s0, mkHi(SKEL3, pal), mkHi(SKEL_ATK, pal)];
      o.weap = mkHi(BOW, Object.assign({}, WEAP_PAL, { v: '#e0e0e0' }));
    } else if (type === 'golem') {
      const q0 = mkHi(GOL, tc); o.frames = [q0, mkHi(GOL2, tc), q0, mkHi(GOL3, tc), mkHi(GOL_ATK, tc)];
    } else if (type === 'bat') {
      o.frames = [mkHi(BAT1, tc), mkHi(BAT2, tc)];
    } else if (type === 'mage') {
      const pal = Object.assign({ k: '#1a1020', G: '#e0b040' }, tc);
      o.frames = [mkHi(MAGE, pal), mkHi(MAGE2, pal)];
      o.weap = mkHi(STAFF, { O: tc.Y === '#ffe060' ? '#ff9a4a' : tc.Y, o: '#fff4d0', N: '#7e4c2a', n: '#52301a' });
    } else if (type === 'mimic') {
      const pal = Object.assign({ G: '#f0c24e', g: '#a8801f', k: '#1a0f08', r: '#ff3030', w: '#ffffff', R: '#d04060' }, tc);
      o.frames = [mkHi(MIMIC, pal), mkHi(MIMIC2, pal)];
    }
    o.aura = o.frames.map(s => ({ n: tint(s.n, '#ff5a3a'), f: tint(s.f, '#ff5a3a') }));
    o.gold = o.frames.map(s => ({ n: tint(s.n, '#ffd84d'), f: tint(s.f, '#ffd84d') }));
    o.ice = o.frames.map(s => ({ n: tint(s.n, '#bfeaff'), f: tint(s.f, '#bfeaff') }));
    return sprCache[key] = o;
  };

  // ===================== 宝箱・アイテム =====================
  const CH_PAL = { N: '#9a5e30', n: '#643818', G: '#f0c24e', g: '#a8801f', k: '#1a0f08', Y: '#fff2a0' };
  G.CHEST = mkHi([
    '..nnnnnnnnnn..',
    '.nNNNNNNNNNNn.',
    'nNNNNNNNNNNNNn',
    'nGGGGGGGGGGGGn',
    'nNNNNNGGNNNNNn',
    'nNNNNNgkNNNNNn',
    'nNNNNNNNNNNNNn',
    'nNNNNNNNNNNNNn',
    'nGGGGGGGGGGGGn',
    'nnnnnnnnnnnnnn',
  ], CH_PAL);
  G.CHEST_OPEN = mkHi([
    '..nnnnnnnnnn..',
    '.nNNNNNNNNNNn.',
    'nGGGGGGGGGGGGn',
    'nkkkkkkkkkkkkn',
    'nkYYkkkkkkYYkn',
    'nNNNNNNNNNNNNn',
    'nNNNNNNNNNNNNn',
    'nNNNNNNNNNNNNn',
    'nGGGGGGGGGGGGn',
    'nnnnnnnnnnnnnn',
  ], CH_PAL);

  const IC_PAL = { W: '#f4f6fa', v: '#aab4c4', x: '#6c7688', G: '#f0c24e', g: '#a8801f', N: '#8e5a30', n: '#5a341a', r: '#e04848', b: '#5fb0ff', k: '#20242c' };
  const ICONS = {
    weapon: ['........WW', '.......WWv', '......WWv.', '.....WWv..', '..G.WWv...', '...GWv....', '...nG.....', '..nn.G....', '.nn.......', 'nn........'],
    head: ['...vvvv...', '..vWWWvv..', '.vWWWvvvx.', '.vWvvvvvx.', '.vvvvvvvx.', '.vx.kk.vx.', '.vx....vx.', '..x....x..'],
    body: ['.nn....nn.', 'nNNnnnnNNn', 'nNNNNNNNNn', '.nNNGGNNn.', '.nNNNNNNn.', '.nNNNNNNn.', '.nNnnnnNn.', '.nnn..nnn.'],
    feet: ['..NNN.....', '..NNN.....', '..NNN.....', '..NGN.....', '..NNNNNN..', '..NNNNNNN.', '..nnnnnnn.'],
    acc: ['....rr....', '...rWrr...', '..GGrrGG..', '.G......G.', '.G......G.', '.G......G.', '..G....G..', '...GGGG...'],
  };
  G.ICON = {};
  G.ICONW = {};
  for (const k in ICONS) { G.ICON[k] = build(ICONS[k], IC_PAL); G.ICONW[k] = hi(ICONS[k], IC_PAL); }
  const iconUrlCache = {};
  G.iconURL = function (slot) {
    if (iconUrlCache[slot]) return iconUrlCache[slot];
    const s = G.ICON[slot], c = G.canvas(36, 36), x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(s, Math.floor((12 - s.width) / 2) * 3, Math.floor((12 - s.height) / 2) * 3, s.width * 3, s.height * 3);
    return iconUrlCache[slot] = c.toDataURL();
  };

  // 技アイコン
  const SK_PAL2 = { y: '#ffd84d', W: '#ffffff', b: '#8fd8ff', o: '#ff9a5a', r: '#ff6a4a' };
  const SKI = {
    dash: ['............', '.....yy.....', '......yy....', 'yyyy...yy...', '.......WWy..', 'WWWWWWWWWWy.', '.......WWy..', 'yyyy...yy...', '......yy....', '.....yy.....'],
    combo: ['..........W.', '.........Wy.', '...W....Wy..', '..Wy...Wy...', '.Wy...Wy..W.', 'Wy...Wy..Wy.', '....Wy..Wy..', '...Wy..Wy...', '..Wy..Wy....', '.....Wy.....', '....Wy......'],
    spin: ['....bbbb....', '..bb....bW..', '.b........W.', '.b........W.', 'b....WW....b', 'b...WWWW...b', 'b....WW....b', '.W........b.', '.W........b.', '..Wb....bb..', '....bbbb....'],
    wave: ['.....bbb....', '.......bb...', '..b.....bW..', '...b.....W..', 'bbbbb....WW.', '...b.....WW.', '..b......W..', '........bW..', '.......bb...', '.....bbb....'],
    thunder: ['......yyyy..', '.....yyyy...', '....yyyy....', '...yyyy.....', '..yyyyyyyy..', '......yyy...', '.....yyy....', '....yyy.....', '...yy.......', '..y.........'],
    quake: ['.....oo.....', '.....oo.....', '....oooo....', '............', '..o......o..', '.o..rrrr..o.', 'o..r....r..o', '.o..rrrr..o.', '..o......o..'],
  };
  G.SKICON = {};
  for (const k in SKI) G.SKICON[k] = build(SKI[k], SK_PAL2);

  // ===================== 数字フォント =====================
  const DIG = {
    '0': ['111', '101', '101', '101', '111'], '1': ['01', '11', '01', '01', '01'], '2': ['111', '001', '111', '100', '111'],
    '3': ['111', '001', '011', '001', '111'], '4': ['101', '101', '111', '001', '001'], '5': ['111', '100', '111', '001', '111'],
    '6': ['111', '100', '111', '101', '111'], '7': ['111', '001', '010', '010', '010'], '8': ['111', '101', '111', '101', '111'],
    '9': ['111', '101', '111', '001', '111'], 'K': ['101', '110', '100', '110', '101'], 'M': ['10001', '11011', '10101', '10001', '10001'],
    '.': ['0', '0', '0', '0', '1'], '+': ['000', '010', '111', '010', '000'], '-': ['000', '000', '111', '000', '000'],
  };
  const digCache = {};
  G.digits = function (color) {
    if (digCache[color]) return digCache[color];
    const o = {};
    for (const ch in DIG) o[ch] = hi(DIG[ch], { '1': color });
    return digCache[color] = o;
  };
  G.numWidth = str => { let w = 0; for (const ch of str) w += (DIG[ch] ? DIG[ch][0].length : 3) + 1; return w - 1; };

  // ===================== 地形装飾・その他 =====================
  const FL_PAL = { r: '#d9481f', y: '#ff9b2f', Y: '#ffd35a', W: '#fff4c0' };
  // 炎：赤→橙→黄→白の層を重ね、コマごとに先端が揺らぐ（6コマ）
  G.FLAMES = [0, 1, 2, 3, 4, 5].map(f => {
    const W = 20, Hh = 24, c = G.canvas(W, Hh), x = c.getContext('2d'), img = x.createImageData(W, Hh), d = img.data;
    const layers = [['#c9361a', 1], ['#f07a22', .78], ['#ffc140', .55], ['#fff2c0', .3]];
    for (let py = 0; py < Hh; py++) for (let px = 0; px < W; px++) {
      const u = (px + .5 - W / 2) / (W / 2), v = (py + .5) / Hh; // v:0=先端 1=根元
      const sway = Math.sin(v * 5 + f * 1.05) * .22 * (1 - v), wid = Math.pow(v, .7) * (1 - Math.pow(v, 6) * .5);
      const r = Math.abs(u - sway) / Math.max(.05, wid);
      for (let k = layers.length - 1; k >= 0; k--) {
        const [cc, s] = layers[k];
        if (r < s && v > (1 - s) * .55 + (k === 0 ? .05 * Math.sin(f * 2 + px) : 0)) { const i = (py * W + px) * 4, rgb = G.rgb(cc); d[i] = rgb[0]; d[i + 1] = rgb[1]; d[i + 2] = rgb[2]; d[i + 3] = 255; break; }
      }
    }
    x.putImageData(img, 0, 0);
    return c;
  });
  G.BRACKET = hi(['.kk.', 'kggk', '.kk.', '..k.'], { k: '#3a3440', g: '#8a7a50' });
  G.CAMPFIRE = hi([
    '...n....n...',
    '..nNn..nNn..',
    '.nNNNnnNNNn.',
    'nNNnNNNNnNNn',
    '.nnnnnnnnnn.',
  ], { N: '#8e5a30', n: '#5a341a' });

  const DECO_PAL = { W: '#e8e0cc', w: '#b8ae98', g: '#5f8a3a', G: '#86b84e', s: '#7a7680', S: '#9a96a0', c: '#8fe0ff', C: '#d8f8ff', p: '#304a70' };
  G.DECO = {
    bones: hi(['W......', '.W..ww.', '..WWww.', '.w.W...', 'w...W..'], DECO_PAL, null),
    skull: hi(['.WWW.', 'WwWwW', 'WWWWW', '.WwW.'], DECO_PAL, '#2a2420'),
    pebble: hi(['.S...', 'Ss.S.', '...ss'], DECO_PAL, null),
    grass: hi(['G.g.G', '.GgG.', 'gGGgg'], DECO_PAL, null),
    crystal: hi(['..C..', '.cCc.', '.cCc.', 'ccCcc'], DECO_PAL, '#1a2438'),
  };

  // 影（楕円）
  const shCache = {};
  // 部屋の小物（旗・クモの巣・樽・木箱）
  G.PROPS = {
    web: hi(['w.w.w...', '.wWw....', 'wWWWw...', '.Ww.w...', 'w.w..w..', '.....w..', '......w.'], { w: '#8a8a94', W: '#b8b8c4' }, null),
    barrel: hi(['.nNNNNn.', 'nNNcNNNn', 'kkkkkkkk', 'nNNNNNNn', 'nNcNNNNn', 'nNNNNNNn', 'kkkkkkkk', 'nNNNNNNn', '.nnnnnn.'], { N: '#8a5a32', n: '#5a3a1e', c: '#a8744a', k: '#3a3440' }),
    crate: hi(['NNNNNNNN', 'NnNNNNnN', 'NNnNNnNN', 'NNNnnNNN', 'NNNnnNNN', 'NNnNNnNN', 'NnNNNNnN', 'NNNNNNNN'], { N: '#9a7040', n: '#6a4a26' }),
  };
  const bannerCache = {};
  G.banner = col => bannerCache[col] || (bannerCache[col] = hi(['kkkkkkkk', '.RRRRRR.', '.RrRRrR.', '.RRGGRR.', '.RGGGGR.', '.RRGGRR.', '.RrRRrR.', '.RRRRRR.', '.RR..RR.', '.R....R.'], { k: '#3a3440', R: col, r: '#00000033', G: '#e0b040' }));

  // 影は高解像度で作る（描画時は0.5倍）
  G.shadow = function (w) {
    w = Math.max(8, Math.round(w * 2));
    if (shCache[w]) return shCache[w];
    const h = Math.max(2, Math.round(w * 0.38)), c = G.canvas(w, h), x = c.getContext('2d'), img = x.createImageData(w, h);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const nx = (i + .5 - w / 2) / (w / 2), ny = (j + .5 - h / 2) / (h / 2);
      const d = nx * nx + ny * ny;
      // 中心が濃く縁へ薄くなる柔らかい接地影（光と反対の右下へ少し寄せる）
      const nx2 = (i + .5 - w * .56) / (w / 2), ny2 = (j + .5 - h * .56) / (h / 2), d2 = nx2 * nx2 + ny2 * ny2;
      if (d <= 1 || d2 <= 1) { const id = (j * w + i) * 4; img.data[id + 3] = d2 < .4 ? 120 : d < .55 ? 85 : 45; }
    }
    x.putImageData(img, 0, 0);
    return shCache[w] = c;
  };
})();
