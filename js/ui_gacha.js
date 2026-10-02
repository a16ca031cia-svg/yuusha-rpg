'use strict';
// ===== キャラ・ガチャの画面、ガチャ演出、必殺技のカットイン =====
(function () {
  const ui = G.ui, $ = id => document.getElementById(id), esc = s => ui.esc(s);
  ui.extra = ui.extra || {};
  const ART = c => 'img/chars/' + c + '_art.webp';            // ガチャ用の立ち絵
  const pixCache = {};
  // ドット絵の顔（一覧用）：勇者は立ち絵の1コマ、他のキャラは正面立ち絵
  function pixURL(c) {
    if (pixCache[c]) return pixCache[c];
    const cv = c === 'hero' ? (G.heroPose && G.heroPose('idle', 0)) : G.charPortrait(c);
    if (!cv || !cv.width) return '';
    // 余白を切り詰めて上半身を大きく
    const s = G.canvas(84, 84), x = s.getContext('2d'); x.imageSmoothingEnabled = false;
    const ox = c === 'hero' ? G.HERO_FRAME.OX : 84, oy = c === 'hero' ? G.HERO_FRAME.OY : 146;
    x.drawImage(cv, ox - 46, oy - 126, 92, 92, -4, 0, 92, 92);
    const u = s.toDataURL(); if (cv.width > 2) pixCache[c] = u; return u;
  }
  const stars = n => '★'.repeat(n) + '<span class="dimst">' + '★'.repeat(5 - n) + '</span>';
  const charLv = c => { const S = G.S; return c === S.cur ? S.level : (S.chars[c] && S.chars[c].level) || 1; };

  // ------------------------------------------------------------ ホームの選択中キャラ
  const refreshHome0 = ui.refreshHome;
  ui.refreshHome = function () {
    refreshHome0();
    const S = G.S, c = S.cur, C = G.CHARS[c], el = $('homeChar'); if (!el) return;
    el.innerHTML = `<img src="${pixURL(c)}" alt=""><div><div class="hcName" style="color:${C.col}">${esc(C.n)}</div><div class="small">${stars(G.curStar())}　Lv ${S.level}　コイン ${S.coins.toLocaleString()}枚</div></div>`;
  };
  setTimeout(() => {
    $('hCharBtn').onclick = () => ui.open('chara');
    $('hGachaBtn').onclick = () => ui.open('gacha');
  });

  // ------------------------------------------------------------ HUD：必殺技ゲージ・コイン
  const update0 = ui.update;
  ui.update = function (dt) {
    update0(dt);
    const H = G.hero; if (!H || !H.st) return;
    const v = Math.min(1, (H.ult || 0) / G.ULT.max);
    $('ultFill').style.width = (v * 100) + '%';
    $('ultBar').classList.toggle('full', v >= 1);
    $('ultTxt').textContent = v >= 1 ? '必殺技 準備OK' : '必殺';
  };
  let coinTO = 0;
  ui.coinPop = function () { const e = $('goldTxt'); e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); clearTimeout(coinTO); coinTO = setTimeout(() => e.classList.remove('pop'), 400); };

  // ------------------------------------------------------------ キャラ画面
  let selC = null;
  ui.extra.chara = function (b) {
    const S = G.S; selC = selC || S.cur;
    const cards = G.CHAR_ORDER.map(c => {
      const C = G.CHARS[c], o = S.chars[c] || {}, own = !!o.own;
      return `<div class="chCard ${selC === c ? 'sel' : ''} ${own ? '' : 'locked'}" data-c="${c}" style="--cc:${C.col}">
        <img src="${pixURL(c)}" alt="" style="${own ? '' : 'filter:brightness(0) opacity(.55)'}">
        <div class="chInfo"><div class="hcName" style="color:${C.col}">${esc(own || c === 'hero' ? C.n : '？？？')}</div>
        <div class="small">${esc(C.sub)}${C.gacha ? '　<span class="urtag">UR</span>' : ''}</div>
        <div class="small">${own ? `${stars(o.star || 1)}　Lv ${charLv(c)}` : 'ガチャで入手'}</div></div>
        ${c === S.cur ? '<span class="eqtag">出撃中</span>' : ''}</div>`;
    }).join('');
    const C = G.CHARS[selC], o = S.chars[selC] || {}, own = !!o.own, st = own ? (o.star || 1) : 1;
    const base = C.base, pct = v => Math.round(v * 100) + '%';
    const skills = C.skills.map(id => { const sk = G.SKILLS[id], ln = (selC === S.cur ? S.learned : (o.learned || [])).includes(id); return `<div class="small">${ln ? '◆' : '◇'} Lv${sk.lv} <b style="color:${ln ? '#efe6d2' : '#8a8070'}">${esc(sk.n)}</b>　${esc(sk.desc)}</div>`; }).join('');
    const starRows = [[2, '基礎能力 +' + Math.round((G.STAR_STAT[2] - 1) * 100) + '%'], [3, '基礎能力 +' + Math.round((G.STAR_STAT[3] - 1) * 100) + '%・技と必殺技の威力 +20%・連鎖数／範囲／斬撃数が増える'], [4, '基礎能力 +' + Math.round((G.STAR_STAT[4] - 1) * 100) + '%'], [5, '基礎能力 +' + Math.round((G.STAR_STAT[5] - 1) * 100) + '%・技と必殺技の威力 さらに+30%・連鎖数／範囲／斬撃数がさらに増える']];
    const canSwitch = own && selC !== S.cur && S.mode === 'home';
    b.innerHTML = `<div class="col" style="width:330px;flex:none"><div class="h">キャラクター</div>${cards}
        <div class="small" style="margin-top:6px">キャラの交代はホームでだけできます。レベル・経験値・技・装備の設定はキャラごとに保存され、所持品はみんなで共有します。</div></div>
      <div class="col scroll" style="flex:1;min-width:0">
        <div class="row" style="justify-content:space-between"><div class="h" style="font-size:16px;color:${C.col}">${esc(own || selC === 'hero' ? C.n : '？？？')}</div>
          ${canSwitch ? '<button id="chSwitch" class="primary">このキャラで出撃する</button>' : selC === S.cur ? '<span class="eqtag">出撃中</span>' : own ? '<span class="small">探索中は交代できません</span>' : '<button id="chGacha" class="gachaBtn">ガチャで仲間にする</button>'}</div>
        ${C.gacha ? `<img class="chArt" src="${ART(selC)}" alt="" style="${own ? '' : 'filter:brightness(0) opacity(.5)'}">` : ''}
        <div class="small">${esc(C.desc)}　属性：${esc(C.el)}${C.ranged ? '（遠距離攻撃）' : ''}</div>
        <div class="small">能力の倍率：HP ${pct(base.hp)}　攻撃力 ${pct(base.atk)}　防御力 ${pct(base.def)}　攻撃速度 ${pct(base.aspd)}${base.crit ? '　会心率 +' + Math.round(base.crit * 100) + '%' : ''}${base.critd ? '　会心威力 +' + Math.round(base.critd * 100) + '%' : ''}</div>
        <div class="h" style="margin-top:6px">必殺技：${esc(C.ult.n)}</div><div class="small">${esc(C.ult.d)}<br>攻撃の命中と敵の撃破でゲージがたまり、満タンで近くに敵がいれば自動で発動します。</div>
        <div class="h" style="margin-top:6px">技（レベルで習得）</div>${skills}
        ${C.gacha ? `<div class="h" style="margin-top:6px">限界突破（同じキャラを引くと★が上がる）　現在 ${own ? stars(st) : '未所持'}</div>${starRows.map(([n, t]) => `<div class="small" style="color:${own && st >= n ? '#7fe07a' : ''}">★${n}：${esc(t)}</div>`).join('')}<div class="small">★5のあとに引いた分は、育成素材「英雄の魂」${G.SOUL_PER_DUP}個に変わります。</div>` : '<div class="small" style="margin-top:6px">初期主人公は★1のまま育てます（限界突破はありません）。</div>'}
        ${selC === S.cur ? `<div class="row" style="margin-top:8px"><span class="small">英雄の魂 ${S.mats.soul}個</span><button id="soulUse" ${S.mats.soul ? '' : 'disabled'}>魂を1個使う（経験値を得る）</button></div>` : ''}
      </div>`;
    b.querySelectorAll('.chCard').forEach(el => el.onclick = () => {
      selC = el.dataset.c; ui.render();
      if (G.TOUCH || innerWidth <= 760) { const d = $('mBody').querySelector('.col.scroll'); if (d) d.scrollIntoView({ behavior: 'smooth', block: 'start' }); } // スマホは詳しい説明が下にあるので、そこまで動かす
    });
    if ($('chGacha')) $('chGacha').onclick = () => ui.open('gacha');
    if ($('chSwitch')) $('chSwitch').onclick = () => { const err = G.switchChar(selC); ui.toast(err || G.CHARS[selC].n + ' で出撃します'); ui.render(); ui.refreshHome(); };
    if ($('soulUse')) $('soulUse').onclick = () => { if (G.useSoul(1)) ui.toast('英雄の魂を使いました'); ui.render(); };
  };

  // ------------------------------------------------------------ ガチャ画面
  ui.extra.gacha = function (b) {
    const S = G.S, GC = G.GACHA, home = S.mode === 'home';
    const urPool = G.gachaURPool(), allUR = G.CHAR_ORDER.filter(c => G.CHARS[c].gacha), prio = urPool.length < allUR.length;
    const left = GC.pity - S.pity, urEach = +(GC.rates[0][1] * 100 / urPool.length).toFixed(4); // 1%÷候補の人数（表示用の丸め。抽選には使わない）
    const urNote = prio
      ? `<b style="color:#ffb0f0">まだ持っていないキャラが優先！</b> URが出た時は ${urPool.map(c => esc(G.CHARS[c].n)).join('・')} から${urPool.length > 1 ? '等しい確率で' : '必ず'}出ます。1人あたり 約${urEach}%`
      : `URが出た時は${allUR.length}人から等しい確率。1人あたり 約${urEach}%`;
    // コインが足りない時は「あと何枚」かを出す
    const btn = (n, cost) => `<button class="gBig ${S.coins >= cost && home ? 'primary' : ''}" data-pull="${n}" ${S.coins >= cost && home ? '' : 'disabled'}>${n === 1 ? '単発' : '10連'}<br><span class="small">${cost.toLocaleString()}枚</span>${S.coins < cost ? `<br><span class="gShort">あと${(cost - S.coins).toLocaleString()}枚</span>` : ''}</button>`;
    b.innerHTML = `<div class="col scroll" style="flex:1;min-width:0">
      <div class="gHead"><div class="gTitle">英雄召喚ガチャ</div>
        <div class="gArts">${G.CHAR_ORDER.filter(c => G.CHARS[c].gacha).map(c => `<img src="${ART(c)}" alt="">`).join('')}</div></div>
      <div class="row" style="justify-content:space-between;margin-top:6px"><div><div class="h">所持コイン <span style="font-size:20px;color:#ffe9a0">${S.coins.toLocaleString()}</span> 枚</div>
        <div class="small">UR確定まで あと <b style="color:#ffb0f0">${left}</b> 回（${GC.pity}回でUR確定。単発・10連共通）</div></div>
        <div class="row">${btn(1, GC.single)}${btn(10, GC.ten)}</div></div>
      ${home ? '' : '<div class="row" style="align-items:center;margin-top:4px"><span class="small" style="color:#ff9a7a">ガチャはホームで引けます</span><button id="gRet">⌂ 帰還してガチャへ</button></div>'}
      <div class="small">所持品 ${S.items.length}/${G.INV_CAP}　自動分解 ${S.autoDis.on ? G.RARITY[S.autoDis.maxRar].n + ' 以下' : 'OFF'}　強化素材 ${S.mats.forge.toLocaleString()}　英雄の魂 ${S.mats.soul}</div>
      <div class="h" style="margin-top:8px">排出内容と確率</div>
      <table class="rates"><tr><th>レア度</th><th>内容</th><th>確率</th></tr>
        <tr><td><span class="urtag">UR</span></td><td>キャラクター（${G.CHAR_ORDER.filter(c => G.CHARS[c].gacha).map(c => esc(G.CHARS[c].n)).join('・')}）<br><span class="small">${urNote}</span></td><td>1%</td></tr>
        <tr><td style="color:${G.RARITY[3].c}">SSR</td><td>装備（まれにさらに強い SSR+）<br><span class="small">SSRの30%・SSR+の60%は、戦い方を変える<span class="uqtag">固有</span>効果の装備</span></td><td>4%</td></tr>
        <tr><td style="color:${G.RARITY[2].c}">SR</td><td>装備</td><td>15%</td></tr>
        <tr><td style="color:${G.RARITY[1].c}">R</td><td>装備</td><td>80%</td></tr></table>
      <div class="small" style="margin-top:4px">装備の性能は、引いた時点の最深到達階層（B${Math.max(1, S.maxFloor)}F）を基準に決まります。まだ持っていないキャラがいる間は、URはその中からだけ出ます。全員そろった後に同じキャラを引くと★が上がります（最大★5）。</div>
      ${S.gachaLast ? '<div class="row" style="margin-top:8px"><button id="gLast">前回の結果を見る</button></div>' : ''}
    </div>`;
    b.querySelectorAll('[data-pull]').forEach(el => el.onclick = () => pull(+el.dataset.pull));
    if ($('gRet')) $('gRet').onclick = () => { ui.close(); G.afterHome = 'gacha'; G.retreat(); }; // ホームに着いたらガチャ画面を開く
    if ($('gLast')) $('gLast').onclick = () => { ui.close(); showResults(G.S.gachaLast); };
  };
  let busy = false;
  function pull(n) {
    if (busy) return; // 連打で二重に引かない
    const r = G.gachaPull(n);
    if (r.err) { ui.toast(r.err); return; }
    busy = true; ui.close(); playGacha(r);
  }

  // ------------------------------------------------------------ ガチャ演出
  const gfx = () => $('gfx');
  let timers = [], raf = 0, curRec = null;
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  function clearAll() { timers.forEach(clearTimeout); timers = []; cancelAnimationFrame(raf); }
  const chestURL = (() => { let a = null, b = null; return open => { if (!a) { const c1 = G.canvas(G.CHEST.n.width, G.CHEST.n.height); c1.getContext('2d').drawImage(G.CHEST.n, 0, 0); a = c1.toDataURL(); const c2 = G.canvas(G.CHEST_OPEN.n.width, G.CHEST_OPEN.n.height); c2.getContext('2d').drawImage(G.CHEST_OPEN.n, 0, 0); b = c2.toDataURL(); } return open ? b : a; }; })();
  function playGacha(rec) {
    curRec = rec; clearAll();
    const el = gfx(); el.className = ''; el.innerHTML = `<div class="gfxBg"></div><div class="gfxStage"><div class="gfxGlow"></div><img class="gfxChest" src="${chestURL(false)}" alt=""></div><canvas class="gfxFx"></canvas><button class="gfxSkip">スキップ ≫</button>`;
    el.querySelector('.gfxSkip').onclick = () => { clearAll(); showResults(rec); };
    const urs = rec.res.filter(r => r.t === 'ur');
    const best = Math.max(...rec.res.map(r => r.t === 'ur' ? 5 : r.it.rar));
    G.sfx('chest');
    el.classList.add('drop');
    if (!urs.length) {
      // 装備だけ：宝箱がはねて開き、いちばん良いレア度の色で光る
      later(600, () => { el.classList.add('shake'); G.sfx('pickup', 2); });
      later(1000, () => { el.classList.add('open', 'r' + Math.min(4, best)); el.querySelector('.gfxChest').src = chestURL(true); G.sfx('pickup', best); });
      later(1700, () => showResults(rec));
      return;
    }
    // UR：開く直前に止まり、音が途切れる → 虹色の光が漏れて揺れる → 光とともに開いて召喚空間へ
    later(700, () => { el.classList.add('hush'); G.music.stop(.15); });
    later(1500, () => { el.classList.add('omen'); G.sfx('omen'); });
    later(2900, () => { el.classList.add('burst'); el.querySelector('.gfxChest').src = chestURL(true); ui.flash(.95, '#ffffff'); G.sfx('boom'); });
    later(3300, () => { el.classList.add('summon'); urReveal(urs, 0, rec); });
  }
  // URキャラの登場（1人ずつ）：シルエット＋固有エフェクト → 立ち絵・名前・UR・ファンファーレ → NEW／★／素材
  function urReveal(urs, i, rec) {
    if (i >= urs.length) { later(200, () => showResults(rec)); return; }
    const r = urs[i], C = G.CHARS[r.c], el = gfx();
    const old = el.querySelector('.urBox'); if (old) old.remove();
    const box = document.createElement('div'); box.className = 'urBox';
    box.innerHTML = `<img class="urArt" src="${ART(r.c)}" alt=""><div class="urText"><div class="urBadge">UR</div><div class="urName" style="--cc:${C.col}">${esc(C.n)}</div><div class="urSub">${esc(C.sub)}</div><div class="urResult"></div></div>`;
    el.appendChild(box);
    el.classList.remove('reveal'); void el.offsetWidth;
    elemFx(r.c, 1900);
    later(300, () => box.classList.add('sil'));
    later(2200, () => { box.classList.add('show'); el.classList.add('reveal'); ui.flash(.8, C.col); G.music.jingle('ur'); });
    later(3200, () => {
      const res = box.querySelector('.urResult');
      res.innerHTML = r.kind === 'new' ? '<span class="newBig">NEW!</span>' : r.kind === 'star' ? `<span class="starUp">${'★'.repeat(r.from)}<b>★</b></span><div class="small">限界突破！ ★${r.from} → ★${r.star}</div>` : `<span class="soulBig">英雄の魂 +${r.soul}</span><div class="small">★5に達しているため育成素材に変換</div>`;
      res.classList.add('go'); G.sfx('learn');
    });
    const next = () => { box.onclick = null; urReveal(urs, i + 1, rec); };
    later(3700, () => { box.onclick = next; });
    later(6200, next);
  }
  // 固有エフェクト（雷・氷・居合）を画面いっぱいに描く
  function elemFx(c, dur) {
    const cv = gfx().querySelector('.gfxFx'); if (!cv) return;
    const W = cv.width = innerWidth, H = cv.height = innerHeight, x = cv.getContext('2d'), t0 = performance.now();
    const seeds = Array.from({ length: 70 }, () => [Math.random(), Math.random(), Math.random()]);
    const frame = now => {
      const t = (now - t0) / dur; x.clearRect(0, 0, W, H);
      if (t > 1.15) return;
      const a = t < .15 ? t / .15 : t > .85 ? Math.max(0, 1 - (t - .85) / .3) : 1;
      x.globalAlpha = a;
      if (c === 'thunder') {
        for (let k = 0; k < 5; k++) if (Math.random() < .5) {
          let px = W * (.1 + Math.random() * .8), py = 0; x.strokeStyle = Math.random() < .5 ? '#fff6a0' : '#ffffff'; x.lineWidth = 2 + Math.random() * 5; x.shadowColor = '#ffe070'; x.shadowBlur = 24;
          x.beginPath(); x.moveTo(px, py); while (py < H) { px += (Math.random() - .5) * 90; py += 30 + Math.random() * 50; x.lineTo(px, py); } x.stroke();
        }
        x.shadowBlur = 0; x.fillStyle = 'rgba(255,240,150,.08)'; x.fillRect(0, 0, W, H);
      } else if (c === 'ice') {
        for (const [sx, sy, sz] of seeds) {
          const y = ((sy + t * (.6 + sz)) % 1) * H, xx = sx * W + Math.sin(t * 6 + sz * 9) * 20, r = 4 + sz * 14;
          x.fillStyle = sz > .6 ? '#ffffff' : '#bfeaff'; x.save(); x.translate(xx, y); x.rotate(t * 3 + sz * 6);
          x.beginPath(); x.moveTo(0, -r); x.lineTo(r * .4, 0); x.lineTo(0, r); x.lineTo(-r * .4, 0); x.closePath(); x.fill(); x.restore();
        }
        const g = x.createRadialGradient(W / 2, H / 2, 10, W / 2, H / 2, Math.max(W, H) * .7); g.addColorStop(0, 'rgba(200,240,255,0)'); g.addColorStop(1, 'rgba(160,220,255,.35)'); x.fillStyle = g; x.fillRect(0, 0, W, H);
      } else {
        for (let k = 0; k < seeds.length * Math.min(1, t * 1.6); k += 3) {
          const [sx, sy, sz] = seeds[k], cx = sx * W, cy = sy * H, L = 120 + sz * 260, ang = -.6 + sz * .3;
          x.strokeStyle = sz > .5 ? '#ffffff' : '#ff4a4a'; x.lineWidth = 1 + sz * 4; x.shadowColor = '#ff2a2a'; x.shadowBlur = 16;
          x.beginPath(); x.moveTo(cx - Math.cos(ang) * L / 2, cy - Math.sin(ang) * L / 2); x.lineTo(cx + Math.cos(ang) * L / 2, cy + Math.sin(ang) * L / 2); x.stroke();
        }
        x.shadowBlur = 0;
        for (const [sx, sy, sz] of seeds.slice(0, 30)) { const y = ((sy + t * .4) % 1) * H; x.fillStyle = '#e83a4a'; x.save(); x.translate(sx * W + Math.sin(t * 4 + sz * 8) * 30, y); x.rotate(t * 2 + sz * 5); x.fillRect(-4, -2, 8, 4); x.restore(); }
      }
      x.globalAlpha = 1;
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
  }
  // 結果一覧（スキップしても同じ内容。閉じると「確認済み」にする）
  function showResults(rec) {
    clearAll(); busy = false;
    const el = gfx(); el.className = 'results'; if (!rec) { el.classList.add('hidden'); return; }
    const cards = rec.res.map(r => {
      if (r.t === 'ur') {
        const C = G.CHARS[r.c];
        return `<div class="gCard ur" style="--cc:${C.col}"><div class="gPic"><img src="${ART(r.c)}" alt="" class="gArt"></div><div class="urtag">UR</div><div class="gName" style="color:${C.col}">${esc(C.n)}</div>
          <div class="gTag">${r.kind === 'new' ? '<span class="newtag">NEW</span>' : r.kind === 'star' ? `★${r.from}→★${r.star}` : `素材変換 魂+${r.soul}`}</div></div>`;
      }
      const it = r.it, U = it.uq && G.UNIQUE[it.uq], col = U ? U.col : G.RARITY[it.rar].c;
      return `<div class="gCard ${U ? 'uq' : ''}" style="--cc:${col}"><div class="gPic"><img class="ic" src="${G.iconURL(it.slot, it.b)}" style="border-color:${col}" alt=""></div><div class="gRar" style="color:${col}">${U ? '<span class="uqtag">固有</span>' : G.RARITY[it.rar].n}</div>
        <div class="gName" style="color:${col}">${esc(it.name)}</div><div class="gTag">${r.dis ? `分解済み 素材+${r.dis}` : G.SLOT_N[it.slot]}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="gRes"><div class="h" style="font-size:18px;text-align:center">召喚結果（${rec.n}回）</div>
      <div class="gGrid">${cards}</div>
      <div class="small" style="text-align:center">消費コイン ${rec.cost.toLocaleString()}枚　UR確定まで あと ${G.GACHA.pity - rec.pity}回　所持コイン ${G.S.coins.toLocaleString()}枚</div>
      ${(() => {
        const r = G.recommendEquip(); if (!r.changes.length) return '';
        if (G.S.settings.autoEquip) { // 自動装着ONなら、その場で付け替えて結果だけ見せる
          const p0 = G.powerOf(G.calcStats(G.S.equip)); G.applyEquip(r.plan); const p1 = G.powerOf(G.calcStats(G.S.equip)); G.save();
          return `<div class="row" style="justify-content:center;margin-top:8px"><button class="okDone big">自動で装備しました！　総合力 ${G.fmtBig(p0)} → <b style="color:#ffe36a">${G.fmtBig(p1)}</b></button></div>`;
        }
        return `<div class="row" style="justify-content:center;margin-top:8px"><button id="gEquip" class="primary big">おすすめを装備する（${r.changes.length}部位）</button></div>`;
      })()}
      ${(() => { const nu = rec.res.find(r => r.t === 'ur' && r.kind === 'new'); return nu && G.S.mode === 'home' && G.S.cur !== nu.c ? `<div class="row" style="justify-content:center;margin-top:8px"><button id="gSwitch" data-c="${nu.c}" class="gachaBtn big">${esc(G.CHARS[nu.c].n)} で出撃する</button></div>` : ''; })()}
      <div class="row" style="justify-content:center;margin-top:8px"><button id="gClose" class="primary">閉じる</button><button id="gAgain1">もう一度 単発</button><button id="gAgain10">もう一度 10連</button></div></div>`;
    // 新しく仲間になったキャラにその場で交代
    if ($('gSwitch')) $('gSwitch').onclick = () => { const c = $('gSwitch').dataset.c, err = G.switchChar(c); $('gSwitch').className = 'okDone big'; $('gSwitch').onclick = null; $('gSwitch').textContent = err || G.CHARS[c].n + ' に交代しました！'; ui.refreshHome(); };
    // 引いた装備をその場で付ける（総合力がどれだけ上がったかも見せる）
    if ($('gEquip')) $('gEquip').onclick = () => {
      const r = G.recommendEquip(), p0 = G.powerOf(G.calcStats(G.S.equip)); G.applyEquip(r.plan); const p1 = G.powerOf(G.calcStats(G.S.equip));
      G.sfx('lvup'); $('gEquip').onclick = null; $('gEquip').className = 'okDone big'; $('gEquip').innerHTML = `装備しました！　総合力 ${G.fmtBig(p0)} → <b style="color:#ffe36a">${G.fmtBig(p1)}</b>`; G.save();
    };
    const close = () => { G.gachaSeen(rec.id); el.classList.add('hidden'); el.innerHTML = ''; if (G.S.mode === 'home') G.music.play('home'); ui.refreshHome(); ui.upgradeCheck(); };
    $('gClose').onclick = close;
    $('gAgain1').onclick = () => { close(); ui.open('gacha'); pull(1); };
    $('gAgain10').onclick = () => { close(); ui.open('gacha'); pull(10); };
  }
  // 起動時：前回の結果をまだ確認していなければ表示（演出の途中で閉じても報酬は保存済み）
  const waitTitle = setInterval(() => {
    if (!G.S || ui.titleOn) return; clearInterval(waitTitle);
    if (G.S.gachaLast && !G.S.gachaLast.seen) showResults(G.S.gachaLast);
  }, 500);

  // ------------------------------------------------------------ 必殺技のカットイン（約0.8秒）
  ui.cutin = function (c) {
    const el = $('cutin'), C = G.CHARS[c];
    $('ciPic').innerHTML = C.gacha ? `<img src="${ART(c)}" alt="">` : `<img class="px" src="${pixURL(c)}" alt="">`;
    $('ciSub').textContent = C.n; $('ciName').textContent = C.ult.n;
    el.style.setProperty('--cc', C.col);
    el.classList.remove('hidden', 'go');
    // 技の名前が帯に入りきらない時は文字を小さくして全部見せる
    const nm = $('ciName'), box = el.querySelector('.ciTxt'); nm.style.fontSize = '';
    const cs = getComputedStyle(box), avail = box.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    if (avail > 0 && nm.offsetWidth > avail) nm.style.fontSize = Math.max(14, parseFloat(getComputedStyle(nm).fontSize) * avail / nm.offsetWidth * .97) + 'px';
    void el.offsetWidth; el.classList.add('go');
    clearTimeout(ui._ciTO); ui._ciTO = setTimeout(() => el.classList.add('hidden'), 900);
  };
})();
