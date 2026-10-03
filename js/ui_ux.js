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

  // ---------------------------------------------------------- 付与の変更（1枠だけ）
  // 枠と系統を選んで変える → 変更前と変更後を見比べて、どちらを残すか選ぶ。狙った付与を確定で付けることもできる（素材6倍）
  G.openReroll = id => {
    const st = { idx: 0, cat: 'any', pick: '', res: null };
    show({
      key: 'reroll' + id, title: '付与の変更', render(b) {
        const it = G.itemById(id); if (!it) { close(); return; }
        const core = it.uq ? G.UNIQUE[it.uq].af : null, isCore = i => core && it.af[i].k === core; // 固有効果の要になる付与は変えない
        if (isCore(st.idx)) st.idx = it.af.findIndex((a, i) => !isCore(i));
        if (st.idx < 0) { b.innerHTML = '<div class="small">この装備の付与は変えられません</div>'; return; }
        const cost = G.rerollCost(it), others = new Set(it.af.filter((a, i) => i !== st.idx).map(a => a.k));
        const pool = G.AFFIX_POOL[it.slot].filter(k => !others.has(k) && k !== it.af[st.idx].k);
        const afLine = a => `<b>${esc(G.AFX[a.k].n)} Lv${a.lv}</b> <span class="small">${esc(G.AFX[a.k].d(a.lv))}</span>`;
        if (st.res) { // 結果：どちらを残すか
          b.innerHTML = `<div class="small">${esc(it.name)}　の ${st.idx + 1}枠目</div>
            <div class="rrCmp"><div class="rrOld"><div class="small">変更前</div>${afLine(st.res.old)}</div><div class="rrArrow">→</div><div class="rrNew"><div class="small">変更後</div>${afLine(st.res.nu)}</div></div>
            <div class="lbBtn"><button id="rrTake" class="primary big">変更後にする</button><button id="rrKeep">元のまま</button></div>
            <div class="small" style="text-align:center">素材 ${st.res.cost} を使いました（どちらを選んでも戻りません）</div>`;
          $('rrTake').onclick = () => { G.applyReroll(id, st.idx, st.res.nu); G.sfx('pickup', 3); ui.toast('付与を「' + G.AFX[st.res.nu.k].n + '」に変えました'); st.res = null; refreshCur(); ui.render && ui.render(); };
          $('rrKeep').onclick = () => { st.res = null; refreshCur(); };
          return;
        }
        b.innerHTML = `<div class="small">${esc(it.name)}　ほかの付与・セット・強化はそのまま。手持ちの強化素材：<b>${G.S.mats.forge}</b></div>
          <div class="h" style="margin-top:6px">変える枠</div>${it.af.map((a, i) => isCore(i) ? `<div class="rrRow lockd">🔒 ${afLine(a)}<div class="small">固有効果に必要な付与なので変えられません</div></div>` : `<label class="rrRow ${i === st.idx ? 'on' : ''}"><input type="radio" name="rrIdx" value="${i}" ${i === st.idx ? 'checked' : ''}> ${afLine(a)}</label>`).join('')}
          <div class="h" style="margin-top:6px">変更先の系統</div><div class="polGrid">${Object.entries(G.AF_CAT).map(([k, c]) => { const n = c.k ? pool.filter(x => c.k.includes(x)).length : pool.length; return `<button data-cat="${k}" class="${k === st.cat ? 'primary' : ''}" ${n ? '' : 'disabled'}>${c.n}（${n}）</button>`; }).join('')}</div>
          <div class="lbBtn"><button id="rrGo" class="primary big" ${G.S.mats.forge < cost ? 'disabled' : ''}>ランダムに変える（素材 ${cost}）</button></div>
          <div class="h" style="margin-top:8px">狙った付与を確定で付ける（素材 ${cost * 6}）</div>
          <div class="row" style="gap:6px;flex-wrap:wrap"><select id="rrPick"><option value="">付与を選ぶ</option>${pool.map(k => `<option value="${k}" ${st.pick === k ? 'selected' : ''}>${esc(G.AFX[k].n)}（${esc(G.AFX[k].g)}）</option>`).join('')}</select><button id="rrFix" ${!st.pick || G.S.mats.forge < cost * 6 ? 'disabled' : ''}>確定で付ける</button></div>`;
        b.querySelectorAll('[name=rrIdx]').forEach(x => x.onchange = () => { st.idx = +x.value; st.pick = ''; refreshCur(); });
        b.querySelectorAll('[data-cat]').forEach(x => x.onclick = () => { st.cat = x.dataset.cat; refreshCur(); });
        $('rrPick').onchange = e => { st.pick = e.target.value; refreshCur(); };
        const roll = pick => { const r = G.rerollAffix(id, st.idx, pick ? 'any' : st.cat, pick || ''); if (r.err) { ui.toast(r.err); return; } st.res = r; G.sfx('enh'); refreshCur(); };
        $('rrGo').onclick = () => roll('');
        $('rrFix').onclick = () => roll(st.pick);
      }
    });
  };

  // ---------------------------------------------------------- 祝福の方針（ホームで選ぶ）と、祝福・覚醒の一覧
  G.openBlessPol = () => show({
    key: 'blessPol', title: '祝福の方針', render(b) {
      const cur = G.S.settings.blessPol || 'auto';
      b.innerHTML = `<div class="small">探索中、祭壇の部屋・守護者・階層の主から祝福を自動で得ます（帰還や力尽きると消えます）。選んだ系統が出やすくなります。</div>
        <div class="polGrid">${Object.entries(G.BLESS_POL).map(([k, n]) => `<button data-pol="${k}" class="${k === cur ? 'primary' : ''}">${n}</button>`).join('')}</div>
        <div class="h" style="margin-top:10px">祝福（12種類・最大Lv3）</div>
        ${Object.values(G.BLESS).map(x => `<div class="blRow"><span class="bl" style="--c:${x.col}">${x.ic}</span><div><b>${esc(x.n)}</b><div class="small">${esc(x.d(1))}</div></div></div>`).join('')}
        <div class="h" style="margin-top:10px">覚醒（2つの祝福がそろうと発動）</div>
        ${G.AWAKEN.map(a => `<div class="blRow"><span class="bl aw" style="--c:${a.col}">覚</span><div><b style="color:${a.col}">${esc(a.n)}</b>　<span class="small">${a.need.map(k => G.BLESS[k].n).join(' ＋ ')}</span><div class="small">${esc(a.d)}</div></div></div>`).join('')}`;
      b.querySelectorAll('[data-pol]').forEach(x => x.onclick = () => { G.S.settings.blessPol = x.dataset.pol; G.save(); G.sfx('click'); refreshCur(); });
    }
  });

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

  // ---------------------------------------------------------- 結果画面の「何が強かったか」
  const SRC_N = { atk: '通常攻撃', skill: '技', ult: '必殺技', chain: '連鎖雷', follow: '追撃斬', boom: '撃破爆発', burn: '燃焼', poison: '毒', uq_ret: '迅雷の剣', uq_mark: '氷印の宝玉', mech: 'キャラ固有の一撃', sup: '仲間の支援' };
  function srcName(k) {
    if (k === 'mech' && G.CHAR_MECH && G.CHAR_MECH[G.S.cur]) return G.CHAR_MECH[G.S.cur].n + '（固有）';
    if (k.startsWith('sk_')) { const id = k.slice(3); try { return G.skillEvo(id).names[G.skillStageOf(G.skillLvAt(id, G.S.level))] || G.SKILLS[id].n; } catch (e) { return (G.SKILLS[id] || {}).n || '技'; } }
    return SRC_N[k] || (G.bless && G.bless.src[k]) || k;
  }
  function breakdown(lr) {
    const d = lr.dmg || {}, tot = Object.values(d).reduce((a, b) => a + b, 0);
    let h = '';
    if (tot > 0) {
      const top = Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 4);
      h += `<div class="rsH">今回の主力：<b>${esc(srcName(top[0][0]))}</b>（総ダメージの${Math.round(top[0][1] / tot * 100)}%）</div>` +
        top.map(([k, v]) => `<div class="rsBar"><span>${esc(srcName(k))}</span><i><b style="width:${(v / tot * 100).toFixed(1)}%"></b></i><em>${Math.round(v / tot * 100)}%</em></div>`).join('');
    }
    const notes = [];
    if (lr.burst >= 3) notes.push(`最大同時撃破 <b>${lr.burst}体</b>`);
    const pv = G.S.prevRun;
    if (pv) { const df = lr.floor - pv.floor; notes.push(df > 0 ? `前回より<b class="up">${df}階深く</b>到達` : df < 0 ? `前回より${-df}階浅い` : '前回と同じ階まで到達'); }
    if (notes.length) h += `<div class="small rsNotes">${notes.join('　')}</div>`;
    const bl = Object.entries(lr.bless || {});
    if (bl.length) h += `<div class="rsBless"><span class="small">祝福：</span>${bl.map(([id, l]) => { const b = G.BLESS[id]; return b ? `<span class="bl" style="--c:${b.col}">${b.ic}<i>${l}</i></span>${esc(b.n)}` : ''; }).join(' ')}</div>`;
    if ((lr.awk || []).length) h += `<div class="rsAwk">覚醒：${lr.awk.map(a => { const A = G.AWAKEN.find(x => x.id === a); return A ? `<b style="color:${A.col}">${esc(A.n)}</b>` : ''; }).join('・')}</div>`;
    return h;
  }

  // 敗因：一番ダメージを受けた相手と、次にどうすればよいか（1タップで育成方針を変えられる）
  const ROLE_TIP = {
    boss: ['ボスの攻撃に押し切られた', 'HP・防御を上げると耐えられます', 'safe'],
    ranged: ['離れた所からの矢に削られた', '移動速度や攻撃範囲を上げて先に倒そう', 'mob'],
    caster: ['魔導士の火の玉に削られた', '火の玉は斬って消せます。攻撃速度を上げよう', 'mob'],
    heavy: ['ゴーレムの重い一撃を受けた', '防御を上げるとダメージを大きく減らせます', 'safe'],
    swarm: ['群れに囲まれて削られた', '範囲攻撃（連鎖雷・撃破爆発）でまとめて倒そう', 'mob'],
    fast: ['素早い敵に翻弄された', '攻撃速度や攻撃範囲を上げよう', 'mob'],
    melee: ['近くの敵との殴り合いに負けた', '攻撃力と防御のバランスを上げよう', 'auto'],
  };
  function cause(lr) {
    const tk = Object.entries(lr.taken || {}), tot = tk.reduce((a, b) => a + b[1], 0);
    const coin = G.S.coins >= G.GACHA.single ? `コインが${G.S.coins.toLocaleString()}枚あります。ガチャで装備を手に入れて強くなろう！` : '敵を倒してコインを集め、ガチャで装備や仲間を手に入れて強くなろう。';
    if (!tot) return `<div class="small" style="margin-top:6px">ヒント：${coin}</div>`;
    tk.sort((a, b) => b[1] - a[1]);
    const [n, v] = tk[0], role = (lr.takenK || {})[n] || 'melee', mob = (lr.mob || 0) >= 5;
    const tip = mob && role !== 'boss' ? ['敵に囲まれて倒れた（' + lr.mob + '体）', '範囲攻撃でまとめて倒すのがおすすめ', 'mob'] : ROLE_TIP[role] || ROLE_TIP.melee;
    const pol = tip[2], curPol = G.S.settings.eqPolicy || 'auto';
    return `<div class="rsCause"><div class="rsCH">敗因：<b>${esc(tip[0])}</b></div>
      <div class="small">一番ダメージを受けた相手：<b>${esc(n)}</b>（受けたダメージの${Math.round(v / tot * 100)}%）${lr.lastHit && lr.lastHit !== n ? '／とどめ：' + esc(lr.lastHit) : ''}</div>
      <div class="small">対策：${esc(tip[1])}。${coin}</div>
      ${pol !== curPol && G.EQ_POLICY[pol] ? `<button class="rsPol" data-pol="${pol}">育成方針を「${G.EQ_POLICY[pol].n}」にする</button>` : ''}</div>`;
  }

  // ---------------------------------------------------------- 探索の結果
  let prevMax = 0, lastRunSeen = null, inited = false;
  const depart0 = G.depart;
  let prevLv = 0;
  G.depart = function (resume) { if (G.S) { prevMax = G.S.maxFloor; prevLv = G.S.level; } closeAll(); return depart0.apply(this, arguments); };
  function resultPopup(lr, msg) {
    const rec = lr.floor > prevMax && prevMax > 0, t = lr.t || 0, dead = /力尽き/.test(msg || '');
    show({
      key: 'result', title: dead ? '探索失敗…' : '探索結果', cls: dead ? 'result dead' : 'result', render(b) {
        // ランク：何階進めたか・最大コンボで決める
        const gain = lr.floor - (lr.start || 1), rank = gain >= 10 || lr.best >= 150 ? 'S' : gain >= 6 || lr.best >= 80 ? 'A' : gain >= 3 || lr.best >= 30 ? 'B' : 'C';
        b.innerHTML = `<div class="rsTop"><div class="rsRank r${rank}">${rank}</div><div>${rec ? '<div class="rsRec">最深記録 更新！</div>' : ''}<div class="rsMsg">${esc(msg || '')}</div><div class="small">B${lr.start || 1}F → B${lr.floor}F（${Math.max(0, gain)}階 進んだ）</div></div></div>
          <div class="rsGrid">
            <div><span>到達</span><b>B${lr.floor}F</b></div><div><span>撃破</span><b data-cnt="${lr.kills}">0</b></div>
            <div><span>最大コンボ</span><b data-cnt="${lr.best}">0</b></div><div><span>コイン</span><b class="gold" data-cnt="${lr.coins || 0}" data-pre="+">+0</b></div>
            <div><span>レベル</span><b>${prevLv && prevLv < G.S.level ? 'Lv' + prevLv + '→' : 'Lv'}${G.S.level}</b></div><div><span>時間</span><b>${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}</b></div>
          </div>
          ${breakdown(lr)}
          ${dead ? cause(lr) : ''}
          ${G.S.coins >= G.GACHA.single ? `<div class="lbBtn"><button id="rsGacha" class="gachaBtn big">ガチャを引く（${Math.floor(G.S.coins / G.GACHA.single)}回分）</button></div>` : ''}
          <div class="lbBtn">${G.resumeRun ? '<button id="rsGo" class="primary big">続きから出撃</button>' : `<button id="rsGo" class="primary big">B${G.checkpoint()}Fから出撃</button>`}<button id="rsOk">ホームへ</button></div>`;
        $('rsGo').onclick = () => { closeAll(); G.depart(!!G.resumeRun, G.checkpoint()); };
        $('rsOk').onclick = close;
        const pb = b.querySelector('[data-pol]');
        if (pb) pb.onclick = () => { G.S.settings.eqPolicy = pb.dataset.pol; if (G.S.settings.autoEquip && G.autoEquip) G.autoEquip(); G.save(); G.sfx('lvup'); pb.disabled = true; pb.textContent = '育成方針を「' + G.EQ_POLICY[pb.dataset.pol].n + '」にしました'; };
        // 数字が0から増えていく
        const cells = [...b.querySelectorAll('[data-cnt]')], t0 = performance.now();
        const tick = () => { const p = Math.min(1, (performance.now() - t0) / 900), e = 1 - Math.pow(1 - p, 3); for (const c of cells) c.textContent = (c.dataset.pre || '') + Math.round(+c.dataset.cnt * e).toLocaleString(); if (p < 1 && document.body.contains(b)) requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        if ($('rsGacha')) $('rsGacha').onclick = () => { closeAll(); ui.open('gacha'); };
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
    const neverPulled = (S.gachaSeq || 1) <= 1 && S.coins >= G.GACHA.single; // まだ一度もガチャを引いていない人には、ガチャの案内を出したままにする
    if (G.bless) G.bless.refreshHud(); // 状態の枠の祝福（変わった時だけ描き直す）
    if (cur && autoOn && ['result', 'login', 'tips'].includes(cur.key)) { // 自分で開いた画面（ミッション・方針・付与の変更など）は閉じない
      cur.t = (cur.t || 0) + dt; const lim = cur.key === 'result' ? (neverPulled ? 12 : 6) : 10; // ガチャ未経験なら案内を長めに出す
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
    // ガチャが引けるだけコインがある時は、ガチャのボタンとバナーで知らせる（装備はガチャで手に入る）
    const canPull = S.coins >= G.GACHA.single, gb = document.querySelector('.hubM[data-p="gacha"]');
    if (gb) { gb.classList.toggle('badge', canPull); gb.dataset.n = canPull ? '引ける！' : ''; }
    const bn = $('hbGacha'); if (bn) bn.classList.toggle('ready', canPull);
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
    // キャラ固有のゲージ（連撃・帯電・冷気・集中）
    const M = G.CHAR_MECH && G.CHAR_MECH[S.cur], cb = $('cmBar');
    if (cb && H && M) {
      if (cb.dataset.c !== S.cur) { cb.dataset.c = S.cur; cb.style.setProperty('--cm', M.col); $('cmTxt').textContent = M.n; cb.title = M.n + '：' + M.d; }
      $('cmFill').style.width = ((H.cmFull ? 1 : H.cm || 0) * 100) + '%'; cb.classList.toggle('full', !!H.cmFull);
    }
    // 自動出撃までの残り時間（出撃ボタンのゲージ）
    const go = $('hbGo');
    if (go) go.classList.toggle('first', home && !S.stats.runs && !cur); // まだ一度も出撃していない人には出撃ボタンを指さす
    if (go) { const auto = home && !S.settings.waitHome && !G.manualStart; go.classList.toggle('auto', auto); go.style.setProperty('--p', auto ? Math.max(0, Math.min(1, 1 - G.homeT / 3.5)).toFixed(3) : 0); }
  };
  build();
  // ミニマップ：タップで大きく
  $('miniWrap').addEventListener('click', () => { $('miniWrap').classList.toggle('big'); G.S && (G.S.mode !== 'home') && G.sfx('click'); });
})();
