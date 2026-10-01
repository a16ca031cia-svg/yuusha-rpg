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
        <div class="hubChar" id="hbChar"><img id="hbArt" alt=""><canvas id="hbPix" width="140" height="144"></canvas></div>
        <div class="hubBubble" id="hbBubble"></div>
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
    if (c !== lastCur) { lastCur = c; $('hbArt').src = C.gacha ? ART(c) : ''; $('hbArt').style.display = C.gacha ? '' : 'none'; $('hbPix').style.display = C.gacha ? 'none' : ''; $('hbChar').style.setProperty('--cc', C.col); }
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
  // 勇者（イラストがない）は、ドット絵の待機アニメーションを大きく表示
  let pixT = 0;
  function drawPix(dt) {
    if (G.S.cur !== 'hero') return;
    pixT += dt; const cv = $('hbPix'), x = cv.getContext('2d'), i = Math.floor(pixT * 5) % 8, fr = G.heroPose && G.heroPose('idle', i);
    if (!fr) return; x.clearRect(0, 0, 140, 144); x.imageSmoothingEnabled = false; x.drawImage(fr, 0, 0);
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
    drawPix(dt);
    acc += dt; if (acc > .25) { acc = 0; refresh(); }
  };
  const onMode0 = ui.onMode;
  ui.onMode = function () { onMode0(); if (shown) refresh(); };
  build();
})();
