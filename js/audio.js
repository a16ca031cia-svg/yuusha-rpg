'use strict';
// ===== サウンド：BGM（シーケンサー）と効果音をWebAudioで合成 =====
(function () {
  let ac = null, master, comp, musicBus, duckG, sfxBus, leadBus, noiseBuf;
  const pulse = {};
  const last = {};
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  // 音が止まっている（停止中・電話などで中断中）なら、画面を触った時に再開する。
  // スマホは「指を離した瞬間」や「タップ」でしか再開を許さないことがあるので、いくつかの操作で試す
  const running = () => ac && ac.state === 'running';
  function wake() {
    if (!ac || document.hidden) return;
    if (ac.state !== 'running') {
      try { const p = ac.resume(); if (p && p.then) p.then(onState, () => {}); } catch (e) { }
    }
    // 無音を一瞬鳴らすとiPhoneで音の出力が確実に有効になる
    try { const b = ac.createBuffer(1, 1, ac.sampleRate), src = ac.createBufferSource(); src.buffer = b; src.connect(ac.destination); src.start(0); } catch (e) { }
    M.next = 0;
  }
  function onState() {
    if (!G.ui) return;
    if (running()) { G.ui.audioReady && G.ui.audioReady(); } else if (!document.hidden) G.ui.audioLost && G.ui.audioLost();
  }
  function init() {
    if (ac) { wake(); return; }
    try { ac = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ac = null; return; }
    ac.onstatechange = onState;
    wake();
    comp = ac.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 8; comp.ratio.value = 5; comp.attack.value = .003; comp.release.value = .15;
    master = ac.createGain(); master.connect(comp); comp.connect(ac.destination);
    musicBus = ac.createGain(); duckG = ac.createGain();
    musicBus.connect(duckG); duckG.connect(master);
    sfxBus = ac.createGain(); sfxBus.connect(master);
    // メロディ用のエコー
    leadBus = ac.createGain(); leadBus.connect(musicBus);
    const delay = ac.createDelay(1), fb = ac.createGain(), wet = ac.createGain(), lp = ac.createBiquadFilter();
    delay.delayTime.value = .27; fb.gain.value = .3; wet.gain.value = .22; lp.type = 'lowpass'; lp.frequency.value = 2800;
    leadBus.connect(delay); delay.connect(lp); lp.connect(fb); fb.connect(delay); lp.connect(wet); wet.connect(musicBus);
    // ノイズ
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    // パルス波（デューティ比12.5% / 25% / 50%）… ファミコン風の音色
    for (const [k, duty] of [['p12', .125], ['p25', .25], ['p50', .5]]) {
      const N = 40, re = new Float32Array(N), im = new Float32Array(N);
      for (let n = 1; n < N; n++) im[n] = 2 / (n * Math.PI) * Math.sin(n * Math.PI * duty);
      pulse[k] = ac.createPeriodicWave(re, im);
    }
    applyVolume();
    M.timer = setInterval(sched, 25);
    onState();
    if (M.want) { const w = M.want; M.want = null; G.music.play(w.name, w.v); }
  }
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) window.addEventListener(ev, init, { capture: true, passive: true });
  // 画面から離れた時（アプリの切り替え・画面ロック・ページを閉じる・別の画面をタップ）は必ず止める
  const sleep = () => { if (ac && ac.state === 'running') { try { ac.suspend(); } catch (e) { } } };
  document.addEventListener('visibilitychange', () => {
    if (!ac) return;
    if (document.hidden) { sleep(); return; }
    // 戻ってきた時：再開を試し、だめなら「タップでサウンドON」を出して次のタップで再開する
    wake(); setTimeout(onState, 400);
  });
  window.addEventListener('pagehide', sleep);
  window.addEventListener('blur', () => { sleep(); setTimeout(onState, 50); });
  document.addEventListener('freeze', sleep);
  window.addEventListener('focus', () => { if (!document.hidden) { wake(); setTimeout(onState, 400); } });
  // 念のため定期的に確認（電話・他のアプリの音で中断されたままになっていないか）
  setInterval(() => { if (ac && !document.hidden && !running()) onState(); }, 2000);
  // BGMの音量（ミュート中は0）
  const musicLv = () => { const s = G.S.settings; return s.muteBgm ? 0 : (s.bgm == null ? .5 : s.bgm) * .48; };
  function applyVolume() {
    if (!ac || !G.S) return;
    const s = G.S.settings;
    musicBus.gain.cancelScheduledValues(ac.currentTime);
    musicBus.gain.setValueAtTime(M.track ? musicLv() : 0, ac.currentTime);
    sfxBus.gain.setValueAtTime(s.muteSe ? 0 : s.vol, ac.currentTime);
  }
  G.setVolume = applyVolume;
  // 確認用：各バスの音量を計測するアナライザー
  G.audioDebug = () => {
    if (!ac) return null;
    if (!G._an) {
      const mk = node => { const a = ac.createAnalyser(); a.fftSize = 2048; node.connect(a); return a; };
      G._an = { music: mk(duckG), sfx: mk(sfxBus), out: mk(comp) };
    }
    const lv = a => { const d = new Float32Array(a.fftSize); a.getFloatTimeDomainData(d); let pk = 0, s = 0; for (const v of d) { pk = Math.max(pk, Math.abs(v)); s += v * v; } return { peak: +pk.toFixed(3), rms: +Math.sqrt(s / d.length).toFixed(3) }; };
    return { state: ac.state, track: M.key, bpm: M.bpm, music: lv(G._an.music), sfx: lv(G._an.sfx), out: lv(G._an.out) };
  };
  G.audioOn = () => !!ac && ac.state === 'running';

  // ------------------------------------------------------------ 音源
  function tone(dest, t, f, dur, o) {
    const osc = ac.createOscillator();
    if (pulse[o.w]) osc.setPeriodicWave(pulse[o.w]); else osc.type = o.w || 'square';
    osc.frequency.setValueAtTime(f, t);
    if (o.slide) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.slide), t + (o.slideT || dur));
    const g = ac.createGain(), v = o.vol, a = o.a || .004, r = o.r || .05, s = o.s == null ? .7 : o.s, dc = o.d || .08;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(v, t + a);
    g.gain.setTargetAtTime(v * s, t + a, dc);
    g.gain.setTargetAtTime(0, t + dur, r / 3);
    let node = osc;
    if (o.lp) { const fl = ac.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.setValueAtTime(o.lp, t); if (o.lpTo) fl.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); fl.Q.value = o.q || .8; osc.connect(fl); node = fl; }
    node.connect(g); g.connect(dest);
    if (o.vib && dur > .2) {
      const l = ac.createOscillator(), lg = ac.createGain();
      l.frequency.value = 5.6; lg.gain.setValueAtTime(0, t); lg.gain.linearRampToValueAtTime(f * o.vib, t + Math.min(dur, .35));
      l.connect(lg); lg.connect(osc.frequency); l.start(t); l.stop(t + dur + r + .1);
    }
    osc.start(t); osc.stop(t + dur + r * 2 + .05);
  }
  function noise(dest, t, dur, vol, type, freq, o) {
    o = o || {};
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = o.q || 1;
    if (o.to) f.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + (o.a || .003));
    g.gain.exponentialRampToValueAtTime(.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * .6); s.stop(t + dur + .02);
  }
  // ドラム
  const kick = (t, v) => { tone(musicBus, t, 160, .16, { w: 'sine', vol: v, slide: 42, slideT: .1, s: .8, d: .07, r: .06 }); noise(musicBus, t, .012, v * .35, 'highpass', 3000); };
  const snare = (t, v) => { noise(musicBus, t, .15, v, 'bandpass', 1900, { q: .7 }); tone(musicBus, t, 200, .07, { w: 'triangle', vol: v * .5, slide: 140, r: .03 }); };
  const hat = (t, v, open) => noise(musicBus, t, open ? .13 : .035, v, 'highpass', 7500);
  const crash = (t, v) => noise(musicBus, t, 1.1, v, 'highpass', 4500, { q: .5 });
  // ダッキング（大きな効果音の瞬間だけBGMを下げて迫力を出す）
  function duck(amount, dur) {
    if (!ac) return;
    const t = ac.currentTime;
    duckG.gain.cancelScheduledValues(t);
    duckG.gain.setTargetAtTime(1 - amount, t, .01);
    duckG.gain.setTargetAtTime(1, t + dur, .12);
  }

  // ------------------------------------------------------------ 楽曲データ
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function pn(s) { // 'C#5' → MIDI番号
    let i = 1, pc = NOTE[s[0]];
    if (s[1] === '#') { pc++; i++; } else if (s[1] === 'b') { pc--; i++; }
    return 12 * (parseInt(s.slice(i)) + 1) + pc;
  }
  function parseLine(str) { // 16トークン：音名=発音, '.'=伸ばす, '-'=休符
    const tok = str.trim().split(/\s+/), out = [];
    tok.forEach((k, i) => {
      if (k === '.' || k === '-') { if (k === '.' && out.length && out[out.length - 1].open) out[out.length - 1].len++; else if (k === '-' && out.length) out[out.length - 1].open = false; return; }
      out.push({ s: i, m: pn(k), len: 1, open: true });
    });
    return out;
  }
  function chord(name) { // 'Am' 'F#m' 'E' など
    let i = 1, pc = NOTE[name[0]];
    if (name[1] === '#') { pc++; i++; } else if (name[1] === 'b') { pc--; i++; }
    const minor = name.slice(i) === 'm';
    return { pc: (pc + 12) % 12, iv: minor ? [0, 3, 7, 12] : [0, 4, 7, 12] };
  }
  function section(chords, lines, opt) {
    return chords.map((c, i) => Object.assign({ ch: chord(c), lead: parseLine(lines[i]) }, opt, { crash: i === 0 && opt.crash, fill: i === chords.length - 1 && opt.fill }));
  }
  const DA = ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'E'];
  const DA_L = [
    'E5 . A5 . B5 . C6 . B5 . A5 . E5 . . .', 'F5 . A5 . C6 . A5 . G5 . F5 . E5 . . .',
    'G5 . . C6 . . E6 . D6 . C6 . B5 . G5 .', 'D6 . . . B5 . . . G5 . A5 . B5 . D6 .',
    'E6 . . E6 D6 . C6 . B5 . C6 . A5 . . .', 'A5 . C6 . F6 . E6 . D6 . C6 . A5 . . .',
    'B5 . D6 . G6 . . . F6 . D6 . B5 . G5 .', 'G#5 . B5 . E6 . . . D6 . B5 . G#5 . E5 .',
  ];
  const DB = ['F', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'E'];
  const DB_L = [
    'A5 . . . . . C6 . F6 . . . E6 . C6 .', 'D6 . . . . . B5 . G6 . . . D6 . B5 .',
    'E6 . . . G6 . . . B6 . A6 . G6 . E6 .', 'A6 . . . . . . . E6 . . . C6 . . .',
    'F6 . E6 . D6 . C6 . A5 . C6 . F6 . . .', 'G6 . F6 . E6 . D6 . B5 . D6 . G6 . . .',
    'A6 . G6 . E6 . C6 . E6 . G6 . A6 . . .', 'B6 . . . . . . . G#6 . E6 . B5 . G#5 .',
  ];
  const BR = ['Em', 'Em', 'C', 'D'];
  const BR_L = [
    'E5 . E5 G5 . E5 A5 . G5 . E5 . D5 . E5 .', 'E5 . E5 G5 . E5 B5 . A5 . G5 . F#5 . G5 .',
    'G5 . G5 C6 . G5 E6 . D6 . C6 . B5 . C6 .', 'A5 . A5 D6 . A5 F#6 . E6 . D6 . C6 . B5 .',
  ];
  const BC = ['Em', 'C', 'D', 'B', 'Em', 'C', 'D', 'B'];
  const BC_L = [
    'B5 . . . E6 . . . G6 . . . F#6 . E6 .', 'G6 . . . E6 . . . C6 . . . D6 . E6 .',
    'F#6 . . . A6 . . . F#6 . D6 . A5 . D6 .', 'D#6 . . . F#6 . . . B6 . . . A6 . F#6 .',
    'G6 . F#6 . E6 . B5 . E6 . G6 . B6 . . .', 'C7 . B6 . G6 . E6 . G6 . C7 . E7 . . .',
    'D7 . C7 . A6 . F#6 . A6 . D7 . F#6 . . .', 'D#7 . . . . . . . B6 . A6 . F#6 . D#6 .',
  ];
  const HM = ['C', 'Am', 'F', 'G', 'C', 'Am', 'F', 'G'];
  const HM_L = [
    'E5 . . . G5 . C6 . . . B5 . G5 . . .', 'A5 . . . C6 . E6 . . . D6 . C6 . . .',
    'F5 . A5 . C6 . . . A5 . . . F5 . . .', 'G5 . . . B5 . D6 . . . C6 . B5 . . .',
    'C6 . . . E6 . G6 . . . E6 . C6 . . .', 'E6 . . . A5 . C6 . . . B5 . A5 . . .',
    'A5 . . . C6 . F6 . . . E6 . D6 . . .', 'D6 . . . . . . . B5 . . . G5 . . .',
  ];
  const TRACKS = {
    dungeon: {
      bpm: 168, lead: 'p25',
      bars: [].concat(
        section(DA, DA_L, { drum: 'rock', bass: 'drive', crash: true }),
        section(DA, DA_L, { drum: 'rock', bass: 'drive', arp: true, harm: true, crash: true, fill: true }),
        section(DB, DB_L, { drum: 'dance', bass: 'octave', arp: true, crash: true }),
        section(DB, DB_L, { drum: 'dance', bass: 'octave', arp: true, harm: true, crash: true, fill: true })),
    },
    boss: {
      bpm: 184, lead: 'p12',
      bars: [].concat(
        section(BR, BR_L, { drum: 'boss', bass: 'gallop', crash: true }),
        section(BR, BR_L, { drum: 'boss', bass: 'gallop', harm: true, fill: true }),
        section(BC, BC_L, { drum: 'dance', bass: 'gallop', arp: true, harm: true, crash: true, fill: true })),
    },
    home: {
      bpm: 120, lead: 'triangle',
      bars: [].concat(section(HM, HM_L, { drum: 'home', bass: 'home', arp: true, crash: false }), section(HM, HM_L, { drum: 'home', bass: 'home', arp: true, harm: true })),
    },
  };
  const BASS = {
    drive: [[0, 0, 2], [2, 0, 2], [4, 12, 2], [6, 0, 2], [8, 0, 2], [10, 0, 2], [12, 12, 2], [14, 7, 2]],
    octave: [[0, 0, 1], [2, 12, 1], [4, 0, 1], [6, 12, 1], [8, 0, 1], [10, 12, 1], [12, 0, 1], [14, 12, 1]],
    gallop: [[0, 0, 2], [2, 0, 1], [3, 0, 1], [4, 0, 2], [6, 0, 1], [7, 0, 1], [8, 0, 2], [10, 0, 1], [11, 0, 1], [12, 12, 2], [14, 7, 1], [15, 0, 1]],
    home: [[0, 0, 6], [6, 7, 2], [8, 0, 6], [14, 7, 2]],
  };
  function drums(kind, s, t, fill) {
    if (fill && s >= 8) { // 小節の後半をスネアの連打で盛り上げる
      if (s === 8 || s === 10 || s >= 12) snare(t, .12 + (s - 8) * .015);
      if (s === 8) kick(t, .5);
      return;
    }
    if (kind === 'rock') {
      if (s === 0 || s === 8 || s === 10) kick(t, .55);
      if (s === 4 || s === 12) snare(t, .2);
      if (s % 2 === 0) hat(t, s % 4 === 2 ? .05 : .035, s === 14);
    } else if (kind === 'dance') {
      if (s % 4 === 0) kick(t, .55);
      if (s === 4 || s === 12) snare(t, .2);
      if (s % 4 === 2) hat(t, .07, true); else hat(t, .025);
    } else if (kind === 'boss') {
      if (s === 0 || s === 3 || s === 6 || s === 8 || s === 11 || s === 14) kick(t, .55);
      if (s === 4 || s === 12) snare(t, .22);
      hat(t, s % 2 ? .02 : .04);
    } else if (kind === 'home') {
      if (s === 0 || s === 10) kick(t, .28);
      if (s === 4 || s === 12) noise(musicBus, t, .05, .06, 'bandpass', 3000, { q: 2 });
      if (s % 2 === 0) noise(musicBus, t, .04, .018, 'highpass', 9000);
    }
  }

  // ------------------------------------------------------------ シーケンサー
  const M = { track: null, key: '', step: 0, next: 0, tr: 0, bpm: 120, timer: null, want: null };
  function sched() {
    if (!ac || ac.state !== 'running' || !M.track) return;
    const sd = 60 / M.bpm / 4;
    if (M.next < ac.currentTime - .1) M.next = ac.currentTime + .05;
    // 0.35秒先まで予約しておく（階層生成などで処理が一瞬止まっても音が途切れない）
    while (M.next < ac.currentTime + .35) { playStep(M.track, M.step, M.next, sd); M.next += sd; M.step++; }
  }
  function playStep(tk, step, t, sd) {
    const bars = tk.bars, bar = bars[Math.floor(step / 16) % bars.length], s = step % 16, tr = M.tr;
    const home = tk === TRACKS.home;
    // メロディ
    for (const n of bar.lead) if (n.s === s) {
      let mm = n.m + tr; while (mm > 97) mm -= 12; // 高すぎる音は1オクターブ下げる
      const f = mtof(mm), dur = n.len * sd * .92;
      tone(leadBus, t, f, dur, { w: tk.lead, vol: home ? .13 : .1, vib: .012, s: home ? .45 : .78, d: home ? .15 : .1, r: .07 });
      if (bar.harm) tone(musicBus, t, f / 2, dur, { w: home ? 'sine' : 'p50', vol: home ? .05 : .035, s: .6, r: .05 });
    }
    // ベース
    const root = 36 + bar.ch.pc + tr + (bar.ch.pc + tr > 7 ? -12 : 0) + 12;
    for (const [bs, off, len] of BASS[bar.bass]) if (bs === s) tone(musicBus, t, mtof(root + off - 12), len * sd * .85, { w: home ? 'triangle' : 'p50', vol: home ? .16 : .1, lp: home ? 0 : 1100, s: .65, r: .03 });
    // アルペジオ（16分音符で和音を分散）
    if (bar.arp) {
      const iv = bar.ch.iv[[0, 1, 2, 3, 2, 1][s % 6] % 4];
      if (!home || s % 2 === 0) tone(musicBus, t, mtof(60 + bar.ch.pc + tr + iv + (home ? 12 : 0)), sd * (home ? 1.6 : .7), { w: home ? 'sine' : 'p12', vol: home ? .05 : .03, s: .25, d: .05, r: .04 });
    }
    drums(bar.drum, s, t, bar.fill);
    if (bar.crash && s === 0) crash(t, .07);
  }
  const DUN_VAR = [[0, 0], [2, 3], [-3, 6], [5, 9], [-2, 12]]; // [移調, テンポ加算] エリアごとに雰囲気を変える
  G.music = {
    play(name, v) {
      v = v || 0;
      if (!ac) { M.want = { name, v }; return; }
      const key = name + ':' + v;
      if (M.key === key) return;
      M.key = key;
      const tk = TRACKS[name], dv = name === 'dungeon' ? DUN_VAR[v % DUN_VAR.length] : [0, 0];
      const target = musicLv(), t = ac.currentTime;
      const swap = () => { M.track = tk; M.tr = dv[0]; M.bpm = tk.bpm + dv[1]; M.step = 0; M.next = ac.currentTime + .06; musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(target, ac.currentTime, .08); };
      if (!M.track) { swap(); return; }
      musicBus.gain.cancelScheduledValues(t); musicBus.gain.setTargetAtTime(0, t, .1);
      clearTimeout(M.swapTO); M.swapTO = setTimeout(swap, 420);
    },
    stop(fade) {
      M.key = ''; M.want = null;
      if (!ac) return;
      musicBus.gain.cancelScheduledValues(ac.currentTime); musicBus.gain.setTargetAtTime(0, ac.currentTime, (fade || .5) / 3);
      clearTimeout(M.swapTO); M.swapTO = setTimeout(() => { M.track = null; }, (fade || .5) * 1000);
    },
    // ジングル（短い曲）。再生中はBGMを下げる
    jingle(name) {
      if (!ac || !G.S || G.S.settings.vol <= 0 || G.S.settings.muteSe) return;
      const J = {
        lvup: [['C6', 0, 1], ['E6', 1, 1], ['G6', 2, 1], ['C7', 3, 4], ['G6', 3, 4, 1], ['E6', 3, 4, 1]],
        clear: [['G5', 0, 1], ['C6', 1, 1], ['E6', 2, 1], ['G6', 3, 2], ['E6', 5, 1], ['G6', 6, 4], ['C6', 6, 4, 1]],
        boss: [['C6', 0, 1], ['C6', 1, 1], ['C6', 2, 1], ['C6', 3, 3], ['Ab5', 6, 3], ['Bb5', 9, 3], ['C6', 12, 2], ['Bb5', 14, 1], ['C6', 15, 8], ['G5', 15, 8, 1], ['E5', 15, 8, 1]],
        die: [['E5', 0, 3], ['D5', 3, 3], ['C5', 6, 3], ['B4', 9, 3], ['A4', 12, 10], ['E4', 12, 10, 1]],
        // URキャラ登場の専用ファンファーレ（長め・和音を重ねて派手に）
        ur: [['C5', 0, 2], ['E5', 0, 2, 1], ['G5', 2, 2], ['C6', 4, 2], ['E6', 6, 2], ['G6', 8, 6], ['E6', 8, 6, 1], ['C6', 8, 6, 1],
             ['A5', 14, 2], ['C6', 16, 2], ['F6', 18, 2], ['A6', 20, 6], ['F6', 20, 6, 1], ['G6', 26, 2], ['B6', 28, 2], ['D7', 30, 2], ['C7', 32, 12], ['G6', 32, 12, 1], ['E6', 32, 12, 1], ['C6', 32, 12, 1]],
      }[name];
      if (!J) return;
      const t0 = ac.currentTime + .02, sd = name === 'die' ? .13 : .075;
      let end = 0;
      for (const [n, st, len, harm] of J) {
        const t = t0 + st * sd, dur = len * sd;
        tone(sfxBus, t, mtof(pn(n)), dur, { w: harm ? 'p50' : 'p25', vol: harm ? .05 : .09, vib: .01, s: .7, r: .08 });
        end = Math.max(end, st * sd + dur);
      }
      if (name !== 'die') duck(.7, end + .1);
    },
  };

  // ------------------------------------------------------------ 効果音
  const PENTA = [0, 2, 4, 7, 9];
  const R = (a, b) => a + Math.random() * (b - a);
  const SFX = {
    // URの予兆：低い音から上がっていくうなり＋きらめき
    omen(t) {
      tone(sfxBus, t, 80, 1.4, { w: 'sawtooth', vol: .09, slide: 520, lp: 900, lpTo: 4200, r: .2 });
      noise(sfxBus, t, 1.4, .12, 'bandpass', 400, { to: 6000, q: 2 });
      for (let i = 0; i < 8; i++) tone(sfxBus, t + .5 + i * .1, mtof(84 + PENTA[i % 5] + 12 * Math.floor(i / 5)), .12, { w: 'sine', vol: .04, r: .06 });
    },
    swing(t) { noise(sfxBus, t, .1, .15, 'bandpass', 900 * R(.9, 1.1), { to: 4200, q: 1.2 }); },
    slash2(t) { noise(sfxBus, t, .07, .12, 'bandpass', 3500, { to: 7500, q: 1.5 }); },
    hit(t) {
      noise(sfxBus, t, .07, .26, 'bandpass', 1500 * R(.85, 1.15), { to: 400 });
      tone(sfxBus, t, 190 * R(.9, 1.1), .06, { w: 'square', vol: .08, slide: 70, r: .02 });
      tone(sfxBus, t, 95, .08, { w: 'sine', vol: .2, slide: 55, r: .03 });
    },
    crit(t) {
      SFX.hit(t);
      tone(sfxBus, t, 2300, .16, { w: 'sine', vol: .06, s: .4, r: .08 });
      tone(sfxBus, t + .01, 3450, .12, { w: 'sine', vol: .04, s: .4, r: .06 });
      noise(sfxBus, t, .05, .12, 'highpass', 6000);
    },
    // 撃破：コンボが続くほど五音音階で音程が上がっていく
    kill(t, n) {
      const k = Math.min(Math.max(0, (n || 1) - 1), 14), m = 72 + PENTA[k % 5] + 12 * Math.floor(k / 5);
      tone(sfxBus, t, mtof(m), .08, { w: 'p25', vol: .075, slide: mtof(m) * 1.5, r: .05 });
      noise(sfxBus, t, .05, .1, 'bandpass', 2500, { q: 2 });
    },
    combo(t, n) {
      const b = 72 + Math.min(12, Math.floor(n / 10) * 2);
      [0, 4, 7, 12].forEach((iv, i) => tone(sfxBus, t + i * .045, mtof(b + iv), .12, { w: 'p12', vol: .07, r: .06 }));
      noise(sfxBus, t + .15, .25, .05, 'highpass', 8000);
    },
    zap(t) {
      for (let i = 0; i < 3; i++) noise(sfxBus, t + i * .028, .05, .13, 'highpass', 4500 + i * 900, { q: 3 });
      tone(sfxBus, t, 1700, .11, { w: 'sawtooth', vol: .045, slide: 180, r: .03 });
    },
    boom(t) {
      tone(sfxBus, t, 115, .45, { w: 'sine', vol: .45, slide: 30, r: .1 });
      noise(sfxBus, t, .55, .45, 'lowpass', 1400, { to: 70 });
      for (let i = 0; i < 4; i++) noise(sfxBus, t + .05 + i * .05, .04, .08, 'bandpass', 3000, { q: 4 });
      duck(.45, .25);
    },
    quake(t) {
      tone(sfxBus, t, 72, .65, { w: 'sine', vol: .55, slide: 26, r: .1 });
      noise(sfxBus, t, .6, .5, 'lowpass', 520, { to: 55 });
      duck(.5, .35);
    },
    hurt(t) { tone(sfxBus, t, 320, .14, { w: 'square', vol: .1, slide: 90, lp: 1600, r: .03 }); noise(sfxBus, t, .1, .2, 'lowpass', 900); },
    pickup(t, r) {
      r = r || 0;
      tone(sfxBus, t, 988, .05, { w: 'p25', vol: .06, r: .02 });
      tone(sfxBus, t + .05, 1319, .13, { w: 'p25', vol: .06, r: .06 });
      if (r >= 2) [0, 4, 7, 12].forEach((iv, i) => tone(sfxBus, t + .12 + i * .04, mtof(84 + iv + r), .1, { w: 'sine', vol: .05, r: .06 }));
      if (r >= 4) { [0, 4, 7].forEach(iv => tone(sfxBus, t + .3, mtof(72 + iv), .5, { w: 'p50', vol: .05, vib: .01, r: .1 })); duck(.5, .6); }
    },
    chest(t) {
      tone(sfxBus, t, 120, .12, { w: 'sawtooth', vol: .05, slide: 190, lp: 800, r: .03 });
      ['G5', 'C6', 'E6', 'G6'].forEach((n, i) => tone(sfxBus, t + .1 + i * .06, mtof(pn(n)), .14, { w: 'sine', vol: .08, r: .08 }));
    },
    learn(t) { [0, 7, 12, 16, 19].forEach((iv, i) => tone(sfxBus, t + i * .07, mtof(76 + iv), .2, { w: 'triangle', vol: .08, r: .1 })); },
    stairs(t) { noise(sfxBus, t, .45, .18, 'lowpass', 2400, { to: 250 }); },
    die(t) { tone(sfxBus, t, 330, .5, { w: 'sawtooth', vol: .07, slide: 60, lp: 1200, r: .1 }); noise(sfxBus, t, .5, .15, 'lowpass', 700, { to: 80 }); },
    shoot(t) { tone(sfxBus, t, 640, .09, { w: 'triangle', vol: .07, slide: 280, r: .03 }); noise(sfxBus, t, .04, .06, 'bandpass', 3000, { q: 3 }); },
    dash(t) { noise(sfxBus, t, .2, .22, 'bandpass', 380, { to: 3200, q: 1.3 }); tone(sfxBus, t, 220, .14, { w: 'sine', vol: .12, slide: 80, r: .03 }); },
    freeze(t) { tone(sfxBus, t, 1800, .14, { w: 'sine', vol: .05, slide: 2700, r: .06 }); noise(sfxBus, t, .12, .06, 'highpass', 8000); },
    shield(t) { tone(sfxBus, t, 520, .24, { w: 'sine', vol: .06, slide: 1040, r: .08 }); tone(sfxBus, t, 1040, .2, { w: 'triangle', vol: .025, slide: 2080, r: .06 }); },
    sell(t) { tone(sfxBus, t, 1319, .05, { w: 'p25', vol: .05, r: .02 }); tone(sfxBus, t + .05, 1760, .1, { w: 'p25', vol: .05, r: .05 }); },
    depart(t) { ['C5', 'E5', 'G5', 'C6'].forEach((n, i) => tone(sfxBus, t + i * .07, mtof(pn(n)), .12, { w: 'p25', vol: .07, r: .06 })); },
    alarm(t) { for (let i = 0; i < 4; i++) tone(sfxBus, t + i * .11, i % 2 ? 660 : 880, .1, { w: 'square', vol: .06, lp: 2500, r: .02 }); },
    roar(t) { tone(sfxBus, t, 95, .8, { w: 'sawtooth', vol: .2, slide: 50, lp: 700, lpTo: 200, r: .15 }); noise(sfxBus, t, .75, .25, 'lowpass', 450, { to: 90 }); duck(.5, .7); },
    step(t) { noise(sfxBus, t, .035, .035, 'bandpass', 700 + Math.random() * 400, { q: 1.5 }); },
    click(t) { tone(sfxBus, t, 1250, .025, { w: 'p50', vol: .035, r: .01 }); },
    lvup() { G.music.jingle('lvup'); },
  };
  G.sfx = function (name, arg) {
    if (!ac || ac.state !== 'running' || !G.S || G.S.settings.vol <= 0 || !SFX[name]) return;
    const now = ac.currentTime;
    if (last[name] && now - last[name] < (name === 'kill' ? .03 : name === 'step' ? .12 : .045)) return;
    last[name] = now;
    try { SFX[name](now + .005, arg); } catch (e) { }
  };
})();
