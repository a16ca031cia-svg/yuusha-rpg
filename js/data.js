'use strict';
// ===== ゲームデータ（仮データ・調整対象） =====

G.RARITY = [
  { n: 'N', c: '#d9d4c7' },
  { n: 'R', c: '#5fb0ff' },
  { n: 'SR', c: '#ffd84d' },
  { n: 'SSR', c: '#c98bff' },
  { n: 'SSR+', c: '#ff9a3c' },
];

G.SLOTS = ['weapon', 'head', 'body', 'feet', 'acc1', 'acc2'];
G.SLOT_N = { weapon: '武器', head: '頭', body: '胴', feet: '足', acc1: 'アクセ1', acc2: 'アクセ2', acc: 'アクセサリー' };
G.slotType = s => (s === 'acc1' || s === 'acc2') ? 'acc' : s;

// 連鎖雷の最大連鎖数（仕様書9.2: Lv1=2, Lv3=4, Lv5=6, Lv10=10）
G.CHAIN_N = l => l <= 0 ? 0 : l <= 5 ? l + 1 : Math.min(18, 6 + Math.round((l - 5) * 0.8));

// 付与効果（効果値は game.js の calcStats と一致させる）
G.AFX = {
  vit:    { n: '生命力', g: '基礎能力', a: '頑健な',   d: l => `最大HP +${l * 6}%` },
  str:    { n: '剛力',   g: '基礎能力', a: '剛力の',   d: l => `攻撃力 +${l * 6}%` },
  grd:    { n: '堅守',   g: '基礎能力', a: '堅牢な',   d: l => `防御力 +${l} / +${l * 8}%` },
  haste:  { n: '速撃',   g: '攻撃性能', a: '疾風の',   d: l => `攻撃速度 +${Math.min(150, l * 5)}%` },
  crit:   { n: '会心',   g: '攻撃性能', a: '鋭利な',   d: l => `クリティカル率 +${Math.min(70, l * 2.5).toFixed(1)}%` },
  critd:  { n: '痛撃',   g: '攻撃性能', a: '痛烈な',   d: l => `クリティカル威力 +${l * 12}%` },
  reach:  { n: '長刃',   g: '攻撃範囲', a: '長刃の',   d: l => `通常攻撃の射程 +${Math.min(100, l * 6)}%` },
  area:   { n: '広域',   g: '攻撃範囲', a: '広域の',   d: l => `範囲技の範囲 +${Math.min(150, l * 8)}%` },
  chain:  { n: '連鎖雷', g: '追加攻撃', a: '雷鳴の',   d: l => `命中時${Math.round(Math.min(.6, .2 + .03 * l) * 100)}%で雷。最大${G.CHAIN_N(l)}体へ連鎖 (攻撃力×${(0.4 + 0.08 * l).toFixed(2)})` },
  follow: { n: '追撃斬', g: '追加攻撃', a: '追撃の',   d: l => `命中時${Math.round(Math.min(.9, .35 + .05 * l) * 100)}%で追加斬撃×${1 + Math.floor(l / 3)} (攻撃力×${(0.3 + 0.06 * l).toFixed(2)})` },
  boom:   { n: '撃破爆発', g: '追加攻撃', a: '爆炎の', d: l => `撃破時に爆発 範囲${Math.min(80, 22 + 4 * l)} (攻撃力×${(0.5 + 0.15 * l).toFixed(2)})` },
  burn:   { n: '炎上',   g: '状態異常', a: '灼熱の',   d: l => `命中時${Math.round(Math.min(.8, .25 + .05 * l) * 100)}%で炎上 毎秒 攻撃力×${(0.15 + 0.05 * l).toFixed(2)} 3秒` },
  poison: { n: '毒',     g: '状態異常', a: '毒牙の',   d: l => `命中時${Math.round(Math.min(.9, .3 + .05 * l) * 100)}%で毒 (5重まで) 毎秒 攻撃力×${(0.08 + 0.03 * l).toFixed(2)}` },
  frost:  { n: '凍結',   g: '状態異常', a: '氷結の',   d: l => `命中時${Math.round(Math.min(.4, .08 + .02 * l) * 100)}%で${Math.min(3, .8 + .1 * l).toFixed(1)}秒凍結` },
  leech:  { n: '撃破回復', g: '回復',   a: '吸命の',   d: l => `撃破時 最大HPの${(Math.min(.2, .01 + .008 * l) * 100).toFixed(1)}%回復` },
  regen:  { n: '再生',   g: '回復',     a: '再生の',   d: l => `毎秒 最大HPの${(Math.min(.05, .004 + .003 * l) * 100).toFixed(1)}%回復` },
  barrier:{ n: '障壁',   g: '耐久',     a: '守護の',   d: l => `8秒ごとに最大HPの${Math.round(Math.min(.8, .08 + .04 * l) * 100)}%のバリア` },
  cdr:    { n: '技短縮', g: '技強化',   a: '迅技の',   d: l => `技の再使用時間 -${Math.min(60, l * 5)}%` },
  spow:   { n: '技威力', g: '技強化',   a: '技巧の',   d: l => `技のダメージ +${l * 10}%` },
  recast: { n: '技再発動', g: '技強化', a: '反響の',   d: l => `技の追加発動率 ${Math.round(Math.min(.6, .05 + .04 * l) * 100)}%` },
  swift:  { n: '俊足',   g: '探索',     a: '俊足の',   d: l => `移動速度 +${Math.min(100, l * 5)}%` },
  learn:  { n: '学習',   g: '育成',     a: '賢者の',   d: l => `獲得経験値 +${l * 8}%` },
  luck:   { n: '幸運',   g: '収集',     a: '幸運の',   d: l => `装備ドロップ率 +${l * 8}%` },
};

// 固有効果の装備（ガチャのSSR以上から出る）：戦い方そのものを変える特別な効果。pol＝自動装備でこの方針なら特に優先
G.UNIQUE = {
  thunderRet: { n: '迅雷の剣', slot: 'weapon', af: 'chain', col: '#9fdcff', pol: ['boss'], fit: '雷でボス攻略', d: '連鎖する相手がいない雷は元の敵に戻り、残った分だけ追加ダメージ（相手が1体でも雷が活きる）' },
  iceMark: { n: '氷印の宝玉', slot: 'acc', af: 'frost', col: '#bfeaff', pol: ['boss'], fit: '氷でボス攻略', d: 'ボス・強敵に攻撃を当てると氷の印がたまり、6つで破裂して大ダメージ（凍りにくい相手に）' },
  recastCd: { n: '居合の鞘', slot: 'acc', af: 'cdr', col: '#ffc0c0', pol: ['mob'], fit: '技の連発・大量討伐', d: '技で敵を倒すと、その技の再使用時間が30%短くなる（1回の技で3回まで）' },
  overShield: { n: '生命の護符', slot: 'body', af: 'regen', col: '#7fff8a', pol: ['safe'], fit: '回復・耐久型', d: 'HPが満タンを超えて回復した分の半分がバリアになる（最大HPの35%まで）' },
  wideBoom: { n: '拡散の火種', slot: 'body', af: 'boom', col: '#ffa050', pol: ['mob'], fit: '広域連鎖型', d: '撃破爆発の威力が下がる代わりに、範囲が大きく広がる' },
  resonance: { n: '共鳴の指輪', slot: 'acc', af: 'spow', col: '#ffe36a', pol: ['auto', 'coin'], fit: '祝福の構成', d: '探索中に得た祝福が、すべて1段階強くなる' },
};
// 付与の変更：変更先の系統
G.AF_CAT = {
  any: { n: 'おまかせ', k: null },
  atk: { n: '攻撃', k: ['str', 'haste', 'crit', 'critd', 'reach', 'area'] },
  proc: { n: '追加攻撃・状態異常', k: ['chain', 'follow', 'boom', 'burn', 'poison', 'frost'] },
  def: { n: '耐久・回復', k: ['vit', 'grd', 'regen', 'barrier', 'leech'] },
  skill: { n: '技', k: ['cdr', 'spow', 'recast'] },
  util: { n: '探索・収集', k: ['swift', 'learn', 'luck'] },
};
G.rerollCost = it => 4 + it.rar * 4 + Math.floor(it.f / 5); // 系統を選んで変える時の強化素材（狙った付与を確定で付けるのは6倍）
G.AFFIX_POOL = {
  weapon: ['str', 'haste', 'crit', 'critd', 'reach', 'area', 'chain', 'follow', 'boom', 'burn', 'poison', 'frost', 'spow', 'recast'],
  head: ['vit', 'grd', 'crit', 'cdr', 'learn', 'regen', 'barrier', 'area', 'spow'],
  body: ['vit', 'grd', 'regen', 'barrier', 'leech', 'boom', 'burn'],
  feet: ['swift', 'grd', 'vit', 'haste', 'luck', 'frost', 'cdr'],
  acc: ['chain', 'follow', 'boom', 'burn', 'poison', 'frost', 'crit', 'critd', 'cdr', 'spow', 'recast', 'learn', 'luck', 'leech', 'str', 'haste', 'reach', 'area', 'regen', 'barrier'],
};

G.BASES = {
  weapon: [
    { n: 'ショートソード', atk: 1.0, aspd: 0 },
    { n: 'ブロードソード', atk: 1.18, aspd: -0.06 },
    { n: 'レイピア', atk: 0.86, aspd: 0.14 },
    { n: 'バスタードソード', atk: 1.35, aspd: -0.14, min: 4 },
    { n: 'ルーンブレード', atk: 1.15, aspd: 0.06, min: 8 },
    { n: '竜牙の剣', atk: 1.3, aspd: 0.04, min: 14 },
  ],
  head: [
    { n: '革の帽子', def: .8, hp: 1 },
    { n: '鉄の兜', def: 1.2, hp: .8 },
    { n: '羽根飾りの帽子', def: .7, hp: 1.3 },
    { n: '騎士の兜', def: 1.35, hp: 1.1, min: 6 },
  ],
  body: [
    { n: '旅人の服', def: .8, hp: 1.1 },
    { n: '革の鎧', def: 1.0, hp: 1 },
    { n: '鎖帷子', def: 1.25, hp: .9, min: 3 },
    { n: '騎士の鎧', def: 1.4, hp: 1.2, min: 8 },
  ],
  feet: [
    { n: '革のブーツ', def: 1, mspd: .03 },
    { n: '鉄の脚甲', def: 1.4, mspd: 0 },
    { n: '疾風の靴', def: .7, mspd: .08, min: 4 },
  ],
  acc: [
    { n: '銅の指輪', atk: 1 },
    { n: '銀のお守り', hp: 1 },
    { n: '星のペンダント', crit: 1 },
    { n: '古代の腕輪', def: 1, min: 5 },
  ],
};

// 技（習得レベル・威力・再使用時間は仮）
G.SKILLS = {
  dash:    { n: '突進斬り', lv: 2,  cd: 3.5,  mult: 1.8, col: '#ffd27a', desc: '離れた敵へ一瞬で踏み込み、進路上の敵をまとめて斬る。', cond: '射程内に離れた敵がいる' },
  combo:   { n: '連続斬り', lv: 4,  cd: 4.5,  mult: 0.8, col: '#ffffff', desc: '目前の敵へ4連撃を叩き込む。', cond: '近距離に敵がいる' },
  spin:    { n: '回転斬り', lv: 6,  cd: 5,  mult: 1.5, r: 36, col: '#a8e0ff', desc: '周囲を一周する斬撃で取り囲む敵を薙ぎ払う。', cond: '周囲に2体以上の敵がいる' },
  wave:    { n: '飛ぶ斬撃', lv: 9,  cd: 4.5,  mult: 1.7, col: '#9ef0ff', desc: '前方へ敵を貫通する斬撃を飛ばす。', cond: '前方の射線上に敵がいる' },
  thunder: { n: '雷撃',     lv: 12, cd: 7,  mult: 2.2, col: '#fff27a', desc: '天から雷を落とし、近くの敵へ連鎖させる。', cond: '複数の敵が近接している' },
  quake:   { n: '衝撃波',   lv: 15, cd: 8, mult: 2.4, r: 60, col: '#ffb07a', desc: '跳躍して地面を打ち、周囲へ衝撃を広げる。', cond: '密集した敵が近くにいる' },
};
G.SKILL_ORDER = ['dash', 'combo', 'spin', 'wave', 'thunder', 'quake'];

// ===== ガチャ・キャラクター追加（仕様書「ガチャ・キャラクター追加仕様書 v1」）=====
// ※技名・必殺技名・能力の倍率・コイン量などは仮の調整値（遊びながら変更できるよう、ここにまとめる）

// キャラ専用の技（kind＝動きの種類。既存の技の動きに属性を付けて使う）
// el：属性（chain＝命中時に雷が連鎖 / freeze＝命中時に凍結 / slash＝追加の斬撃）
Object.assign(G.SKILLS, {
  t_dash:  { kind: 'dash', n: '雷光突進', lv: 2, cd: 3.2, mult: 1.7, col: '#fff27a', el: 'chain', desc: '雷をまとって踏み込み、進路上の敵を斬る。命中した敵から雷が走る。', cond: '射程内に離れた敵がいる', evo: ['雷光突進', '紫電突進', '迅雷閃'] },
  t_combo: { kind: 'combo', n: '紫電連斬', lv: 4, cd: 4.2, mult: .75, col: '#fff27a', el: 'chain', desc: '雷を帯びた連撃。斬るたびに雷が連鎖する。', cond: '近距離に敵がいる', evo: ['紫電連斬', '雷華乱舞', '千雷連斬'] },
  t_bolt:  { kind: 'thunder', n: '落雷', lv: 7, cd: 6, mult: 2.1, col: '#fff27a', el: 'chain', desc: '天から雷を落とし、近くの敵へ連鎖させる。', cond: '複数の敵が近接している', evo: ['落雷', '轟雷', '万雷'] },
  t_spin:  { kind: 'spin', n: '雷陣', lv: 10, cd: 5, mult: 1.4, r: 38, col: '#fff27a', el: 'chain', desc: '周囲を雷の剣で薙ぎ払う。', cond: '周囲に2体以上の敵がいる', evo: ['雷陣', '雷轟陣', '天雷陣'] },
  t_wave:  { kind: 'wave', n: '雷刃', lv: 14, cd: 4.5, mult: 1.8, col: '#fff27a', el: 'chain', desc: '雷の斬撃を飛ばし、貫いた敵から連鎖させる。', cond: '前方の射線上に敵がいる', evo: ['雷刃', '雷鳴刃', '雷神刃'] },
  i_lance: { kind: 'wave', n: '氷槍', lv: 2, cd: 3.6, mult: 1.6, col: '#bfeaff', el: 'freeze', desc: '鋭い氷の槍を放ち、貫いた敵を凍らせる。', cond: '前方の射線上に敵がいる', evo: ['氷槍', '氷晶槍', '絶氷槍'] },
  i_nova:  { kind: 'spin', n: '氷結陣', lv: 4, cd: 5, mult: 1.4, r: 44, col: '#bfeaff', el: 'freeze', desc: '足元から冷気を広げ、周囲の敵を凍らせる。', cond: '周囲に2体以上の敵がいる', evo: ['氷結陣', '氷華陣', '銀世界'] },
  i_pillar:{ kind: 'thunder', n: '氷柱', lv: 7, cd: 6, mult: 2.2, col: '#bfeaff', el: 'freeze', ice: true, desc: '敵の足元から巨大な氷柱を突き上げる。', cond: '複数の敵が近接している', evo: ['氷柱', '氷塔', '氷獄'] },
  i_shard: { kind: 'combo', n: '氷晶連弾', lv: 10, cd: 4.2, mult: .8, col: '#bfeaff', el: 'freeze', desc: '氷の礫を連続で撃ち込む。', cond: '近距離に敵がいる', evo: ['氷晶連弾', '氷晶乱射', '氷晶嵐'] },
  i_field: { kind: 'quake', n: '永久凍土', lv: 14, cd: 8, mult: 2.3, r: 64, col: '#bfeaff', el: 'freeze', desc: '周囲一帯を凍てつかせ、氷ごと砕く。', cond: '密集した敵が近くにいる', evo: ['永久凍土', '氷河期', '終焉の冬'] },
  s_iai:   { kind: 'dash', n: '居合', lv: 2, cd: 3.5, mult: 2.2, col: '#ff6a6a', el: 'slash', desc: '一瞬で間合いを詰め、抜き打ちで斬り抜ける。', cond: '射程内に離れた敵がいる', evo: ['居合', '紅閃', '神速居合'] },
  s_ren:   { kind: 'combo', n: '連斬', lv: 4, cd: 4.2, mult: .9, col: '#ff8a8a', el: 'slash', desc: '刀による鋭い連撃。', cond: '近距離に敵がいる', evo: ['連斬', '乱れ桜', '百花斬'] },
  s_issen: { kind: 'wave', n: '一閃', lv: 7, cd: 4.5, mult: 2.4, col: '#ff6a6a', el: 'slash', desc: '刀を振り抜き、前方の敵をまとめて斬り裂く斬撃を飛ばす。', cond: '前方の射線上に敵がいる', evo: ['一閃', '紅一閃', '断空一閃'] },
  s_spin:  { kind: 'spin', n: '旋空', lv: 10, cd: 5, mult: 1.6, r: 38, col: '#ff8a8a', el: 'slash', desc: '身を翻して周囲を斬る。', cond: '周囲に2体以上の敵がいる', evo: ['旋空', '紅旋', '桜花旋風'] },
  s_zan:   { kind: 'thunder', n: '斬鉄', lv: 14, cd: 6.5, mult: 2.8, col: '#ff6a6a', el: 'slash', cut: true, desc: '狙った敵を鉄ごと斬る強烈な一太刀。', cond: '複数の敵が近接している', evo: ['斬鉄', '紅蓮斬', '絶刀'] },
});

// キャラクター（初期主人公＋ガチャURの3人）。base：能力の倍率、ranged：通常攻撃が遠距離
G.CHAR_ORDER = ['hero', 'thunder', 'ice', 'samurai'];
G.CHARS = {
  hero:    { n: '勇者', sub: '初期主人公', el: '剣', col: '#e8c27a', gacha: false, base: { hp: 1, atk: 1, def: 1, aspd: 1 },
             skills: ['dash', 'combo', 'spin', 'wave', 'quake'], ult: { n: 'ブレイブインパクト', d: '剣を振りかぶり、大きな衝撃波を放つ。' }, desc: '基本的な剣技で戦う。' },
  thunder: { n: '黄金の雷剣士', sub: '雷の女剣士', el: '雷', col: '#ffe070', gacha: true, base: { hp: .92, atk: 1, def: .85, aspd: 1.3, crit: .05 },
             skills: ['t_dash', 't_combo', 't_bolt', 't_spin', 't_wave'], ult: { n: '雷神閃', d: '雷をまとって敵の間を高速で斬り抜け、最後に巨大な落雷。周囲へ雷が連鎖する。' }, desc: '素早い連撃と連鎖する雷が得意。' },
  ice:     { n: '白雪の氷晶魔導士', sub: '氷の魔法使い', el: '氷', col: '#9fdcff', gacha: true, ranged: true, base: { hp: .85, atk: 1.15, def: .8, aspd: .95 },
             skills: ['i_lance', 'i_nova', 'i_pillar', 'i_shard', 'i_field'], ult: { n: '絶対零度', d: '広範囲を凍らせ、巨大な氷柱を連続で突き上げる。最後に氷を砕いて追加ダメージ。' }, desc: '遠くから氷の魔法で攻撃し、範囲攻撃と凍結で敵を止める。' },
  samurai: { n: '紅閃の黒髪女侍', sub: '女侍', el: '居合', col: '#ff6a6a', gacha: true, base: { hp: 1, atk: 1.3, def: .95, aspd: .85, crit: .12, critd: .5 },
             skills: ['s_iai', 's_ren', 's_issen', 's_spin', 's_zan'], ult: { n: '秘剣・紅千斬', d: '一瞬静止して納刀し、高速の居合で前方を斬る。遅れて無数の斬撃が走る。' }, desc: '居合と斬撃による高い瞬間火力。' },
};
// 限界突破：★ごとの基礎能力の倍率と、★3・★5での技・必殺技の強化
G.STAR_STAT = [0, 1, 1.12, 1.22, 1.35, 1.5];
G.starSkillMul = st => 1 + (st >= 3 ? .2 : 0) + (st >= 5 ? .3 : 0);      // 技・必殺技の威力
G.starExtra = st => (st >= 3 ? 1 : 0) + (st >= 5 ? 1 : 0);                 // 連鎖数・範囲・斬撃数の追加段階
G.SOUL_PER_DUP = 10; // ★5を超えて重複した時に得る育成素材（英雄の魂）

// 必殺技ゲージ
G.ULT = { max: 100, perHit: 1.1, perKill: 3.5, range: 130 };

// ガチャ
G.GACHA = {
  single: 300, ten: 3000, pity: 200,
  rates: [['UR', .01], ['SSR', .04], ['SR', .15], ['R', .80]],
  equipRar: { SSR: 3, SR: 2, R: 1 },      // 装備のレア度（内部の段階）
  ssrPlus: .12,                            // SSRのうち【極】（さらに強い段階）になる確率
};
// コイン報酬（約10分で3,000枚を目安に調整）。f＝階層
G.COIN = {
  enemyCh: .4, enemy: f => 2.2 + f * .45, elite: f => 16 + f * 2.2, mimic: f => 66 + f * 5.5,
  chest: f => 33 + f * 5, boss: f => 140 + f * 16,
};
// ホーム：デイリーミッション（毎日0時に更新）とログインボーナス（1日1回）。報酬はガチャコイン（仮の値）
G.DAILY = [
  { id: 'kills', n: '敵を150体倒す', need: 150, reward: 300 },
  { id: 'floors', n: '階層を5つ踏破する', need: 5, reward: 300 },
  { id: 'ults', n: '必殺技を5回使う', need: 5, reward: 200 },
  { id: 'pulls', n: 'ガチャを1回引く', need: 1, reward: 100 },
];
G.DAILY_ALL = 500;                                   // すべて達成したボーナス
G.LOGIN = day => day % 7 === 0 ? 1000 : 200 + 50 * ((day - 1) % 7); // 連続ログイン日数ごとの報酬（7日目は多め）
// ホームでキャラをタップした時のセリフ（仮）
G.LINES = {
  hero: ['今日も潜るぞ！', '装備、もっと強くしたいな。', 'ガチャ、引いてみる？', '最深記録、更新してみせる！', 'ちょっと休憩……でもすぐ行くよ。'],
  thunder: ['雷の剣、見せてあげる！', '速さなら誰にも負けないわ。', '次の階層まで一気に駆け抜けよう！', 'ふふっ、ビリビリしてるでしょ？'],
  ice: ['……寒いのは、平気。', '氷の魔法なら、任せて。', '敵は全部、凍らせておくね。', 'ゆっくりでいい、確実に進もう。'],
  samurai: ['斬る。それだけだ。', '刀の手入れは済んでいる。', '迷いは刃を鈍らせる。行くぞ。', '……一閃で終わらせる。'],
};
// 分解で得る強化素材（レア度ごと）と、強化（+1ごとに基礎性能+10%、最大+10）の消費量
G.DISMANTLE = [1, 2, 5, 12, 30];
G.ENH_MAX = 10;
G.enhCost = it => (it.enh || 0) + 1 + [0, 1, 2, 4, 8][it.rar] * ((it.enh || 0) + 1);

// 技の成長：習得後、勇者のレベル3ごとに技レベルが1上がる（最大20）。技Lv5と技Lv12で進化して名前と動きが変わる
G.SKILL_EVO = {
  dash:    { names: ['突進斬り', '疾風突撃', '神速迅雷斬'], up: ['', '踏み込み後の斬撃が広く・強く', 'さらに周囲へ衝撃を放つ'] },
  combo:   { names: ['連続斬り', '乱れ斬り', '百花繚乱'], up: ['', '6連撃に', '8連撃に'] },
  spin:    { names: ['回転斬り', '旋風斬', '大旋風'], up: ['', '2回転して2回斬る', '3回転して3回斬る'] },
  wave:    { names: ['飛ぶ斬撃', '真空波', '断空波'], up: ['', '斬撃を3方向へ放つ', '斬撃を5方向へ放つ'] },
  thunder: { names: ['雷撃', '天雷', '神鳴'], up: ['', '雷を2か所に落とす', '雷を3か所に落とす'] },
  quake:   { names: ['衝撃波', '大地割り', '天変地異'], up: ['', '大きな余震が追撃する', '余震が2回追撃する'] },
};
G.SKILL_EVO_LV = [5, 12]; // この技レベルで進化
G.skillLvAt = (id, L) => L < G.SKILLS[id].lv ? 0 : Math.min(20, 1 + Math.floor((L - G.SKILLS[id].lv) / 3));
G.skillStageOf = sl => sl >= G.SKILL_EVO_LV[1] ? 2 : sl >= G.SKILL_EVO_LV[0] ? 1 : 0;

// セット装備：同じセットの装備を揃えるとボーナス（レア以上の装備にまれに付く）
// pct：能力の割合上昇（crit・cdr・spow・expMul は加算）、fx：付与効果のレベル加算
G.SETS = {
  wind:  { n: '疾風', full: '疾風の装い', col: '#7fe0c0', b: { 2: { t: '移動速度 +15%・攻撃速度 +10%', pct: { mspd: .15, aspd: .1 } }, 4: { t: '攻撃速度 +25%・技の再使用 -15%', pct: { aspd: .25, cdr: .15 } } } },
  flame: { n: '紅蓮', full: '紅蓮の武具', col: '#ff7a50', b: { 2: { t: '攻撃力 +12%', pct: { atk: .12 } }, 4: { t: '炎上 Lv+4・撃破爆発 Lv+3', fx: { burn: 4, boom: 3 } } } },
  guard: { n: '聖守', full: '聖守の鎧', col: '#e8e0a0', b: { 2: { t: '最大HP +15%・防御力 +15%', pct: { hp: .15, def: .15 } }, 4: { t: '障壁 Lv+4・再生 Lv+3', fx: { barrier: 4, regen: 3 } } } },
  storm: { n: '雷帝', full: '雷帝の装具', col: '#ffe070', b: { 2: { t: '会心率 +8%', pct: { crit: .08 } }, 4: { t: '連鎖雷 Lv+4・技威力 +25%', fx: { chain: 4 }, pct: { spow: .25 } } } },
  sage:  { n: '賢者', full: '賢者の宝飾', col: '#b8a0ff', b: { 2: { t: '経験値 +20%・幸運 Lv+2', pct: { expMul: .2 }, fx: { luck: 2 } }, 4: { t: '技の再使用 -20%・技再発動 Lv+3', pct: { cdr: .2 }, fx: { recast: 3 } } } },
  hero:  { n: '勇者', full: '勇者の証', col: '#ffb040', rare: true, b: { 2: { t: '攻撃力 +10%・最大HP +10%', pct: { atk: .1, hp: .1 } }, 4: { t: '攻撃力・最大HP・防御力 +20%', pct: { atk: .2, hp: .2, def: .2 } }, 6: { t: '技威力 +50%・会心威力 +50%', pct: { spow: .5, critd: .5 } } } },
};

// 敵（役割は仕様書10章）
G.ENEMY = {
  slime:  { n: 'スライム',     role: 'swarm',  hp: 13, atk: 4,  spd: 30, range: 8,   wind: .38, rec: .5,  cd: 1.1, exp: 3,  r: 6 },
  bat:    { n: 'コウモリ',     role: 'fast',   hp: 10, atk: 4,  spd: 72, range: 7,   wind: .22, rec: .35, cd: 1.0, exp: 3,  r: 5, fly: true },
  goblin: { n: 'ゴブリン',     role: 'melee',  hp: 24, atk: 7,  spd: 42, range: 10,  wind: .36, rec: .45, cd: 1.2, exp: 6,  r: 6 },
  archer: { n: 'スケルトン弓兵', role: 'ranged', hp: 18, atk: 6,  spd: 34, range: 120, wind: .55, rec: .4,  cd: 2.1, exp: 7,  r: 6 },
  golem:  { n: 'ゴーレム',     role: 'heavy',  hp: 75, atk: 13, spd: 18, range: 14,  wind: .75, rec: .6,  cd: 2.3, exp: 16, r: 8, armor: .8, heavy: true },
  mage:   { n: '魔導士',       role: 'caster', hp: 22, atk: 9,  spd: 30, range: 130, wind: .7,  rec: .5,  cd: 2.6, exp: 11, r: 6 },
  mimic:  { n: 'ミミック',     role: 'melee',  hp: 60, atk: 11, spd: 46, range: 11,  wind: .3,  rec: .4,  cd: 1.0, exp: 20, r: 7 },
};
// 階層の主（5階ごと）：4種類が順番に現れる。それぞれ戦い方が違う
G.BOSS_KIND = [
  { id: 'king', type: 'slime', n: '群れの王', d: '手下のスライムを次々と呼び出す', col: '#c890ff' },
  { id: 'armor', type: 'golem', n: '鎧の巨兵', d: '鎧を砕くまでダメージが通りにくい', col: '#9fd0ff' },
  { id: 'core', type: 'mage', n: '魔力の核', d: '全方位に魔力の弾をばらまく', col: '#ff9ad8' },
  { id: 'blade', type: 'goblin', n: '高速の剣士', d: '一直線に斬り込んでくる。突進の後はすきだらけ', col: '#ff6a4a' },
];
G.bossKindAt = f => G.BOSS_KIND[((Math.round(f / 5) - 1) % 4 + 4) % 4];
G.TIER_PREFIX = ['', '赤き', '蒼き', '冥き', '黄金の'];

// 階層による敵の強化
// （シミュレーションで調整：装備を更新するプレイヤーで約8分ごとに死亡し、到達階層が徐々に伸びる）
G.fHp = f => (1 + 0.3 * (f - 1)) * Math.pow(1.15, f - 1);
G.fAtk = f => (1 + 0.2 * (f - 1)) * Math.pow(1.125, f - 1);
G.fExp = f => (1 + 0.25 * (f - 1)) * Math.pow(1.035, f - 1);

G.enemyTable = f => {
  const t = [['slime', 5], ['bat', 3]];
  if (f >= 2) t.push(['goblin', 5]);
  if (f >= 3) t.push(['archer', 3]);
  if (f >= 5) t.push(['golem', 1.4 + f * 0.05]);
  if (f >= 7) t.push(['mage', 1.6 + f * 0.04]);
  return t;
};

// 経験値曲線
G.expNeed = L => Math.floor(20 * Math.pow(L, 1.7) + 10 * L);

G.INV_CAP = 400;
