'use strict';
// ===== ホーム画面（ソーシャルゲーム風） =====
// 上：プレイヤー情報と所持通貨 / 中央：選択中のキャラ（タップでしゃべる）/ 左：ガチャのバナー・ログインボーナス・デイリーミッション
// 右：メニュー / 下：出撃ボタン（続きから・B1Fから・自動出撃）
(function () {
  const ui = G.ui, $ = id => document.getElementById(id), esc = s => ui.esc(s);
  const ART = c => 'img/chars/' + c + '_art.webp';
  const urlCache = {};
  const canvasURL = (k, cv) => urlCache[k] || (cv && cv.width > 2 ? (urlCache[k] = cv.toDataURL()) : '');

  function build() {
    const el = document.createElement('div'); el.id = 'hub'; el.className = 'hidden';
    el.innerHTML = `
      <div class="hubShade"></div>
      <div class="hubTop">
        <div class="hubPlayer"><div class="hpLv"><span>Lv</span><b id="hbLv">1</b></div><div class="hpInfo"><div class="hpName" id="hbName"></div><div class="hpPow">総合力 <b id="hbPow">0</b></div></div></div>
        <div class="hubCur">
          <span class="pill coin" title="ガチャコイン"><i class="pc"></i><b id="hbCoin">0</b></span>
          <span class="pill" title="強化素材（装備の強化に使う）"><i class="pf"></i><b id="hbForge">0</b></span>
          <span class="pill" title="英雄の魂（キャラに経験値を与える）"><i class="ps"></i><b id="hbSoul">0</b></span>
          <button id="hbSet" class="hubIcon" title="設定">設定</button>
        </div>
      </div>
      <div class="hubStage">
        <div class="hubChar" id="hbChar"><div class="hubBody" id="hbBody"><img id="hbArt" alt="" draggable="false"><canvas id="hbPix" width="140" height="144"></canvas></div></div>
        <div class="hubBubble" id="hbBubble"></div>
        <button id="hbView" class="hubView hidden" title="イラストとSDキャラを切り替え"></button>
        <div class="hubPlate"><div class="hcEl" id="hbEl"></div><div class="hcNm" id="hbCName"></div><div class="hcSt" id="hbStar"></div></div>
      </div>
      <div class="hubLeft">
        <div class="hubBanner" id="hbGacha"><div class="bnArts">${['thunder', 'ice', 'samurai'].map((c, i) => `<img src="${ART(c)}" alt="" style="animation-delay:${i * 3}s">`).join('')}</div>
          <span class="bnTag">PICK UP</span><div class="bnTxt"><div class="bnT">英雄召喚ガチャ</div><div class="bnS" id="hbPity"></div></div></div>
        <div class="hubCard" id="hbLogin"></div>
        <div class="hubCard" id="hbDaily"></div>
      </div>
      <div class="hubMenu" id="hbMenu">
        ${[['chara', 'キャラ'], ['equip', '装備'], ['skill', '技'], ['inv', '所持品'], ['gacha', 'ガチャ']].map(([k, n]) => `<button class="hubM" data-p="${k}"><span class="mi" data-mi="${k}"></span><span>${n}</span></button>`).join('')}
      </div>
      <div class="hubBottom">
        <div class="hubLast" id="hbLast"></div>
        <div class="hubGoRow">
          <button id="hbWait" class="hubSmall"></button>
          <button id="hbGo1" class="hubSmall hidden">B1Fから</button>
          <button id="hbGo" class="hubGo"><span id="hbGoT">出撃</span><small id="hbGoS"></small></button>
        </div>
      </div>`;
    document.body.appendChild(el);
    $('hbSet').onclick = () => ui.open('set');
    $('hbGacha').onclick = () => ui.open('gacha');
    el.querySelectorAll('.hubM').forEach(b => b.onclick = () => ui.open(b.dataset.p));
    $('hbGo').onclick = () => G.depart(!!G.resumeRun);
    $('hbGo1').onclick = () => G.depart(false);
    $('hbWait').onclick = () => { G.S.settings.waitHome = !G.S.settings.waitHome; ui.refreshHome(); G.save(); refresh(); };
    $('hbChar').onclick = talk;
    $('hbView').onclick = e => { e.stopPropagation(); const st = G.S.settings; st.homeView = st.homeView === 'sd' ? 'art' : 'sd'; lastCur = ''; G.sfx('click'); G.save(); refresh(); poke(.5, .22); };
    // ぷにぷに：押している間つぶれて、離すとぷるんと弾む
    const ch = $('hbChar');
    ch.addEventListener('pointerdown', e => { const r = ch.getBoundingClientRect(); press = true; tiltT = ((e.clientX - r.left) / r.width - .5) * 2; J.v += 1.2; });
    const up = () => { if (!press) return; press = false; J.v -= 4.5; K.v += -tiltT * 9; tiltT = 0; };
    ch.addEventListener('pointerup', up); ch.addEventListener('pointerleave', up); ch.addEventListener('pointercancel', up);
  }
  // ばね：J＝つぶれ具合（＋でつぶれ、−で縦に伸びる）、K＝左右の傾き（ゼリーのように揺れる）
  const J = { x: 0, v: 0 }, K = { x: 0, v: 0 };
  let press = false, tiltT = 0;
  function poke(px, amt) { J.v += amt * 30; K.v += (px - .5) * 12; }
  function jelly(dt) {
    dt = Math.min(dt, 1 / 30);
    for (let s = 0; s < 3; s++) { // 細かく刻んで安定させる
      const h = dt / 3;
      J.v += ((press ? .13 : 0) - J.x) * 320 * h - J.v * 7 * h; J.x += J.v * h;
      K.v += ((press ? tiltT * .5 : 0) - K.x) * 210 * h - K.v * 5 * h; K.x += K.v * h;
    }
    const sq = Math.max(-.2, Math.min(.22, J.x)), b = $('hbBody');
    if (Math.abs(sq) < .001 && Math.abs(K.x) < .002 && !press) { if (b.style.transform) b.style.transform = ''; return; }
    b.style.transform = `skewX(${(K.x * 10).toFixed(2)}deg) scale(${(1 + sq * .75).toFixed(4)},${(1 - sq).toFixed(4)})`;
  }
  // キャラをタップ：セリフと小さく跳ねる
  let bubTO = 0, lastLine = -1;
  function talk() {
    const c = G.S.cur, L = G.LINES[c] || G.LINES.hero; let i = Math.floor(Math.random() * L.length); if (i === lastLine) i = (i + 1) % L.length; lastLine = i;
    const b = $('hbBubble'); b.textContent = L[i]; b.classList.remove('show'); void b.offsetWidth; b.classList.add('show');
    const ch = $('hbChar'); ch.classList.remove('hop'); void ch.offsetWidth; ch.classList.add('hop');
    G.sfx('click'); clearTimeout(bubTO); bubTO = setTimeout(() => b.classList.remove('show'), 2600);
  }
  function menuIcons() {
    const set = (k, url) => { const e = document.querySelector(`[data-mi="${k}"]`); if (e && url && !e.firstChild) e.innerHTML = `<img src="${url}" alt="">`; };
    set('equip', G.iconURL('weapon')); set('inv', G.iconURL('body'));
    set('skill', canvasURL('sk', G.SKICON && G.SKICON.spin)); set('gacha', canvasURL('chest', G.CHEST && G.CHEST.n));
    set('chara', canvasURL('heroIcon', G.heroPose && G.heroPose('idle', 0)));
  }
  // 中身の更新（ホームを表示している間は定期的に）
  let lastCur = '';
  function refresh() {
    const S = G.S, H = G.hero; if (!S || !H || !H.st) return;
    const c = S.cur, C = G.CHARS[c];
    $('hbLv').textContent = S.level; $('hbName').textContent = C.n; $('hbPow').textContent = G.fmtBig(G.powerOf(H.st));
    $('hbCoin').textContent = S.coins.toLocaleString(); $('hbForge').textContent = S.mats.forge.toLocaleString(); $('hbSoul').textContent = S.mats.soul;
    $('hbCName').textContent = C.n; $('hbEl').textContent = C.gacha ? 'UR　' + C.el : C.sub; $('hbEl').classList.toggle('ur', !!C.gacha);
    $('hbStar').innerHTML = '★'.repeat(G.curStar()) + (C.gacha ? '<span class="dimst">' + '★'.repeat(5 - G.curStar()) + '</span>' : '');
    const art = C.gacha && S.settings.homeView !== 'sd';
    if (c + art !== lastCur) {
      lastCur = c + art; pixKey = '';
      if (art) $('hbArt').src = ART(c);
      $('hbArt').style.display = art ? '' : 'none'; $('hbPix').style.display = art ? 'none' : '';
      $('hbChar').style.setProperty('--cc', C.col); $('hbChar').classList.toggle('sd', !art);
      $('hbView').classList.toggle('hidden', !C.gacha); $('hbView').textContent = art ? 'SD' : 'イラスト';
    }
    $('hbPity').textContent = 'UR確定まで あと' + (G.GACHA.pity - S.pity) + '回　単発 ' + G.GACHA.single + '枚 / 10連 ' + G.GACHA.ten.toLocaleString() + '枚';
    // ログインボーナス
    const lg = $('hbLogin');
    if (G.loginReady()) {
      const nx = (S.login.last ? S.login.streak : 0) + 1;
      lg.innerHTML = `<div class="hcT">ログインボーナス</div><div class="small">連続 ${nx} 日目　コイン <b class="gold">+${G.LOGIN(nx)}</b>${nx % 7 === 0 ? '　（7日目のボーナス！）' : ''}</div><button id="hbLoginBtn" class="primary">受け取る</button>`;
      lg.classList.add('hot');
      $('hbLoginBtn').onclick = e => { e.stopPropagation(); const r = G.loginClaim(); if (r) { ui.callout({ text: 'LOGIN BONUS', sub: 'コイン +' + r + '枚', tone: 'gold', prio: 5, dur: 1.6, size: .8, flash: .3 }); G.sfx('pickup', 3); } refresh(); };
    } else { lg.innerHTML = `<div class="hcT">ログインボーナス</div><div class="small">受け取り済み（連続 ${S.login.streak} 日）　また明日！</div>`; lg.classList.remove('hot'); }
    // デイリーミッション
    const d = G.daily(), allDone = G.DAILY.every(m => d.claimed[m.id]);
    $('hbDaily').innerHTML = `<div class="hcT">デイリーミッション <span class="small">毎日0時に更新</span></div>` + G.DAILY.map(m => {
      const v = Math.min(m.need, d[m.id] || 0), done = v >= m.need, got = d.claimed[m.id];
      return `<div class="dm ${got ? 'got' : done ? 'done' : ''}"><div class="dmN">${esc(m.n)}<span class="small"> ${v}/${m.need}</span></div><div class="dmBar"><i style="width:${v / m.need * 100}%"></i></div>
        ${got ? '<span class="small">受取済</span>' : done ? `<button data-claim="${m.id}" class="primary">+${m.reward}</button>` : `<span class="small gold">+${m.reward}</span>`}</div>`;
    }).join('') + `<div class="dm all ${d.claimed.all ? 'got' : ''}"><div class="dmN">すべて達成ボーナス</div>${d.claimed.all ? '<span class="small">受取済</span>' : allDone ? `<button data-claim="all" class="primary">+${G.DAILY_ALL}</button>` : `<span class="small gold">+${G.DAILY_ALL}</span>`}</div>`;
    $('hbDaily').querySelectorAll('[data-claim]').forEach(b => b.onclick = e => { e.stopPropagation(); const r = G.dailyClaim(b.dataset.claim); if (r) { ui.toast('ミッション報酬 コイン +' + r + '枚'); G.sfx('pickup', 3); } refresh(); });
    // 出撃ボタン
    const rr = G.resumeRun;
    $('hbGoT').textContent = rr ? '続きから出撃' : '出撃';
    const auto = !S.settings.waitHome && !G.manualStart && !G.trans ? `　${Math.max(0, G.homeT).toFixed(1)}秒後に自動出撃` : '';
    $('hbGoS').textContent = (rr ? 'B' + rr.floor + 'F から' : 'B1F から') + '　最深 B' + S.maxFloor + 'F' + auto;
    $('hbGo1').classList.toggle('hidden', !rr);
    $('hbWait').textContent = '自動出撃 ' + (S.settings.waitHome ? 'OFF' : 'ON'); $('hbWait').classList.toggle('on', !S.settings.waitHome);
    const lr = S.lastRun;
    $('hbLast').innerHTML = S.homeMsg ? esc(S.homeMsg) + (lr ? `　<span class="small">B${lr.floor}F 到達・撃破 ${lr.kills}・最大 ${lr.best} コンボ・コイン +${(lr.coins || 0).toLocaleString()}</span>` : '') : (S.stats.runs ? '準備ができたら出撃しよう' : 'ようこそ！ダンジョンで集めたコインでガチャを引いて、仲間と装備を手に入れよう');
    // 装備ボタンの印（より良い装備がある）
    const eqb = document.querySelector('.hubM[data-p="equip"]'), mb = document.querySelector('#menu button[data-p="equip"]');
    if (eqb && mb) { eqb.classList.toggle('badge', mb.classList.contains('badge')); eqb.dataset.n = mb.dataset.n || ''; }
    menuIcons();
  }
  // ドット絵（SD）の待機アニメーションを大きく表示：勇者はいつも、ガチャのキャラは「SD」に切り替えた時
  let pixT = 0, pixKey = '', box = null;
  function sdFrame(c, i) {
    if (c === 'hero') return G.heroPose && G.heroPose('idle', i);
    const fr = G.charRigFrame && G.charRigFrame(c, 'front', 'idle', i);
    return fr ? fr.n : G.charPortrait(c);
  }
  // ガチャのキャラはコマの余白が大きいので、待機の全コマが収まる範囲だけを切り出す
  function sdBox(c) {
    if (c === 'hero') return { x: 0, y: 0, w: 140, h: 144 };
    let x0 = 1e9, y0 = 1e9, x1 = -1, y1 = -1;
    for (let i = 0; i < 8; i++) {
      const f = sdFrame(c, i); if (!f) return null;
      const d = f.getContext('2d').getImageData(0, 0, f.width, f.height).data;
      for (let y = 0; y < f.height; y++) for (let x = 0; x < f.width; x++) if (d[(y * f.width + x) * 4 + 3]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    if (x1 < 0) return null;
    const p = 3; return { x: x0 - p, y: y0 - p, w: x1 - x0 + 1 + p * 2, h: y1 - y0 + 1 + p };
  }
  function drawPix(dt) {
    const c = G.S.cur, C = G.CHARS[c];
    if (C.gacha && G.S.settings.homeView !== 'sd') return;
    if (pixKey !== c) { box = sdBox(c); if (!box) return; pixKey = c; const cv = $('hbPix'); cv.width = box.w; cv.height = box.h; cv.style.aspectRatio = box.w + '/' + box.h; }
    pixT += dt; const cv = $('hbPix'), x = cv.getContext('2d'), fr = sdFrame(c, Math.floor(pixT * 5) % 8);
    if (!fr) return; x.clearRect(0, 0, cv.width, cv.height); x.imageSmoothingEnabled = false; x.drawImage(fr, -box.x, -box.y);
  }
  // ホームの時だけ表示（タイトル・切り替え中は隠す）。表示中は通常のHUDを隠す
  let shown = false, acc = 0;
  const update0 = ui.update;
  ui.update = function (dt) {
    update0(dt);
    const S = G.S; if (!S) return;
    const on = S.mode === 'home' && !ui.titleOn && !G.trans;
    if (on !== shown) { shown = on; $('hub').classList.toggle('hidden', !on); document.body.classList.toggle('homeMode', on); if (on) refresh(); }
    if (!on) return;
    drawPix(dt); jelly(dt);
    acc += dt; if (acc > .25) { acc = 0; refresh(); }
  };
  const onMode0 = ui.onMode;
  ui.onMode = function () { onMode0(); if (shown) refresh(); };
  build();
})();
