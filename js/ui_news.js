'use strict';
// ===== お知らせ（運営からのお知らせ・アップデート内容） =====
// news.json（新しい順・最大20件）を読み込んで、ホームの「お知らせ」ボタンから一覧で見せる。
// まだ読んでいないお知らせがあればボタンに NEW を付け、ホームに来た時に一度だけ自動で開く。
(function () {
  const ui = G.ui, $ = id => document.getElementById(id), esc = s => ui.esc(s);
  const MAX = 20, TAG = { 'アップデート': 'up', '不具合修正': 'fix', 'お知らせ': 'info', '仕様変更': 'chg' };
  G.NEWS = [];
  let autoShown = false;

  G.loadNews = function () {
    return fetch('news.json?t=' + Date.now(), { cache: 'no-store' }).then(r => r.json()).then(list => {
      if (!Array.isArray(list)) return;
      G.NEWS = list.slice().sort((a, b) => b.id - a.id).slice(0, MAX);
      refreshBadge();
    }).catch(() => { });
  };
  const latest = () => G.NEWS.length ? G.NEWS[0].id : 0;
  const unread = () => G.S ? G.NEWS.filter(n => n.id > (G.S.newsSeen || 0)).length : 0;
  function refreshBadge() {
    const b = $('hbNews'); if (!b) return;
    const n = unread(); b.classList.toggle('badge', n > 0); b.dataset.n = n > 0 ? 'NEW' : '';
  }

  function build() {
    const el = document.createElement('div'); el.id = 'newsWin'; el.className = 'hidden';
    el.innerHTML = `<div class="nwBox panel"><div class="nwHead"><span class="nwTitle">お知らせ</span><button id="nwClose" title="閉じる">✕</button></div><div class="nwList" id="nwList"></div></div>`;
    document.body.appendChild(el);
    $('nwClose').onclick = close;
    el.onclick = e => { if (e.target === el) close(); };
    // ホーム上部の「お知らせ」ボタン（設定の左）
    const set = $('hbSet');
    if (set) { const b = document.createElement('button'); b.id = 'hbNews'; b.className = 'hubIcon newsBtn'; b.textContent = 'お知らせ'; b.onclick = () => open(); set.parentNode.insertBefore(b, set); }
  }
  function open() {
    const S = G.S, seen = S.newsSeen || 0;
    $('nwList').innerHTML = G.NEWS.length ? G.NEWS.map((n, i) => `
      <div class="nwItem ${n.id > seen ? 'new' : ''} ${i === 0 ? 'open' : ''}">
        <div class="nwRow"><span class="nwTag ${TAG[n.tag] || 'info'}">${esc(n.tag || 'お知らせ')}</span><span class="nwDate">${esc(n.date || '')}</span>${n.id > seen ? '<span class="nwNew">NEW</span>' : ''}</div>
        <div class="nwT">${esc(n.title)}</div>
        <div class="nwBody">${esc(n.body || '').replace(/\n/g, '<br>')}</div>
      </div>`).join('') : '<div class="small" style="padding:20px">お知らせはありません</div>';
    $('nwList').querySelectorAll('.nwItem').forEach(it => it.onclick = () => it.classList.toggle('open'));
    $('nwList').scrollTop = 0;
    $('newsWin').classList.remove('hidden');
    S.newsSeen = Math.max(seen, latest()); G.save(); refreshBadge();
    G.sfx && G.sfx('click');
  }
  function close() { $('newsWin').classList.add('hidden'); }
  G.openNews = open;

  // ホームに来た時、未読があれば一度だけ自動で開く（タイトル画面・切り替え中・他の画面を開いている時は待つ）
  const update0 = ui.update;
  ui.update = function (dt) {
    update0(dt);
    const S = G.S; if (!S || autoShown) return;
    // 自動出撃で放置している時は開かない（NEWの印だけ）。起動直後など自分で操作している時に開く
    if (S.mode === 'home' && !ui.titleOn && !G.trans && (G.manualStart || S.settings.waitHome) && unread() > 0 && $('modal').classList.contains('hidden') && $('gfx').classList.contains('hidden')) { autoShown = true; open(); }
  };
  build();
  G.loadNews();
  document.addEventListener('visibilitychange', () => { if (!document.hidden) G.loadNews().then(() => { if (unread() > 0) autoShown = false; }); });
})();
