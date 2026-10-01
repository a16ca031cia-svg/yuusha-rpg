'use strict';
// ===== UI（HUD・各画面） =====
(function () {
  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const ui = G.ui = {};
  let panel = null, sel = { slot: 'weapon', item: null, skSlot: 0, eqSort: 'rar' }, invView = { slot: 'all', rar: -1, af: '', sort: 'new', page: 0, q: '', mode: 'list', sel: new Set() };
  const rc = r => G.RARITY[r].c;
  // 技のアイコン：キャラ専用技は、動きの種類のアイコンを属性の色に染めて使う
  const iconCache = {};
  G.skIcon = id => {
    if (G.SKICON[id]) return G.SKICON[id];
    if (iconCache[id]) return iconCache[id];
    const sk = G.SKILLS[id], base = G.SKICON[sk.kind] || G.SKICON.dash, c = G.canvas(base.width, base.height), x = c.getContext('2d');
    x.drawImage(base, 0, 0); x.globalCompositeOperation = 'source-atop'; x.globalAlpha = .55; x.fillStyle = sk.col || '#fff'; x.fillRect(0, 0, c.width, c.height);
    return iconCache[id] = c;
  };
  const TOUCH = G.TOUCH = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window; // スマホ・タブレット

  // ------------------------------------------------------------ HUD
  ui.init = function () {
    // 技アイコンは refreshSkills で覚えた技の数だけ並べる
    document.querySelectorAll('#menu button[data-p]').forEach(b => b.onclick = () => ui.open(b.dataset.p));
    $('spdBtn').onclick = () => { const s = G.S.settings; s.speed = s.speed >= 4 ? 1 : s.speed * 2; ui.refreshSpeed(); G.save(); };
    $('bgmBtn').onclick = () => { const s = G.S.settings; s.muteBgm = !s.muteBgm; G.setVolume(); ui.refreshSound(); G.save(); };
    $('seBtn').onclick = () => { const s = G.S.settings; s.muteSe = !s.muteSe; G.setVolume(); ui.refreshSound(); G.save(); };
    $('mClose').onclick = () => ui.close();
    $('departBtn').onclick = () => G.depart(false, G.checkpoint());
    $('resumeBtn').onclick = () => G.depart(true);
    $('waitBtn').onclick = () => { G.S.settings.waitHome = !G.S.settings.waitHome; ui.refreshHome(); G.save(); };
    $('modal').addEventListener('pointerdown', e => { if (e.target.id === 'modal') ui.close(); });
    window.addEventListener('keydown', e => {
      if (e.key === 'Escape') { if (!$('confirm').classList.contains('hidden')) $('cNo').click(); else ui.close(); }
      if (e.target.tagName === 'INPUT') return;
      if (e.key === 'e' || e.key === 'E') ui.toggle('equip');
      if (e.key === 'k' || e.key === 'K') ui.toggle('skill');
      if (e.key === 'i' || e.key === 'I') ui.toggle('inv');
    });
    ui.refreshSkills(); ui.refreshSpeed(); ui.refreshSound(); ui.onMode(); ui.upgradeCheck();
    // タイトル画面：クリック（タップ）で閉じる（同時に音声が有効になる）
    if (TOUCH) { const ts = document.querySelector('#title .tStart'); if (ts) ts.textContent = 'タップでスタート'; document.body.classList.add('touch'); }
    ui.titleOn = true; document.body.classList.add('titleMode');
    $('title').addEventListener('click', () => {
      ui.titleOn = false; $('title').classList.add('out'); document.body.classList.remove('titleMode');
      setTimeout(() => $('title').remove(), 800);
      setTimeout(() => G.sfx('depart'), 60);
    });
    // ボタンのクリック音
    document.addEventListener('click', e => { if (e.target.closest('button')) G.sfx('click'); });
    // ブラウザの仕様で、最初の操作までは音が出せないことを知らせる
    const sh = document.createElement('div'); sh.id = 'soundHint'; sh.textContent = TOUCH ? '♪ タップでサウンドON' : '♪ クリックでサウンドON'; document.getElementById('hud').appendChild(sh);
  };
  // 音が鳴っている間は案内を隠し、止まったら（スマホでアプリを切り替えた後など）もう一度出す
  ui.audioReady = () => { const e = document.getElementById('soundHint'); if (e) e.classList.add('hidden'); };
  ui.audioLost = () => { const e = document.getElementById('soundHint'); if (e) e.classList.remove('hidden'); };
  ui.refreshSpeed = () => { $('spdBtn').innerHTML = '<span class="lbl">速さ</span>×' + G.S.settings.speed; }; // 何の「×」か分かるように（スマホの狭い画面では「速さ」を省く）
  // 画面下の技アイコン：覚えた技をすべて並べる（OFFにした技は暗く）。まだ何も覚えていなければ案内を1つ
  ui.refreshSkills = function () {
    const S = G.S, box = $('skills'); box.innerHTML = '';
    const ids = G.charSkills().filter(id => S.learned.includes(id));
    if (!ids.length) { const d = document.createElement('div'), nl = Math.min(...G.charSkills().map(id => G.SKILLS[id].lv || 1)); d.className = 'sk empty'; d.innerHTML = `<div class="nm">Lv${nl}で<br>技を習得</div>`; d.title = 'レベルが上がると技を覚えます'; d.onclick = () => ui.open('skill'); box.appendChild(d); return; }
    for (const id of ids) {
      const d = document.createElement('div'), off = !!(S.skillOff || {})[id], I = G.skillInfo(id);
      d.className = 'sk' + (off ? ' empty' : '') + (I.stage ? ' skstage' + I.stage : ''); d.dataset.id = id;
      d.innerHTML = `<canvas width="14" height="14"></canvas><div class="cd"></div><div class="cdt"></div><div class="nm">${off ? 'OFF' : I.name}</div>`;
      d.title = I.name + '（技Lv' + I.lv + '）\n' + G.SKILLS[id].desc + '\n自動使用：' + G.SKILLS[id].cond + (off ? '\n（使わない設定）' : '');
      d.onclick = () => ui.open('skill');
      const x = d.querySelector('canvas').getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(G.skIcon(id), 0, 0);
      box.appendChild(d);
    }
  };
  ui.skillFlash = function (id) {
    const d = document.querySelector(`#skills .sk[data-id="${id}"]`); if (!d) return;
    d.classList.remove('flash'); void d.offsetWidth; d.classList.add('flash');
  };
  ui.onMode = function () {
    const home = G.S.mode === 'home';
    $('home').classList.toggle('hidden', !home);
    ui.refreshHome();
  };
  ui.refreshHome = function () {
    const S = G.S;
    $('homeMsg').innerHTML = S.homeMsg ? esc(S.homeMsg) : S.stats.runs === 0
      ? '勇者は自動で探索・戦闘します。<br><span class="small">ダンジョンで集めたコインで「ガチャ」を引いて、装備と仲間を手に入れよう。覚えた技はすべて自動で使います。</span>'
      : 'ダンジョンへ挑む準備はできている。';
    const lr = S.lastRun;
    const tm = s => Math.floor(s / 60) + '分' + String(s % 60).padStart(2, '0') + '秒';
    $('homeStats').innerHTML = (lr ? `<div class="lastRun">今回の挑戦：<b>B${lr.floor}F</b> 到達　撃破 <b>${lr.kills}</b>　最大 <b>${lr.best}</b> コンボ　装備 <b>${lr.items}</b> 個　${tm(lr.t)}</div>` : '')
      + `最深到達 <b>B${S.maxFloor}F</b>　/　総討伐数 ${S.stats.kills}　/　挑戦 ${S.stats.runs}回`;
    // 中断した挑戦があれば「続きから」を主ボタンに
    const rr = G.resumeRun;
    $('resumeBtn').classList.toggle('hidden', !rr);
    if (rr) $('resumeBtn').textContent = '続きから突入（B' + rr.floor + 'F）';
    $('departBtn').textContent = rr ? 'B1Fから突入' : '突入';
    $('departBtn').classList.toggle('primary', !rr);
    $('waitBtn').textContent = 'ホームで待機: ' + (S.settings.waitHome ? 'ON' : 'OFF');
    $('waitBtn').classList.toggle('on', S.settings.waitHome);
  };

  let lagW = 100, hudT = 0, powShown = -1, powTarget = 0;
  ui.update = function (dt) {
    const S = G.S, H = G.hero, W = G.W;
    if (!H || !H.st) return;
    // タイトルの勇者（ゲーム中と同じ合成・アニメーションを拡大表示）
    if (ui.titleOn) {
      const c = $('titleHero'), x = c.getContext('2d');
      x.clearRect(0, 0, 144, 144); x.imageSmoothingEnabled = false;
      const f = H.face; H.face = 1;
      const HF = G.HERO_FRAME, fr = G.heroFrame(H); x.drawImage(fr.n, (fr.ox || HF.OX) - 64, (fr.oy || HF.OY) - 126, 136, 136, 4, 4, 136, 136);
      H.face = f;
    }
    const mh = H.st.maxHp, hp = Math.max(0, H.hp);
    const pc = hp / mh * 100;
    $('hpFill').style.width = pc + '%';
    if (pc < lagW) { $('hpLag').style.width = lagW + '%'; lagW = pc; setTimeout(() => $('hpLag').style.width = pc + '%', 20); } else { lagW = pc; $('hpLag').style.width = pc + '%'; }
    $('shFill').style.width = Math.min(100, H.shield / mh * 100) + '%';
    // コンボ表示（毎フレーム：数字のはね・残り時間バー）
    const cb = G.combo, show = cb.n >= 3 && S.mode === 'dungeon';
    const ce = $('combo');
    ce.classList.toggle('show', show); ce.classList.toggle('hot', cb.n >= 30);
    ce.classList.toggle('t2', cb.n >= 10 && cb.n < 30); ce.classList.toggle('t3', cb.n >= 30 && cb.n < 50); ce.classList.toggle('t4', cb.n >= 50);
    if (show) {
      $('comboN').textContent = cb.n;
      $('comboN').style.transform = `scale(${1 + cb.pop * (.45 + Math.min(.5, cb.n / 100))}) rotate(${(cb.pop > .5 ? (cb.n % 2 ? 1 : -1) * cb.pop * 6 : 0).toFixed(1)}deg)`; // 撃破ごとに跳ねて傾く
      $('comboBar').style.width = Math.max(0, cb.t / 2.5 * 100) + '%';
      $('comboBonus').textContent = `経験値 +${Math.round(Math.min(.5, (cb.n - 1) * .02) * 100)}%`;
    }
    hudT -= dt;
    if (hudT > 0) return;
    hudT = .1;
    // 総合力：上がったら数字が跳ね、差分が「▲+」で浮かぶ。表示の数字は目標へ向けてカウントアップ
    const pw = G.powerOf(H.st);
    if (powShown < 0) powShown = pw;
    else if (powTarget > 0 && pw > powTarget * 1.0005) {
      const u = $('powUp'); u.textContent = '▲ +' + G.fmtBig(pw - powTarget); u.classList.remove('go'); void u.offsetWidth; u.classList.add('go');
      const bb = $('powTxt'); bb.classList.remove('bump'); void bb.offsetWidth; bb.classList.add('bump');
    }
    powTarget = pw;
    powShown += (pw - powShown) * .35; if (Math.abs(pw - powShown) <= Math.max(1, pw * .002)) powShown = pw;
    $('powTxt').textContent = G.fmtBig(powShown); $('powBox').title = '総合力 ' + Math.round(pw).toLocaleString();
    $('hpTxt').textContent = Math.ceil(hp) + ' / ' + mh + (H.shield > 0 ? `  (+${Math.round(H.shield)})` : '');
    $('lvTxt').textContent = S.level;
    $('expFill').style.width = (S.exp / G.expNeed(S.level) * 100) + '%';
    $('floorTxt').textContent = S.mode === 'home' ? 'ホーム' : 'B' + (W ? W.f : 1) + 'F';
    $('bestTxt').textContent = '最深 B' + S.maxFloor + 'F';
    $('goldTxt').textContent = 'コイン ' + S.coins.toLocaleString() + '枚';
    const pr = G.progress();
    $('progTxt').textContent = pr ? (pr.complete ? '探索完了 → 下り階段へ' : `部屋 ${pr.rooms}/${pr.roomsT}　敵 残り${pr.enemies}　宝箱 ${pr.chests}`) + (H.rush ? '　≫疾走中' : '') : '';
    // 技クールダウン
    for (const d of document.querySelectorAll('#skills .sk[data-id]')) {
      const id = d.dataset.id;
      const max = G.skillInfo(id).cd, cd = Math.max(0, H.cds[id] || 0);
      d.querySelector('.cd').style.setProperty('--p', (cd / max * 100) + '%');
      d.querySelector('.cdt').textContent = cd > 0 ? cd.toFixed(cd < 1 ? 1 : 0) : '';
    }
    // ボス
    const boss = W && W.boss && !W.boss.dead && W.boss.awake ? W.boss : null;
    $('bossBar').classList.toggle('hidden', !boss);
    if (boss) { $('bossName').textContent = boss.name; $('bossFill').style.width = (boss.hp / boss.maxHp * 100) + '%'; }
    // ホームの出発カウント
    if (S.mode === 'home') {
      $('homeTimer').textContent = G.trans ? '突入！' : G.manualStart ? '準備ができたら「突入」を押してください' : S.settings.waitHome ? '待機中（自動出発しません）' : `${Math.max(0, G.homeT).toFixed(1)} 秒後に自動で突入`;
    }
    ui.drawMini();
  };

  // ミニマップ
  let miniT = 0;
  ui.drawMini = function () {
    const W = G.W, H = G.hero; if (!W) return;
    miniT -= .1; if (miniT > 0 && !W.miniDirty) return;
    miniT = .3; W.miniDirty = false;
    const D = W.D, c = $('mini'), k = 3;
    if (W.home) { c.parentElement.style.visibility = 'hidden'; return; }
    c.parentElement.style.visibility = 'visible';
    if (c.width !== D.W * k || c.height !== D.H * k) { c.width = D.W * k; c.height = D.H * k; }
    const x = c.getContext('2d');
    if (!W.miniBase || W.miniBaseDirty !== W.exploredVer) {
      x.fillStyle = '#07060b'; x.fillRect(0, 0, c.width, c.height);
      for (let i = 0; i < D.W * D.H; i++) {
        if (!W.explored[i]) continue;
        const tx = i % D.W, ty = (i / D.W) | 0;
        if (D.tiles[i] === 1) { x.fillStyle = W.vis[i] ? '#6a6480' : '#44405a'; x.fillRect(tx * k, ty * k, k, k); }
        else { x.fillStyle = '#1e1b28'; x.fillRect(tx * k, ty * k, k, k); }
      }
    }
    if (D.stairs && W.explored[D.stairs.ty * D.W + D.stairs.tx]) {
      x.fillStyle = W.complete ? '#9fdcff' : '#5aa0d0'; x.fillRect(D.stairs.tx * k - 1, D.stairs.ty * k - 1, k + 2, k + 2);
    }
    for (const ch of W.chests) {
      const i = G.tileOfD(D, ch.x, ch.y); if (!W.explored[i] || ch.opened) continue;
      x.fillStyle = '#ffd84d'; x.fillRect(Math.floor(ch.x / 16) * k, Math.floor(ch.y / 16) * k, k, k);
    }
    for (const e of W.enemies) {
      const i = G.tileOfD(D, e.x, e.y); if (e.dead || !W.vis[i]) continue;
      x.fillStyle = e.boss ? '#ff9a3c' : '#e04a3a'; x.fillRect(Math.floor(e.x / 16) * k, Math.floor(e.y / 16) * k, k - 1, k - 1);
    }
    x.fillStyle = '#ffffff'; x.fillRect(Math.floor(H.x / 16) * k - 1, Math.floor(H.y / 16) * k - 1, k + 1, k + 1);
  };

  // 戦利品通知
  const lootQ = [];
  ui.loot = function (it, note) {
    const box = $('loot');
    const d = document.createElement('div'); d.className = 'lootItem'; d.style.borderLeftColor = rc(it.rar);
    const af = it.af.map(a => G.AFX[a.k].n + ' Lv' + a.lv).join(' / ');
    d.innerHTML = `<img src="${G.iconURL(it.slot)}"><div style="min-width:0"><div class="ln" style="color:${rc(it.rar)}">${esc(it.name)}</div><div class="la">${note ? esc(note) : esc(af || G.RARITY[it.rar].n)}</div></div>`;
    // クリックで装備画面を開いてその装備と比較できる
    if (!note) { d.style.pointerEvents = 'auto'; d.style.cursor = 'pointer'; d.title = 'クリックで装備画面で比較'; d.onclick = () => { if (!G.itemById(it.id)) return; sel.slot = it.slot === 'acc' ? 'acc1' : it.slot; sel.item = it.id; ui.open('equip'); }; }
    box.appendChild(d); lootQ.push(d);
    while (lootQ.length > 6) { const o = lootQ.shift(); o.remove(); }
    setTimeout(() => { d.classList.add('out'); setTimeout(() => { d.remove(); const i = lootQ.indexOf(d); if (i >= 0) lootQ.splice(i, 1); }, 500); }, 4200 + it.rar * 800);
  };
  // 装着中より評価の高い新着装備があれば「装備」ボタンに印を付ける（自動で付け替えはしない）
  ui.curScore = type => {
    const S = G.S;
    if (type === 'acc') { const a = G.itemById(S.equip.acc1), b = G.itemById(S.equip.acc2); return Math.min(a ? G.itemScore(a) : 0, b ? G.itemScore(b) : 0); }
    const it = G.itemById(S.equip[type]); return it ? G.itemScore(it) : 0;
  };
  ui.upgradeCheck = function () {
    const cache = {}, S = G.S;
    let n = 0;
    for (const it of S.items) {
      if (!it.nw || G.isEquipped(it.id)) continue;
      if (cache[it.slot] == null) cache[it.slot] = ui.curScore(it.slot);
      if (G.itemScore(it) > cache[it.slot]) n++;
    }
    const b = document.querySelector('#menu button[data-p="equip"]');
    b.classList.toggle('badge', n > 0);
    b.dataset.n = n;
  };
  ui.invChanged = function () { if (panel === 'inv' || panel === 'equip') ui.render(); ui.upgradeCheck(); };
  let bannerTO = null, toastTO = null;
  ui.banner = function (a, b) {
    $('bannerTop').textContent = a; $('bannerSub').textContent = b || '';
    const el = $('banner'); el.classList.add('show');
    clearTimeout(bannerTO); bannerTO = setTimeout(() => el.classList.remove('show'), 2200);
  };
  // 画面中央に大きな文字を出す（1文字ずつ弾けて出る・集中線・残像）。
  // 優先度の高い演出（撃破・レベルアップ）が出ている間は、低いもの（コンボ）で上書きしない
  const TONES = {
    gold: ['#fff1a8', '#b86a10', 'rgba(255,200,80,.9)', 'rgba(255,230,150,.55)'],
    red: ['#ffd2b8', '#b0201a', 'rgba(255,90,50,.95)', 'rgba(255,140,90,.55)'],
    blue: ['#d8f4ff', '#1f5fae', 'rgba(90,190,255,.9)', 'rgba(150,220,255,.5)'],
    pink: ['#ffd6f4', '#a0188a', 'rgba(255,90,220,.95)', 'rgba(255,150,230,.55)'],
    orange: ['#ffe2b0', '#a8480c', 'rgba(255,150,50,.9)', 'rgba(255,190,120,.5)'],
  };
  let coTO = 0, coOutTO = 0, coPrio = -1, coUntil = 0;
  ui.callout = function (o) {
    const now = performance.now();
    if (now < coUntil && (o.prio || 0) < coPrio) return; // もっと大事な演出が表示中
    const el = $('callout'), main = el.querySelector('.coMain'), sub = el.querySelector('.coSub'), rays = el.querySelector('.coRays');
    const t = TONES[o.tone] || TONES.gold, fx = G.S.settings.fx;
    el.style.setProperty('--c1', t[0]); el.style.setProperty('--c2', t[1]); el.style.setProperty('--glow', t[2]); el.style.setProperty('--ray', t[3]);
    el.style.setProperty('--sz', o.size || 1);
    main.dataset.t = o.text;
    main.innerHTML = [...o.text].map((ch, i) => `<span style="--i:${i}">${ch === ' ' ? '&nbsp;' : esc(ch)}</span>`).join('');
    sub.textContent = o.sub || '';
    // アニメーションを最初からやり直す
    el.classList.remove('on', 'out'); rays.classList.remove('go'); sub.style.animation = 'none'; void el.offsetWidth; sub.style.animation = '';
    el.classList.add('on'); if (fx > 0 && o.rays !== false) rays.classList.add('go');
    if (o.flash && fx > 0) ui.flash(o.flash, o.flashCol);
    const dur = (o.dur || 1.3) * 1000;
    coPrio = o.prio || 0; coUntil = now + dur;
    clearTimeout(coTO); clearTimeout(coOutTO);
    coTO = setTimeout(() => { el.classList.add('out'); coOutTO = setTimeout(() => { el.classList.remove('on', 'out'); coPrio = -1; }, 330); }, dur);
  };
  ui.flash = function (a, col) {
    const f = $('flash'); f.style.setProperty('--fa', a); f.style.setProperty('--fc', col || '#fff');
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  };
  // BGM・効果音のON/OFF（下のメニューに常に表示）
  ui.refreshSound = function () {
    const s = G.S.settings;
    $('bgmBtn').classList.toggle('off', !!s.muteBgm); $('bgmBtn').title = s.muteBgm ? 'BGMを再生' : 'BGMをミュート';
    $('seBtn').classList.toggle('off', !!s.muteSe); $('seBtn').title = s.muteSe ? '効果音を再生' : '効果音をミュート';
  };
  ui.toast = function (msg) {
    const el = $('toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTO); toastTO = setTimeout(() => el.classList.remove('show'), 1900);
  };
  ui.confirm = function (msg, yes) {
    $('cMsg').textContent = msg; $('confirm').classList.remove('hidden');
    $('cYes').onclick = () => { $('confirm').classList.add('hidden'); yes(); };
    $('cNo').onclick = () => $('confirm').classList.add('hidden');
  };

  // ------------------------------------------------------------ 画面（開いている間は一時停止）
  const TABS = [['equip', '装備'], ['skill', '技'], ['chara', 'キャラ'], ['gacha', 'ガチャ'], ['inv', '所持品'], ['set', '設定']];
  ui.toggle = p => { if (panel === p) ui.close(); else ui.open(p); };
  ui.open = function (p) {
    panel = p; G.paused = true;
    $('modal').classList.remove('hidden');
    $('tabs').innerHTML = TABS.map(([k, n]) => `<button data-t="${k}" class="${k === p ? 'act' : ''}">${n}</button>`).join('');
    $('tabs').querySelectorAll('button').forEach(b => b.onclick = () => ui.open(b.dataset.t));
    ui.render();
  };
  ui.close = function () {
    if (!panel) return;
    const was = panel;
    panel = null; G.paused = false; $('modal').classList.add('hidden');
    if (was === 'equip' || was === 'inv') for (const it of G.S.items) it.nw = false;
    ui.upgradeCheck();
    G.save();
  };
  ui.isOpen = () => !!panel;
  ui.render = function () {
    const b = $('mBody');
    if (panel === 'equip') renderEquip(b);
    else if (panel === 'skill') renderSkill(b);
    else if (panel === 'inv') renderInv(b);
    else if (ui.extra && ui.extra[panel]) ui.extra[panel](b); // キャラ・ガチャ（ui_gacha.js）
    else if (panel === 'set') renderSet(b);
  };

  // 能力値表示
  const STAT_ROWS = [['maxHp', '最大HP', v => Math.round(v)], ['atk', '攻撃力', v => v.toFixed(1)], ['def', '防御力', v => v.toFixed(1)], ['aspd', '攻撃速度', v => v.toFixed(2) + '/秒'],
    ['crit', '会心率', v => (v * 100).toFixed(1) + '%'], ['critd', '会心威力', v => (v * 100).toFixed(0) + '%'], ['mspd', '移動速度', v => v.toFixed(0)], ['reach', '射程', v => v.toFixed(0)]];
  function statGrid(st) { return `<div class="stats">${STAT_ROWS.map(([k, n, f]) => `<span>${n}</span><span>${f(st[k])}</span>`).join('')}</div>`; }
  function effList(st) {
    const ks = Object.keys(st.fx).sort((a, b) => st.fx[b] - st.fx[a]);
    if (!ks.length) return '<div class="small">付与効果なし</div>';
    return `<div class="effList">${ks.map(k => `<div><span class="lvtag">${G.AFX[k].n} Lv${st.fx[k]}</span> <span class="small">${esc(G.AFX[k].d(st.fx[k]))}</span></div>`).join('')}</div>`;
  }
  function itemStats(it) {
    const s = it.st, out = [];
    if (s.atk) out.push('攻撃 +' + s.atk);
    if (s.def) out.push('防御 +' + s.def);
    if (s.hp) out.push('HP +' + s.hp);
    if (s.aspd) out.push('攻速 ' + (s.aspd > 0 ? '+' : '') + Math.round(s.aspd * 100) + '%');
    if (s.mspd) out.push('移動 +' + Math.round(s.mspd * 100) + '%');
    if (s.crit) out.push('会心 +' + (s.crit * 100).toFixed(1) + '%');
    return out.join('　');
  }
  function itemCard(it, extra) {
    if (!it) return `<div class="card"><div class="small">装備なし</div></div>`;
    return `<div class="card" style="border-color:${rc(it.rar)}66">
      <div class="row"><img class="ic" src="${G.iconURL(it.slot)}" style="border-color:${rc(it.rar)}"><div>
      <div class="ttl" style="color:${rc(it.rar)}">${esc(it.name)} ${it.fav ? '<span class="star on">★</span>' : ''}</div>
      <div class="meta">${G.RARITY[it.rar].n}・${G.SLOT_N[it.slot]}・B${it.f}F産・評価 ${G.itemScore(it)}・売値 ${G.itemValue(it)}G</div></div></div>
      <div class="st">${itemStats(it)}</div>
      <div class="afl">${it.af.map(a => `<div><span class="lvtag">${G.AFX[a.k].n} Lv${a.lv}</span> <span class="small">${esc(G.AFX[a.k].d(a.lv))}</span></div>`).join('') || '<span class="small">付与効果なし</span>'}</div>
      ${it.set ? setBox(it.set) : ''}
      ${extra || ''}</div>`;
  }
  // セット効果の説明（装着中の数で有効なものを緑に）
  function setBox(k) {
    const T = G.SETS[k], n = (G.hero.st.sets || {})[k] || 0;
    return `<div class="setbox"><span style="color:${T.col}">◆ ${T.full}</span> <span class="small">装着中 ${n}個</span>${Object.keys(T.b).map(need => `<div class="${n >= +need ? 'on' : 'offb'}">${need}個：${esc(T.b[need].t)}</div>`).join('')}</div>`;
  }
  function activeSets(st) {
    const ks = Object.keys(st.sets || {});
    if (!ks.length) return '';
    return `<div class="h" style="margin-top:8px">セット効果</div>` + ks.map(k => setBox(k)).join('');
  }
  function diffHtml(slot, id) {
    const S = G.S, cur = G.calcStats(S.equip);
    const eq = Object.assign({}, S.equip);
    const other = G.isEquipped(id); if (other && other !== slot) eq[other] = eq[slot];
    eq[slot] = id;
    const nx = G.calcStats(eq);
    const rows = [];
    const p0 = G.powerOf(cur), p1 = G.powerOf(nx); // 総合力の変化を一番上に
    if (p0 !== p1) rows.push(`<div style="font-size:14px">総合力: ${G.fmtBig(p0)} → <span class="${p1 > p0 ? 'up' : 'down'}">${G.fmtBig(p1)} ${p1 > p0 ? '▲' : '▼'}</span></div>`);
    for (const [k, n, f] of STAT_ROWS) {
      const a = cur[k], b = nx[k]; if (Math.abs(a - b) < 1e-6) continue;
      rows.push(`<div>${n}: ${f(a)} → <span class="${b > a ? 'up' : 'down'}">${f(b)} ${b > a ? '▲' : '▼'}</span></div>`);
    }
    const keys = new Set([...Object.keys(cur.fx), ...Object.keys(nx.fx)]);
    for (const k of keys) {
      const a = cur.fx[k] || 0, b = nx.fx[k] || 0; if (a === b) continue;
      rows.push(`<div>${G.AFX[k].n}: Lv${a} → <span class="${b > a ? 'up' : 'down'}">Lv${b} ${b > a ? '▲' : '▼'}</span></div>`);
    }
    return `<div class="diff">${rows.length ? '<div class="h">装備した場合</div>' + rows.join('') : '<div class="small">変化なし</div>'}</div>`;
  }

  // ---------- 装備画面
  function renderEquip(b) {
    const S = G.S, H = G.hero;
    const st = H.st;
    const slots = G.SLOTS.map(s => {
      const it = G.itemById(S.equip[s]);
      return `<div class="slot ${sel.slot === s ? 'sel' : ''}" data-s="${s}"><div class="sn">${G.SLOT_N[s]}</div>
        ${it ? `<img class="ic" src="${G.iconURL(it.slot)}" style="border-color:${rc(it.rar)}"><div style="min-width:0;flex:1"><div class="nm" style="color:${rc(it.rar)};font-size:13px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(it.name)}</div><div class="small">${itemStats(it)}</div></div>` : '<div class="small">― 空き ―</div>'}</div>`;
    }).join('');
    const type = G.slotType(sel.slot);
    // 候補の並び：レア度順（同じレア度は評価の高い順）／評価順／新しい順
    const EQS = { rar: (x, y) => y.rar - x.rar || G.itemScore(y) - G.itemScore(x), score: (x, y) => G.itemScore(y) - G.itemScore(x), new: (x, y) => (y.nw - x.nw) || y.id - x.id };
    const cands = S.items.filter(it => it.slot === type && S.equip[sel.slot] !== it.id).sort(EQS[sel.eqSort] || EQS.rar);
    const rec = G.recommendEquip(), recId = rec.plan[sel.slot] !== S.equip[sel.slot] ? rec.plan[sel.slot] : null; // この部位のおすすめ
    if (sel.item && !cands.find(c => c.id === sel.item)) sel.item = null;
    const selIt = sel.item ? G.itemById(sel.item) : null;
    const curIt = G.itemById(S.equip[sel.slot]);
    b.innerHTML = `
      <div class="col eqA" style="width:300px;flex:none">
        <div class="row" style="justify-content:space-between"><span class="h">装備枠</span><button id="recBtn" class="${rec.changes.length ? 'primary' : ''}" ${rec.changes.length ? '' : 'disabled'} title="部位ごとに評価値が最も高い装備に付け替えます">おすすめ一括装備${rec.changes.length ? `（${rec.changes.length}部位）` : ''}</button></div>
        <div class="row" style="justify-content:space-between"><span class="small">新しい装備を拾ったら自動でおすすめに付け替え</span><button id="autoEqBtn" class="${S.settings.autoEquip ? 'on' : ''}">自動装着 ${S.settings.autoEquip ? 'ON' : 'OFF'}</button></div>${slots}
        <div class="h" style="margin-top:6px">能力値</div>${statGrid(st)}
      </div>
      <div class="col scroll eqB" style="width:300px;flex:none">
        <div class="h">総合力 <span style="font-size:18px;color:#ffe9a0">${G.fmtBig(G.powerOf(st))}</span></div>
        <div class="h">付与効果（実効レベル＝装着中の合算）</div>${effList(st)}${activeSets(st)}
        <div class="h" style="margin-top:8px">現在の${G.SLOT_N[sel.slot]}</div>
        ${itemCard(curIt, curIt ? `<div class="btnrow" style="margin-top:6px"><button data-act="fav" data-id="${curIt.id}">${curIt.fav ? '★ お気に入り解除' : '☆ お気に入り'}</button><button data-act="unequip">外す</button></div>` : '')}
      </div>
      <div class="col eqC" style="flex:1;min-width:0">
        <div class="row" style="justify-content:space-between"><span class="h">${G.SLOT_N[type]}の候補（${cands.length}件）</span><span class="row"><select id="eqSort">${[['rar', 'レア度順'], ['score', '評価順'], ['new', '新しい順']].map(([k, n]) => `<option value="${k}" ${sel.eqSort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>${recId ? `<button id="recOne" class="primary">おすすめを装備</button>` : ''}</span></div>
        ${selIt ? itemCard(selIt, diffHtml(sel.slot, selIt.id) + `<div class="btnrow" style="margin-top:6px"><button class="primary" data-act="equip" data-id="${selIt.id}">装備する</button><button data-act="fav" data-id="${selIt.id}">${selIt.fav ? '★ 解除' : '☆ お気に入り'}</button>${disBtns(selIt)}</div>`) : '<div class="small">候補をタップ（クリック）すると比較できます</div>'}
        <div class="col scroll" style="flex:1">${cands.slice(0, 80).map(it => itemRow(it, sel.item === it.id, curIt ? G.itemScore(curIt) : 0, it.id === recId)).join('') || '<div class="small">候補がありません</div>'}</div>
      </div>`;
    $('eqSort').onchange = e => { sel.eqSort = e.target.value; ui.render(); };
    $('autoEqBtn').onclick = () => { S.settings.autoEquip = !S.settings.autoEquip; if (S.settings.autoEquip) G.autoEquip(); G.save(); ui.render(); };
    if ($('recOne')) $('recOne').onclick = () => { G.equipItem(sel.slot, recId); sel.item = null; G.sfx('pickup', 3); ui.toast('おすすめ装備に変更しました'); ui.render(); ui.upgradeCheck(); };
    const rb = $('recBtn');
    if (rb) rb.onclick = () => {
      const r = G.recommendEquip(); if (!r.changes.length) return;
      const cur = G.calcStats(S.equip), nx = G.calcStats(r.plan);
      const lines = r.changes.map(s => `${G.SLOT_N[s]}：${G.itemById(r.plan[s]).name}`).join('\n');
      ui.confirm(`次の${r.changes.length}部位を付け替えます。\n${lines}\n\n最大HP ${cur.maxHp} → ${nx.maxHp}　攻撃力 ${cur.atk} → ${nx.atk}　防御力 ${cur.def} → ${nx.def}`, () => {
        G.applyEquip(r.plan); G.sfx('pickup', 3); ui.toast('おすすめ装備に変更しました'); ui.render(); ui.upgradeCheck();
      });
    };
    b.querySelectorAll('.slot').forEach(el => el.onclick = () => { sel.slot = el.dataset.s; sel.item = null; ui.render(); });
    b.querySelectorAll('.it').forEach(el => el.onclick = e => { if (e.target.classList.contains('star')) return; sel.item = +el.dataset.id; ui.render(); });
    bindCommon(b);
  }
  function itemRow(it, selected, cmp, recommended) {
    const eq = G.isEquipped(it.id);
    const better = cmp != null && G.itemScore(it) > cmp ? '<span class="up" title="評価値が現在の装備より高い">▲</span>' : '';
    return `<div class="it ${selected ? 'sel' : ''}" data-id="${it.id}">
      <img class="ic" src="${G.iconURL(it.slot)}" style="border-color:${rc(it.rar)}">
      <div class="grow"><div class="nm" style="color:${rc(it.rar)}">${better}${esc(it.name)} ${recommended ? '<span class="rectag">おすすめ</span>' : ''} ${it.nw ? '<span class="newtag">NEW</span>' : ''} ${eq ? `<span class="eqtag">${G.SLOT_N[eq]}装備中</span>` : ''}</div>
      <div class="af">${itemStats(it)}${it.af.length ? '　|　' + it.af.map(a => G.AFX[a.k].n + ' Lv' + a.lv).join(' / ') : ''}</div></div>
      <span class="small" style="text-align:right;white-space:nowrap"><span style="color:${rc(it.rar)}">${G.RARITY[it.rar].n}</span><br>B${it.f}F</span><span class="star ${it.fav ? 'on' : ''}" data-fav="${it.id}" title="お気に入り（分解から保護）">★</span></div>`;
  }
  // 分解・強化のボタン（どれかのキャラが装備中・お気に入りは分解できない）
  function disBtns(it) {
    const lock = it.fav || G.usedByAny(it.id), c = G.enhCost(it), mx = (it.enh || 0) >= G.ENH_MAX;
    return `<button data-act="enh" data-id="${it.id}" ${mx || G.S.mats.forge < c ? 'disabled' : ''} title="基礎性能 +10%">${mx ? '強化 最大' : `強化 +${(it.enh || 0) + 1}（素材 ${c}）`}</button><button data-act="sell1" data-id="${it.id}" ${lock ? 'disabled' : ''}>分解 +${G.disValue(it)}</button>`;
  }
  ui.disBtns = disBtns;
  ui.itemRow = (...a) => itemRow(...a); ui.itemCard = (...a) => itemCard(...a); ui.esc = esc; ui.panel = () => panel;
  function bindCommon(b) {
    b.querySelectorAll('[data-fav]').forEach(el => el.onclick = e => { e.stopPropagation(); const it = G.itemById(+el.dataset.fav); it.fav = !it.fav; G.save(); ui.render(); });
    b.querySelectorAll('[data-act]').forEach(el => el.onclick = () => {
      const a = el.dataset.act, id = +el.dataset.id;
      if (a === 'equip') { G.equipItem(sel.slot, id); sel.item = null; G.sfx('pickup', 1); }
      if (a === 'unequip') G.unequip(sel.slot);
      if (a === 'fav') { const it = G.itemById(id); it.fav = !it.fav; G.save(); }
      if (a === 'sell1') { const r = G.dismantle([id]); if (r.n) ui.toast(`分解しました　強化素材 +${r.m}`); sel.item = null; G.save(); }
      if (a === 'enh') { const err = G.enhance(id); ui.toast(err || '強化しました'); }
      ui.render(); ui.refreshSkills();
    });
  }

  // ---------- 技画面：覚えた技はすべて自動で使う。技ごとに使う・使わないを切り替えられる
  function renderSkill(b) {
    const S = G.S, H = G.hero; S.skillOff = S.skillOff || {};
    const n = S.learned.length, on = G.activeSkills().length;
    const list = G.charSkills().map(id => {
      const sk = G.SKILLS[id], learned = S.learned.includes(id), off = !!S.skillOff[id], I = G.skillInfo(id), E = G.skillEvo(id);
      // 次の進化：技Lv5・12になる勇者のレベル
      const nextNeed = G.SKILL_EVO_LV[I.stage], nextL = nextNeed ? sk.lv + (nextNeed - 1) * 3 : 0;
      const stars = '★'.repeat(I.stage + 1) + '☆'.repeat(2 - I.stage);
      const evo = learned ? `<span class="stars">${stars}</span> <span class="small">技Lv${I.lv}${nextL ? `　次の進化 Lv${nextL}：${E.names[I.stage + 1]}（${E.up[I.stage + 1]}）` : '　最終進化'}</span>` : `<span class="small">進化：${E.names.join(' → ')}</span>`;
      return `<div class="skcard ${learned ? '' : 'locked'} ${I.stage ? 'skstage' + I.stage : ''}"><canvas width="14" height="14" data-ic="${id}"></canvas>
        <div style="flex:1;min-width:0"><div>${learned ? I.name : sk.n} ${learned ? '' : `<span class="small">（Lv${sk.lv}で習得）</span>`}</div>
        <div>${evo}</div>
        <div class="d">${esc(sk.desc)}${I.stage ? '　' + esc(E.up.slice(1, I.stage + 1).join('・')) : ''}<br>自動使用：${esc(sk.cond)}　／　威力 攻撃力×${I.mult.toFixed(2)}　／　再使用 ${I.cd.toFixed(1)}秒</div></div>
        ${learned ? `<button data-tog="${id}" class="${off ? '' : 'on'}">${off ? '使わない' : '使う'}</button>` : ''}</div>`;
    }).join('');
    b.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="h">技（覚えた技はすべて自動で使います。レベル3ごとに技Lvが上がり、技Lv5・12で進化）</div>
      <div class="small">習得 ${n} / ${G.charSkills().length}　使用中 ${on}。戦闘中は、条件を満たした技のうち強い技（下の一覧の下の方）から使います。使いたくない技は「使わない」にできます。</div>
      <div class="col scroll" style="flex:1">${list}</div></div>`;
    b.querySelectorAll('canvas[data-ic]').forEach(c => { const x = c.getContext('2d'); x.imageSmoothingEnabled = false; x.drawImage(G.skIcon(c.dataset.ic), 0, 0); });
    b.querySelectorAll('[data-tog]').forEach(el => el.onclick = () => { const id = el.dataset.tog; S.skillOff[id] = !S.skillOff[id]; ui.refreshSkills(); G.save(); ui.render(); });
  }
  // ---------- 所持品画面
  function filteredItems() {
    const S = G.S, v = invView;
    let arr = S.items.filter(it => (v.slot === 'all' || it.slot === v.slot) && (v.rar < 0 || it.rar === v.rar) && (!v.af || it.af.some(a => a.k === v.af)) && (!v.q || it.name.includes(v.q)));
    const sorters = { new: (a, b) => b.id - a.id, rar: (a, b) => b.rar - a.rar || G.itemScore(b) - G.itemScore(a), score: (a, b) => G.itemScore(b) - G.itemScore(a), afl: (a, b) => G.itemMaxAf(b) - G.itemMaxAf(a) };
    return arr.sort(sorters[v.sort]);
  }
  function renderInv(b) {
    if (invView.mode === 'auto') return renderAuto(b);
    const S = G.S, v = invView, PER = 30;
    const arr = filteredItems();
    const pages = Math.max(1, Math.ceil(arr.length / PER)); v.page = Math.min(v.page, pages - 1);
    const view = arr.slice(v.page * PER, v.page * PER + PER);
    const afOpts = Object.keys(G.AFX).map(k => `<option value="${k}" ${v.af === k ? 'selected' : ''}>${G.AFX[k].n}</option>`).join('');
    const selIt = sel.item ? G.itemById(sel.item) : null;
    b.innerHTML = `<div class="col" style="flex:1;min-width:0">
      <div class="row">
        <select id="fSlot"><option value="all">全部位</option>${['weapon', 'head', 'body', 'feet', 'acc'].map(s => `<option value="${s}" ${v.slot === s ? 'selected' : ''}>${G.SLOT_N[s]}</option>`).join('')}</select>
        <select id="fRar"><option value="-1">全レア度</option>${G.RARITY.map((r, i) => `<option value="${i}" ${v.rar === i ? 'selected' : ''}>${r.n}</option>`).join('')}</select>
        <select id="fAf"><option value="">付与効果：すべて</option>${afOpts}</select>
        <select id="fSort">${[['new', '新しい順'], ['rar', 'レア度順'], ['score', '評価順'], ['afl', '付与Lv順']].map(([k, n]) => `<option value="${k}" ${v.sort === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
        <input type="text" id="fQ" placeholder="名前で検索" value="${esc(v.q)}" style="width:110px">
        <span class="small" style="margin-left:auto">所持 ${S.items.length}/${G.INV_CAP}　強化素材 ${S.mats.forge.toLocaleString()}</span>
      </div>
      <div class="row"><button id="autoBtn">自動分解の設定 ${S.autoDis.on ? '<span class="eqtag">有効</span>' : '（無効）'}</button>
        <button id="bulkSell" ${v.sel.size ? '' : 'disabled'}>選択した${v.sel.size}件を分解</button><button id="selPage">このページを選択</button><button id="selClear">選択解除</button></div>
      <div class="col scroll" style="flex:1">${view.map(it => `<div class="row" style="flex-wrap:nowrap"><input type="checkbox" data-chk="${it.id}" ${v.sel.has(it.id) ? 'checked' : ''} ${it.fav || G.usedByAny(it.id) ? 'disabled' : ''}><div style="flex:1;min-width:0">${itemRow(it, sel.item === it.id)}</div></div>`).join('') || '<div class="small">該当する装備はありません</div>'}</div>
      <div class="pager"><button id="pPrev" ${v.page ? '' : 'disabled'}>◀</button>${v.page + 1} / ${pages}<button id="pNext" ${v.page < pages - 1 ? '' : 'disabled'}>▶</button></div>
    </div>
    <div class="col scroll" style="width:330px;flex:none">${selIt ? itemCard(selIt, `<div class="btnrow" style="margin-top:6px"><button data-act="fav" data-id="${selIt.id}">${selIt.fav ? '★ 解除' : '☆ お気に入り'}</button>${disBtns(selIt)}<button data-goeq="${selIt.id}">装備画面で比較</button></div>`) : '<div class="small">装備をタップ（クリック）すると詳細を表示します。<br><br>★＝お気に入り（分解から保護）<br>どれかのキャラが装備中の装備・お気に入りは分解されません。</div>' + (S.items.length <= 6 ? `<div class="hintBox">装備は<b>ガチャ</b>で手に入ります。敵を倒して集めたコインで引こう！<br><button data-gogacha="1" class="gachaBtn">ガチャへ</button></div>` : '')}</div>`;
    const re = () => { v.page = 0; ui.render(); };
    b.querySelectorAll('[data-gogacha]').forEach(x => x.onclick = () => ui.open('gacha'));
    $('fSlot').onchange = e => { v.slot = e.target.value; re(); };
    $('fRar').onchange = e => { v.rar = +e.target.value; re(); };
    $('fAf').onchange = e => { v.af = e.target.value; re(); };
    $('fSort').onchange = e => { v.sort = e.target.value; re(); };
    $('fQ').onchange = e => { v.q = e.target.value.trim(); re(); };
    $('pPrev').onclick = () => { v.page--; ui.render(); };
    $('pNext').onclick = () => { v.page++; ui.render(); };
    $('autoBtn').onclick = () => { v.mode = 'auto'; ui.render(); };
    $('selPage').onclick = () => { for (const it of view) if (!it.fav && !G.usedByAny(it.id)) v.sel.add(it.id); ui.render(); };
    $('selClear').onclick = () => { v.sel.clear(); ui.render(); };
    $('bulkSell').onclick = () => {
      const ids = [...v.sel]; const tot = ids.reduce((s, id) => { const it = G.itemById(id); return s + (it ? G.disValue(it) : 0); }, 0);
      ui.confirm(`選択した ${ids.length} 件を分解します（強化素材 +${tot}）。\n元に戻せません。よろしいですか？`, () => { const r = G.dismantle(ids); v.sel.clear(); ui.toast(`${r.n}件分解　強化素材 +${r.m}`); G.save(); ui.render(); });
    };
    b.querySelectorAll('[data-chk]').forEach(el => el.onchange = () => { const id = +el.dataset.chk; if (el.checked) v.sel.add(id); else v.sel.delete(id); ui.render(); });
    b.querySelectorAll('.it').forEach(el => el.onclick = e => { if (e.target.classList.contains('star')) return; sel.item = +el.dataset.id; ui.render(); });
    b.querySelectorAll('[data-goeq]').forEach(el => el.onclick = () => { const it = G.itemById(+el.dataset.goeq); sel.slot = it.slot === 'acc' ? 'acc1' : it.slot; sel.item = it.id; ui.open('equip'); });
    bindCommon(b);
  }
  // 自動分解：ガチャで引いた装備のうち、指定したレア度以下を自動で強化素材にする（初期はOFF）
  function renderAuto(b) {
    const S = G.S, a = S.autoDis;
    const matches = S.items.filter(it => it.rar <= a.maxRar && !it.fav && !G.usedByAny(it.id));
    const tot = matches.reduce((s, it) => s + G.disValue(it), 0);
    b.innerHTML = `<div class="col scroll" style="flex:1;min-width:0">
      <div class="row"><button id="backInv">◀ 所持品へ戻る</button><div class="h" style="margin-left:8px">自動分解の設定</div></div>
      <div class="opt"><span>自動分解（ガチャで引いた装備のうち、下のレア度以下を自動で強化素材にする）</span><button id="aOn" class="${a.on ? 'on' : ''}">${a.on ? '有効' : '無効'}</button></div>
      <div class="opt"><span>分解するレア度（これ以下）</span><select id="aRar">${[1, 2, 3].map(i => `<option value="${i}" ${a.maxRar === i ? 'selected' : ''}>${G.RARITY[i].n} 以下</option>`).join('')}</select></div>
      <div class="small" style="margin-top:6px">自動分解した装備もガチャの結果一覧に「分解済み」と獲得した素材の数で表示されます。キャラは分解の対象になりません。どれかのキャラが装備中の装備とお気に入りは、手動でも分解されません。</div>
      <div class="h" style="margin-top:10px">今の所持品で ${G.RARITY[a.maxRar].n} 以下の分解できる装備：${matches.length}件（強化素材 +${tot}）</div>
      <div class="col" style="max-height:200px;overflow-y:auto">${matches.slice(0, 60).map(it => itemRow(it, false)).join('') || '<div class="small">なし</div>'}</div>
      <div class="row" style="margin-top:6px"><button id="aNow" class="danger" ${matches.length ? '' : 'disabled'}>当てはまる${matches.length}件を今すぐ分解</button></div>
    </div>`;
    $('backInv').onclick = () => { invView.mode = 'list'; ui.render(); };
    $('aOn').onclick = () => { a.on = !a.on; G.save(); ui.render(); };
    $('aRar').onchange = e => { a.maxRar = +e.target.value; G.save(); ui.render(); };
    $('aNow').onclick = () => ui.confirm(`${G.RARITY[a.maxRar].n} 以下の ${matches.length} 件を分解します（強化素材 +${tot}）。\n元に戻せません。よろしいですか？`, () => { const r = G.dismantle(matches.map(i => i.id)); ui.toast(`${r.n}件分解　強化素材 +${r.m}`); G.save(); ui.render(); });
    bindCommon(b);
  }
  // ---------- 設定
  function renderSet(b) {
    const s = G.S.settings;
    b.innerHTML = `<div class="col scroll" style="flex:1;max-width:620px;margin:0 auto">
      <div class="opt"><span>BGM音量</span><input type="range" id="sBgm" min="0" max="1" step="0.05" value="${s.bgm == null ? .5 : s.bgm}"></div>
      <div class="opt"><span>効果音量</span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${s.vol}"></div>
      <div class="opt"><span>演出量（パーティクル）</span><div class="btnrow">${['少', '中', '多'].map((n, i) => `<button data-fx="${i}" class="${s.fx === i ? 'on' : ''}">${n}</button>`).join('')}</div></div>
      <div class="opt"><span>ダメージ数値の表示</span><button id="sNum" class="${s.dmgNum ? 'on' : ''}">${s.dmgNum ? 'ON' : 'OFF'}</button></div>
      <div class="opt"><span>画面揺れ</span><button id="sShake" class="${s.shake ? 'on' : ''}">${s.shake ? 'ON' : 'OFF'}</button></div>
      <div class="opt"><span>ゲーム速度</span><div class="btnrow">${[1, 2, 4].map(v => `<button data-sp="${v}" class="${s.speed === v ? 'on' : ''}">×${v}</button>`).join('')}</div></div>
      <div class="opt"><span>おすすめ装備を自動で装着（新しい装備を拾った時）</span><button id="sAutoEq" class="${s.autoEquip ? 'on' : ''}">${s.autoEquip ? 'ON' : 'OFF'}</button></div>
      <div class="opt"><span>自動出撃（ホームに戻ったら数秒後に自動でダンジョンへ）</span><button id="sWait" class="${s.waitHome ? '' : 'on'}">${s.waitHome ? 'OFF' : 'ON'}</button></div>
      <div class="opt"><span>セーブ（定期・階層移動・戦利品・変更時に自動保存）${G.cloud ? `<br><span class="small">クラウド保存：${G.cloud.state === 'on' ? '有効' + (G.cloud.lastAt ? '（最終 ' + new Date(G.cloud.lastAt).toLocaleTimeString() + '）' : '') : G.cloud.state === 'loading' ? '確認中' : '使えません（この画面では端末内だけに保存）'}${G.cloud.error ? '　※前回の保存に失敗（自動でやり直します）' : ''}</span>` : ''}</span><button id="sSave">今すぐ保存</button></div>
      <div class="opt" style="display:block"><div>セーブデータの引っ越し（別のブラウザや端末に進行を移す）</div>
        <div class="small" style="margin:4px 0">「書き出す」で出たコードをコピーし、移したい先のゲームの同じ欄に貼り付けて「読み込む」を押します（ホームにいる時だけ読み込めます）。</div>
        <textarea id="sCode" rows="3" style="width:100%;font-family:monospace;font-size:11px;background:#0f0c15;color:var(--text);border:2px solid var(--line);border-radius:3px" placeholder="ここにセーブのコード"></textarea>
        <div class="btnrow" style="margin-top:4px"><button id="sExport">書き出す（コピー）</button><button id="sImport">読み込む</button></div></div>
      <div class="opt"><span>セーブデータを削除して最初から</span><button id="sWipe" class="danger">データ初期化</button></div>
      <div class="small" style="margin-top:10px;line-height:1.7">ショートカット：E 装備 / K 技 / I 所持品 / Esc 閉じる<br>
      ゲームを開いている間だけ進行します（閉じている間やタブ非表示中は停止）。<br>
      討伐数 ${G.S.stats.kills}　死亡 ${G.S.stats.deaths}　挑戦 ${G.S.stats.runs}　最深 B${G.S.maxFloor}F</div></div>`;
    $('sVol').oninput = e => { s.vol = +e.target.value; G.setVolume(); };
    $('sBgm').oninput = e => { s.bgm = +e.target.value; G.setVolume(); };
    $('sBgm').onchange = () => G.save();
    $('sVol').onchange = () => { G.save(); G.sfx('pickup', 2); };
    b.querySelectorAll('[data-fx]').forEach(el => el.onclick = () => { s.fx = +el.dataset.fx; G.save(); ui.render(); });
    b.querySelectorAll('[data-sp]').forEach(el => el.onclick = () => { s.speed = +el.dataset.sp; ui.refreshSpeed(); G.save(); ui.render(); });
    $('sNum').onclick = () => { s.dmgNum = !s.dmgNum; G.save(); ui.render(); };
    $('sShake').onclick = () => { s.shake = !s.shake; G.save(); ui.render(); };
    $('sWait').onclick = () => { s.waitHome = !s.waitHome; ui.refreshHome(); G.save(); ui.render(); };
    $('sAutoEq').onclick = () => { s.autoEquip = !s.autoEquip; if (s.autoEquip) G.autoEquip(); G.save(); ui.render(); };
    $('sSave').onclick = () => { G.save(); if (G.cloud) G.cloud.flush(); ui.toast('保存しました'); setTimeout(() => panel === 'set' && ui.render(), 1500); };
    // セーブの書き出し：今の状態を保存してから文字列（コード）にする
    $('sExport').onclick = () => {
      G.save(); G.storeCur && G.storeCur();
      const code = 'YR1:' + btoa(unescape(encodeURIComponent(JSON.stringify(G.S))));
      const ta = $('sCode'); ta.value = code; ta.select();
      try { const p = navigator.clipboard && navigator.clipboard.writeText(code); if (p && p.then) p.then(() => ui.toast('コピーしました'), () => ui.toast('コードを選択しました。コピーしてください')); else ui.toast('コードを選択しました。コピーしてください'); } catch (e) { ui.toast('コードを選択しました。コピーしてください'); }
    };
    // セーブの読み込み：コードを確かめてから、今のデータと置き換える
    $('sImport').onclick = () => {
      if (G.S.mode !== 'home') { ui.toast('ホームにいる時に読み込めます'); return; }
      let d = null;
      try { const t = $('sCode').value.trim(); if (!t.startsWith('YR1:')) throw 0; d = JSON.parse(decodeURIComponent(escape(atob(t.slice(4))))); if (!d || !Array.isArray(d.items) || !d.equip) throw 0; } catch (e) { ui.toast('コードが正しくありません'); return; }
      ui.confirm(`このコードのデータ（Lv${d.level}・最深B${d.maxFloor || 0}F・コイン${(d.coins || 0).toLocaleString()}枚）で、今のデータを置き換えます。\n今のデータは消えます。よろしいですか？`, () => {
        G.restartFromSave(d); G.save(); if (G.cloud) G.cloud.flush(); ui.close(); ui.toast('セーブデータを読み込みました');
      });
    };
    $('sWipe').onclick = () => ui.confirm('セーブデータをすべて削除して最初からやり直します。\n元に戻せません。よろしいですか？', () => G.wipe());
  }
})();
