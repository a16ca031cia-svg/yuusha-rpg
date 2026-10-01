'use strict';
// ===== 遊びやすさの改善 =====
// ・ホーム：ログインボーナスとデイリーミッションをポップアップで（スマホでも見落とさない）、はじめての人への遊び方
// ・探索から戻った時の結果画面、HPが少ない時の画面のふちの赤い警告、所持品がいっぱいの印、必殺技ゲージが満タンの表示
// ・自動出撃までの残り時間を出撃ボタンのゲージで、ミニマップをタップで拡大
(function () {
  const ui = G.ui, $ = id => document.getElementById(id), esc = s => ui.esc(s);

  // ---------------------------------------------------------- 共通のポップアップ（順番待ちで1つずつ出す）
  const queue = []; let cur = null;
  function build() {
    const el = document.createElement('div'); el.id = 'uxPop'; el.className = 'hidden';
    el.innerHTML = `<div class="uxBox panel"><div class="uxHead"><span class="uxTitle" id="uxTitle"></span><span class="uxAuto" id="uxAuto"></span><button id="uxClose" title="閉じる">✕</button></div><div class="uxBody" id="uxBody"></div></div>`;
    document.body.appendChild(el);
    $('uxClose').onclick = close;
    el.onclick = e => { if (e.target === el) close(); };
    const low = document.createElement('div'); low.id = 'lowHp'; document.body.appendChild(low);
  }
  // p = { key, title, render(body), onClose }：同じ key は重ねて積まない
  function show(p) { if (cur && cur.key === p.key) return; if (queue.some(q => q.key === p.key)) return; queue.push(p); if (!cur) next(); }
  function next() {
    cur = queue.shift() || null;
    if (!cur) { $('uxPop').classList.add('hidden'); return; }
    $('uxTitle').textContent = cur.title; cur.render($('uxBody'));
    $('uxPop').className = cur.cls || ''; $('uxBody').scrollTop = 0;
  }
  function close() { const c = cur; if (c && c.onClose) c.onClose(); next(); }
  function closeAll() { queue.length = 0; if (cur) { cur = null; $('uxPop').classList.add('hidden'); } }
  const refreshCur = () => { if (cur) cur.render($('uxBody')); };

  // ---------------------------------------------------------- デイリーミッション
  function claimable() { const d = G.daily(); let n = G.DAILY.filter(m => !d.claimed[m.id] && G.dailyDone(m)).length; if (!d.claimed.all && G.DAILY.every(m => d.claimed[m.id])) n++; return n; }
  G.openMissions = () => show({
    key: 'mission', title: 'デイリーミッション', render(b) {
      const d = G.daily(), allDone = G.DAILY.every(m => d.claimed[m.id]);
      b.innerHTML = `<div class="small" style="margin-bottom:6px">毎日0時に新しくなります。達成したら「受け取る」でコインがもらえます。</div>` + G.DAILY.map(m => {
        const v = Math.min(m.need, d[m.id] || 0), done = v >= m.need, got = d.claimed[m.id];
        return `<div class="uxMis ${got ? 'got' : done ? 'done' : ''}"><div class="umL"><div class="umN">${esc(m.n)}</div><div class="dmBar"><i style="width:${v / m.need * 100}%"></i></div><div class="small">${v} / ${m.need}</div></div>
          <div class="umR">${got ? '<span class="small">受取済</span>' : done ? `<button data-claim="${m.id}" class="primary">受け取る<br><b>+${m.reward}</b></button>` : `<span class="gold">+${m.reward}</span>`}</div></div>`;
      }).join('') + `<div class="uxMis all ${d.claimed.all ? 'got' : allDone ? 'done' : ''}"><div class="umL"><div class="umN">すべて達成ボーナス</div></div><div class="umR">${d.claimed.all ? '<span class="small">受取済</span>' : allDone ? `<button data-claim="all" class="primary">受け取る<br><b>+${G.DAILY_ALL}</b></button>` : `<span class="gold">+${G.DAILY_ALL}</span>`}</div></div>`;
      b.querySelectorAll('[data-claim]').forEach(x => x.onclick = () => {
        const r = G.dailyClaim(x.dataset.claim);
        if (r) { ui.callout({ text: 'MISSION CLEAR', sub: 'コイン +' + r + '枚', tone: 'gold', prio: 5, dur: 1.4, size: .75, flash: .25 }); G.sfx('pickup', 3); G.save(); }
        refreshCur();
      });
    }
  });

  // ---------------------------------------------------------- ログインボーナス（ホームに来た時に自動で）
  const ymd = d => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  function loginPopup() {
    const S = G.S, yd = ymd(new Date(Date.now() - 864e5)), nx = S.login.last === yd ? S.login.streak + 1 : 1, base = Math.floor((nx - 1) / 7) * 7;
    show({
      key: 'login', title: 'ログインボーナス', cls: 'login', render(b) {
        const done = !G.loginReady();
        b.innerHTML = `<div class="lbHead">連続ログイン <b>${nx}</b> 日目</div>
          <div class="lbDays">${[1, 2, 3, 4, 5, 6, 7].map(k => { const day = base + k; return `<div class="lbD ${day < nx || (done && day === nx) ? 'got' : day === nx ? 'today' : ''} ${k === 7 ? 'big' : ''}"><div class="lbN">${day}日目</div><i class="pc"></i><b>${G.LOGIN(day)}</b></div>`; }).join('')}</div>
          <div class="lbBtn">${done ? '<div class="small">受け取りました！また明日もログインしてね</div><button id="lbOk">OK</button>' : `<button id="lbGet" class="primary big">受け取る（コイン +${G.LOGIN(nx)}）</button>`}</div>`;
        if ($('lbGet')) $('lbGet').onclick = () => { const r = G.loginClaim(); if (r) { ui.callout({ text: 'LOGIN BONUS', sub: 'コイン +' + r + '枚', tone: 'gold', prio: 5, dur: 1.6, size: .8, flash: .3 }); G.sfx('pickup', 3); G.save(); } refreshCur(); };
        if ($('lbOk')) $('lbOk').onclick = close;
      }
    });
  }

  // ---------------------------------------------------------- はじめての人への遊び方
  function tipsPopup() {
    show({
      key: 'tips', title: 'あそびかた', render(b) {
        b.innerHTML = `<div class="uxTips">
          <div class="tp"><b>1</b><div><div class="tpT">勇者は自動で戦います</div><div class="small">「出撃」を押すとダンジョンへ。探索・戦闘・階段を下りるのは全部おまかせ。速さ（×2・×4）も変えられます。</div></div></div>
          <div class="tp"><b>2</b><div><div class="tpT">装備は「おすすめ一括装備」</div><div class="small">拾った装備は「装備」画面のボタン1つで強いものに付け替え。いらない装備は分解して強化素材に。</div></div></div>
          <div class="tp"><b>3</b><div><div class="tpT">コインでガチャを引こう</div><div class="small">敵を倒すとコインがたまります。ガチャで仲間（UR）や装備が手に入ります。</div></div></div>
          <div class="tp"><b>4</b><div><div class="tpT">ミッションとログインボーナス</div><div class="small">毎日のミッションを達成するとコインがもらえます。</div></div></div>
        </div><div class="lbBtn"><button id="tpGo" class="primary big">はじめる！</button></div>`;
        $('tpGo').onclick = close;
      },
      onClose() { G.S.settings.tipsSeen = true; G.save(); }
    });
  }

  // ---------------------------------------------------------- 探索の結果
  let prevMax = 0, lastRunSeen = null, inited = false;
  const depart0 = G.depart;
  G.depart = function (resume) { if (G.S) prevMax = G.S.maxFloor; closeAll(); return depart0.apply(this, arguments); };
  function resultPopup(lr, msg) {
    const rec = lr.floor > prevMax && prevMax > 0, t = lr.t || 0, dead = /力尽き/.test(msg || '');
    show({
      key: 'result', title: dead ? '探索失敗…' : '探索結果', cls: dead ? 'result dead' : 'result', render(b) {
        b.innerHTML = `${rec ? '<div class="rsRec">最深記録 更新！</div>' : ''}<div class="rsMsg">${esc(msg || '')}</div>
          <div class="rsGrid">
            <div><span>到達</span><b>B${lr.floor}F</b></div><div><span>撃破</span><b>${lr.kills}</b></div>
            <div><span>最大コンボ</span><b>${lr.best}</b></div><div><span>コイン</span><b class="gold">+${(lr.coins || 0).toLocaleString()}</b></div>
            <div><span>装備</span><b>${lr.items || 0}個</b></div><div><span>時間</span><b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b></div>
          </div>
          ${dead ? '<div class="small" style="margin-top:6px">ヒント：「装備」の「おすすめ一括装備」や、ガチャで手に入る仲間で強くなろう。</div>' : ''}
          <div class="lbBtn">${G.resumeRun ? '<button id="rsGo" class="primary big">続きから出撃</button>' : '<button id="rsGo" class="primary big">もう一度出撃</button>'}<button id="rsOk">ホームへ</button></div>`;
        $('rsGo').onclick = () => { closeAll(); G.depart(!!G.resumeRun); };
        $('rsOk').onclick = close;
      }
    });
  }

  // ---------------------------------------------------------- 毎フレームの見張り
  let wasHome = false, loginAsked = false, warnedFull = false;
  const update0 = ui.update;
  ui.update = function (dt) {
    update0(dt);
    const S = G.S, H = G.hero; if (!S) return;
    const home = S.mode === 'home' && !ui.titleOn && !G.trans, newsOpen = $('newsWin') && !$('newsWin').classList.contains('hidden');
    G.uxHold = !!cur || newsOpen || !$('modal').classList.contains('hidden');
    if (!home && cur) closeAll(); // 出撃したら閉じる
    // 自動出撃がONの時は、放置で遊べるようにポップアップを数秒で自動で閉じる（ログインボーナスは自動で受け取る）
    const autoOn = home && !S.settings.waitHome && !G.manualStart;
    if (cur && autoOn && cur.key !== 'mission') {
      cur.t = (cur.t || 0) + dt; const lim = cur.key === 'result' ? 6 : 10;
      $('uxAuto').textContent = Math.ceil(lim - cur.t) + '秒後に閉じます';
      if (cur.t >= lim) { if (cur.key === 'login' && G.loginReady()) { const r = G.loginClaim(); if (r) { ui.toast('ログインボーナス コイン +' + r + '枚'); G.save(); } } close(); }
    } else $('uxAuto').textContent = '';
    if (!inited) { inited = true; lastRunSeen = S.lastRun; } // 起動した時の前回の結果は出さない
    // ホームに来た瞬間：今回の探索の結果を出す。そのあと遊び方（はじめての人）→ ログインボーナス（お知らせが開いていれば、そのあと）
    if (home && !wasHome && G.afterHome) { const p = G.afterHome; G.afterHome = null; ui.open(p); } // 「帰還してガチャへ」など：着いたらその画面へ（結果は省く）
    else if (home && !wasHome && S.lastRun && S.lastRun !== lastRunSeen) resultPopup(S.lastRun, S.homeMsg);
    if (home) {
      lastRunSeen = S.lastRun;
      if (!newsOpen && !cur && $('modal').classList.contains('hidden')) {
        if (!S.settings.tipsSeen && !S.stats.runs) tipsPopup();
        else if (!loginAsked && G.loginReady()) { loginAsked = true; loginPopup(); }
      }
    }
    wasHome = home;
    // ミッションの受け取れる数
    const mb = document.querySelector('.hubM[data-p="mission"]');
    if (mb) { const n = claimable(); mb.classList.toggle('badge', n > 0); mb.dataset.n = n || ''; const mi = mb.querySelector('.mi'); if (mi && !mi.firstChild) mi.innerHTML = '<b class="miStar">★</b>'; }
    // 所持品がいっぱい
    const full = S.items.length >= G.INV_CAP;
    for (const b of document.querySelectorAll('#menu button[data-p="inv"], .hubM[data-p="inv"]')) b.classList.toggle('full', full);
    if (full && S.mode === 'dungeon' && !warnedFull && !S.autoDis.on) { warnedFull = true; ui.toast('所持品がいっぱい！「所持品」で分解するか、自動分解をONにしよう'); }
    if (!full) warnedFull = false;
    // HPが少ない時の赤い警告
    const low = S.mode === 'dungeon' && H && H.st && !H.dead && H.hp / H.st.maxHp < .3;
    $('lowHp').classList.toggle('on', !!low);
    // 必殺技ゲージが満タン
    const ub = $('ultBar'); if (ub && H) ub.classList.toggle('full', (H.ult || 0) >= G.ULT.max);
    // 自動出撃までの残り時間（出撃ボタンのゲージ）
    const go = $('hbGo');
    if (go) { const auto = home && !S.settings.waitHome && !G.manualStart; go.classList.toggle('auto', auto); go.style.setProperty('--p', auto ? Math.max(0, Math.min(1, 1 - G.homeT / 3.5)).toFixed(3) : 0); }
  };
  build();
  // ミニマップ：タップで大きく
  $('miniWrap').addEventListener('click', () => { $('miniWrap').classList.toggle('big'); G.S && (G.S.mode !== 'home') && G.sfx('click'); });
})();
