'use strict';
// ===== 起動・メインループ =====
(function () {
  const cv = G.cv = document.getElementById('cv');
  G.scale = 2; G.VW = 640; G.VH = 360;
  G.BASE_SPEED = 2; // ゲームの基本の速さ（1フレームに進める回数）
  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1); // スマホの高精細画面は2倍までに抑えて軽くする
    const cw = window.innerWidth, ch = window.innerHeight;
    cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr);
    // 描画倍率：横長の画面は見える高さが約230単位、縦長（スマホ縦持ち）は見える幅が約200単位に近いものを選ぶ
    const portrait = ch > cw * 1.1;
    let s = 2, best = 1e9;
    for (const k of [2, 3, 4, 6, 8, 12]) { // 1ドット=0.25単位なので4の倍数だとドットが整数ピクセルになる（それ以外は少し減点）
      const vw = cv.width / k, vh = cv.height / k;
      if (k > 2 && (portrait ? (vw < 170 || vh < 240) : (vw < 240 || vh < 180))) continue;
      const d = (portrait ? Math.abs(vw - 200) : Math.abs(vh - 230)) + (k % 4 ? 70 : 0); // 勇者の絵は1ドット=0.25単位：4の倍数でドットが1:1になる
      if (d < best) { best = d; s = k; }
    }
    G.scale = s;
    const zq = +new URLSearchParams(location.search).get('zoom'); // 確認用の拡大表示
    if (zq > 0) G.scale = zq;
    G.VW = cv.width / G.scale; G.VH = cv.height / G.scale;
  }
  window.addEventListener('resize', resize);
  window.addEventListener('orientationchange', () => setTimeout(resize, 200));
  // スマホ：ピンチやダブルタップでの拡大を止める（ゲーム画面がずれないように）
  document.addEventListener('gesturestart', e => e.preventDefault());
  document.addEventListener('touchmove', e => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
  resize();
  G.initRender(cv);
  // ダメージ数字の色を事前生成
  for (const c of ['#ffffff', '#ffe04a', '#9fdcff', '#ffa050', '#ff8a3a', '#a8f060', '#dfe6ff', '#fff0b0', '#ff5a4a', '#7fff8a']) G.digits(c);

  if (!G.load()) G.initNewGame();
  G.makeHero();
  G.checkLearn();
  G.ui.init();
  // 起動時は必ずホームで待機し、「突入」ボタンで出発する。挑戦の途中だった場合は「続きから」も選べる
  function toHome() {
    G.manualStart = true;
    G.resumeRun = G.S.run && G.S.run.snap ? G.S.run : null;
    G.S.mode = 'home'; G.setupHome();
    G.ui.onMode();
  }
  toHome();
  // 別の場所（クラウド）から読み込んだセーブで始め直す
  G.restartFromSave = function (d) {
    G.applySaveData(d);
    G.makeHero(); G.checkLearn();
    G.ui.refreshSkills(); G.ui.refreshSpeed(); G.ui.refreshSound(); G.setVolume && G.setVolume();
    toHome(); G.ui.upgradeCheck();
  };

  let last = performance.now();
  function frame(now) {
    let dt = (now - last) / 1000; last = now;
    dt = G.clamp(dt, 0, 1 / 20); // タブ復帰時などに大きく進めない
    if (G.slowT > 0) { G.slowT -= dt; dt *= G.slowK; if (G.slowT <= 0) G.slowK = 1; } // 見せ場の一瞬のスロー
    if (!G.paused) {
      const n = (G.S.settings.speed || 1) * G.BASE_SPEED; // 「×1」でも以前の×2の速さで進む
      for (let i = 0; i < n; i++) G.update(dt);
    }
    G.render();
    G.ui.update(dt);
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => { if (document.hidden) G.save(); last = performance.now(); });
  window.addEventListener('beforeunload', () => G.save());
  window.G = G;
})();
