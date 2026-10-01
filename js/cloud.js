'use strict';
// ===== クラウド保存（claude.ai で公開したページの時だけ動く） =====
// スマホのアプリ内表示などではブラウザの保存領域が使えない・閉じると消えることがあるため、
// 遊んでいる本人だけが読める場所（data/users/<本人のid>/save）にセーブを置く。
// 書き込みはまとめて行う：最後の変更から少し待ち、最短でも15秒おき。アプリを切り替えた時はすぐ書く。
(function () {
  if (!window.claude || typeof window.claude.use !== 'function') return; // 手元で開いた時は何もしない
  const C = G.cloud = { state: 'loading', lastAt: 0 };
  let ref = null, dirty = false, writing = false, timer = 0, lastWrite = 0, departedEarly = false;
  const MIN_GAP = 15000, IDLE = 4000;

  // 読み込みが終わるまでは出発を待たせる（古いデータで始めて上書きしないように）
  const depart = G.depart;
  let pendingDepart = null;
  G.depart = function (resume, from) {
    if (C.state === 'loading') { pendingDepart = [resume, from]; G.ui.toast('セーブデータを確認中…'); return; }
    departedEarly = true;
    return depart.apply(this, arguments);
  };
  const finishLoading = state => {
    C.state = state;
    if (pendingDepart) { const a = pendingDepart; pendingDepart = null; G.depart(a[0], a[1]); }
  };

  async function write() {
    if (!ref || writing || !dirty || G.wiping) return;
    writing = true; dirty = false; clearTimeout(timer);
    try {
      await ref.set({ v: 1, savedAt: G.S.savedAt || Date.now(), data: JSON.parse(JSON.stringify(G.S)) });
      lastWrite = Date.now(); C.lastAt = lastWrite; C.error = '';
    } catch (e) {
      dirty = true; C.error = (e && e.code) || 'error';
      if (e && e.code === 'unavailable') setTimeout(write, 3000 + Math.random() * 2000); // 一時的な不調は少し待って1回やり直す
    } finally { writing = false; }
    if (dirty) schedule();
  }
  function schedule() {
    clearTimeout(timer);
    const wait = Math.max(IDLE, MIN_GAP - (Date.now() - lastWrite));
    timer = setTimeout(write, wait);
  }
  C.queue = () => { if (!ref) { dirty = true; return; } dirty = true; schedule(); };
  C.flush = () => { if (ref && dirty) write(); };
  C.wipe = async () => { if (ref) { try { await ref.delete(); } catch (e) { } } };
  // アプリの切り替え・画面を閉じる時はすぐ書き込む
  document.addEventListener('visibilitychange', () => { if (document.hidden) { G.save(); C.flush(); } });
  window.addEventListener('pagehide', () => { G.save(); C.flush(); });

  (async () => {
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      const id = user && await user.id();
      if (!db || !id) return finishLoading('off');
      ref = db.doc('data/users/' + id + '/save');
      const snap = await ref.get();
      const d = snap.exists && snap.data();
      const localAt = (G.S && G.S.savedAt) || 0;
      if (d && d.data && (d.savedAt || 0) > localAt && !departedEarly) {
        // クラウドの方が新しい：それで始め直す
        G.restartFromSave(JSON.parse(JSON.stringify(d.data)));
        try { localStorage.setItem('yuusha_auto_rpg_save_v1', JSON.stringify(G.S)); } catch (e) { }
        G.ui.toast('セーブデータを読み込みました');
      } else if (localAt > ((d && d.savedAt) || 0)) dirty = true; // 手元の方が新しい：クラウドへ上げる
      C.lastAt = (d && d.savedAt) || 0;
      finishLoading('on');
      if (dirty) schedule();
    } catch (e) {
      C.error = (e && e.code) || 'error';
      finishLoading('off');
    }
  })();
})();
