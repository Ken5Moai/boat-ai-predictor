/* 画面にベタ書きした実測値を、backtest.js の計算に合わせて書き直す
   ==================================================================
   index.html は1枚の静的ファイルなので、実測値を文章と表の中に直接書いている。
   レースを足すたびにその数字は古くなるが、見た目は何も変わらない。

   これまで4回、手で直していて、毎回どこかを取りこぼした。
   実際に 31レース時点 / 55レース時点 / 57レース時点 の数字が同時に残っていた。
   気づいたら直す、というやり方が続かないことははっきりしたので、機械にやらせる。

     node sync-figures.js        … 書き直す
     node sync-figures.js --check … 差分を表示するだけ（書き換えない）

   tests/test44.js が、同じ値を突き合わせて見張る。
   このスクリプトを走らせずにレースを足すと test44 が落ちる。

   数字そのものの正しさは見ていない。見ているのは
   「backtest.js が出した値と、画面に書いた値が同じか」だけ。 */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const ROOT=__dirname;
const CHECK = process.argv.includes('--check');

/* 買う点数は index.html の BUY_POINTS が持っている。
   節の名前も行の見出しも点数を含むので、ここに書き写すと
   点数を変えた日に「節が無い」で止まる（2026-10-29 に実際に止まった）。
   止まるのは正しい作りだが、毎回手で直すことになる。点数から組み立てる。 */
const PTS = (()=>{
  const h = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const m = h.match(/const BUY_POINTS = \{\s*main:\s*(\d+),\s*ana:\s*(\d+)\s*\}/);
  if(!m) throw new Error('index.html の BUY_POINTS が読めません');
  return { main:Number(m[1]), ana:Number(m[2]) };
})();
const PTS_ALL = PTS.main + PTS.ana;
const L_MAIN = `本線${PTS.main}点`;
const L_ANA  = `波乱${PTS.ana}点`;
const esc = x => String(x).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const RX = (str) => new RegExp(str);


const out = execFileSync(process.execPath,[path.join(ROOT,'backtest.js')],
  {encoding:'utf8', maxBuffer:64*1024*1024});

const sec = (head, next) => {
  const i = out.indexOf(head); if(i<0) throw new Error('節が無い: '+head);
  const j = next ? out.indexOf(next, i) : -1;
  return out.slice(i, j<0 ? undefined : j);
};
const one = (text, re, label) => {
  const m = text.match(re);
  if(!m) throw new Error('読み取れない: '+label);
  return m.slice(1);
};

/* ---- backtest.js の出力から値を集める ---------------------------- */
const V = {};
{
  const s = sec('=== 上位N点を1点100円で買ったら（全レース） ===','いちばん高いのは');
  V.n = Number(one(s, /対象 (\d+)レース/, 'レース数')[0]);
  V.pts = {};
  for(const m of s.matchAll(/^\s*(\d+)点\s+回収率\s*(\d+)%\s+的中(\d+)\/(\d+)\s*$/gm))
    V.pts[m[1]] = {pct:m[2], hit:m[3]};
}
{
  const s = sec(`=== 「至極の一点 / ${L_MAIN} / ${L_ANA}」で買ったら ===`, `※ ${L_ANA}は本線と`);
  const g = (re,label) => { const [pct,cut,hit] = one(s,re,label); return {pct,cut,hit}; };
  V.top  = g(/至極の一点だけ（1点）\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*(\d+)%\s+的中\s*(\d+)\//,'至極');
  const TAIL = String.raw`\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*(\d+)%\s+的中\s*(\d+)\/`;
  V.main = g(RX(`本線だけ（${PTS.main}点）`+TAIL), '本線');
  V.ana  = g(RX(`波乱だけ（${PTS.ana}点）`+TAIL), '波乱');
  V.all  = g(RX(`本線${PTS.main}＋波乱${PTS.ana}（${PTS_ALL}点）`+TAIL), `${PTS_ALL}点`);
  V.anaProb = one(s, RX(String.raw`素の確率順で本命以外を取る ─\s*\n\s*`
    + `波乱だけ（${PTS.ana}点）` + String.raw`\s+投資¥\s*\d+\s+回収率\s*(\d+)%`), '波乱prob')[0];
  V.diffHit = one(s,/的中の内訳 両方(\d+)件/,'両方的中')[0];
}
{
  const s = sec('=== 至極の一点だけ厚く賭けたら ===','至極の一点だけを100円で');
  const WT = String.raw`\s+投資¥\s*\d+\s+払戻¥\s*\d+\s+収支[+-]¥\s*[\d,]+\s+回収率\s*(\d+)%`;
  const w = (label,re) => one(s,re,label)[0];
  V.stake = {
    /* 「残りn点」のnは 本線-1 と 合計-1。点数から出す。 */
    main100:  w('本線100',  RX(`至極¥100 ＋ 残り${PTS.main-1}点¥100`+WT)),
    main500:  w('本線500',  RX(`至極¥500 ＋ 残り${PTS.main-1}点¥100`+WT)),
    main1000: w('本線1000', RX(`至極¥1000 ＋ 残り${PTS.main-1}点¥100`+WT)),
    all100:   w(`${PTS_ALL}点100`,  RX(`至極¥100 ＋ 残り${PTS_ALL-1}点¥100`+WT)),
    all500:   w(`${PTS_ALL}点500`,  RX(`至極¥500 ＋ 残り${PTS_ALL-1}点¥100`+WT)),
    all1000:  w(`${PTS_ALL}点1000`, RX(`至極¥1000 ＋ 残り${PTS_ALL-1}点¥100`+WT)),
  };
}
{
  const s = sec('=== 波乱ブロックを足すと回収率はどうなるか ===','=== 1着が決まったあと');
  const g = (label,re) => one(s,re,label);
  [V.hMain, V.hMainHit] = g('本線のみ', /本線10点のみ\s+平均[\d.]+点\s+回収率\s*(\d+)%\s+的中(\d+)\//);
  [V.hPlus, V.hPlusHit] = g('＋波乱9', /本線10＋波乱9（モデル順）\s+平均[\d.]+点\s+回収率\s*(\d+)%\s+的中(\d+)\//);
  [V.hOnly, V.hOnlyHit] = g('波乱9だけ', /波乱9だけ（モデル順）\s+平均[\d.]+点\s+回収率\s*(\d+)%\s+的中\s*(\d+)\//);
  [V.hN, V.hAvg]        = g('平均払戻', /(\d+)回あたって平均¥([\d,]+)/);
}
{
  const s = sec('=== 穴（高配当）は獲りにいけるのか ===','=== 至極の一点だけ厚く');
  V.bigCount = one(s,/高配当は (\d+)\/\d+ レース/,'高配当件数')[0];
  V.bigRanks = [...s.matchAll(/^\s*¥\s*\d+\s+\S+\s+(\d+)番目/gm)].map(m=>m[1]);
  const row = (label,re) => one(s,re,label);
  [V.eN, V.eW1] = row('E該当', /E モデルの1号艇1着確率<45%\s+(\d+)件\s+(\d+)%/);
  [V.fN, V.fW1] = row('F該当', /F 展示進入が枠なりでない[^\n]*?\s(\d+)件\s+(\d+)%/);
  [V.eOutN, V.eOutW1] = row('E非該当', /↑の該当外 E\s+(\d+)件\s+(\d+)%/);
  [V.fOutN, V.fOutW1] = row('F非該当', /↑の該当外 F\s+(\d+)件\s+(\d+)%/);
  V.Ecurve = {};
  const c = s.slice(s.indexOf('1号艇を1着から外して買ったら'));
  for(const m of c.matchAll(/^\s*(\d+)点\s+回収率\s*(\d+)%\s+最大1件除くと\s*(\d+)%/gm))
    V.Ecurve[m[1]] = {pct:m[2], cut:m[3]};
}
{
  /* 1着の的中と、同じ数の『常に1号艇』を比べる。モデルが1着で何も足していない
     という話は、画面のあちこちで使っているので値をここで取る。 */
  V.hit1 = one(out, /1着の的中 (\d+)\/(\d+)（(\d+)%）/, '1着の的中');
  const ev = out.match(/期待値方式の通算\s+(\d+)レース\s+投資[\d,]+円\s+払戻[\d,]+円\s+回収率(\d+)%\s+的中(\d+)\//);
  if(ev) V.ev = {n:ev[1], pct:ev[2], hit:ev[3]};
}
{
  /* 選り好みのない合計（まるごと1日そろった場日だけを足したもの）。
     画面の「やめどきの目安」はここまで 70%（選り好みあり）だけを出していたが、
     買うレースを選べる前提が入っている数字なので、実際より良く見える。
     レースを選んでいない数字を並べて出す。 */
  const m = out.match(/---- 上の (\d+)場日 ＝ (\d+)レースを全部あわせると/);
  if(!m){
    V.fair = null;
    console.log('  ※ 「選り好みなしの合計」が出ていません（12レースそろった場日がまだ無い）。関係する数字は触りません。');
  }else{
    const s2 = out.slice(out.indexOf(m[0]));
    const r = s2.match(RX(`本線（${PTS.main}点）`+String.raw`\s+投資¥\s*\d+\s+払戻¥\s*\d+\s+収支[+-]¥[\d,]+\s+回収率\s*(\d+)%\s+最大1件除くと\s*(\d+)%\s+的中(\d+)\/(\d+)`));
    if(!r){ V.fair=null; console.log(`  ※ 選り好みなしの合計から${L_MAIN}の行を取り出せませんでした。関係する数字は触りません。`); }
    else V.fair = {days:m[1], n:m[2], pct:r[1], cut:r[2], hit:r[3]};
    /* 本線だけの行とは別に、実際に買う点数（本線＋波乱）の行も取る。
       auto.js は「10点で回収率」と出すので、本線6点の71%を入れると嘘になる
       （2026-10-30 に入れてしまい、ここで気づいた）。 */
    const ra = s2.match(RX(`本線＋波乱（${PTS_ALL}点）`+String.raw`\s+投資¥\s*\d+\s+払戻¥\s*\d+\s+収支[+-]¥[\d,]+\s+回収率\s*(\d+)%\s+最大1件除くと\s*(\d+)%\s+的中(\d+)\/(\d+)`));
    V.fairAll = ra ? {pct:ra[1], cut:ra[2], hit:ra[3]} : null;
    if(!ra) console.log(`  ※ 選り好みなしの合計から${PTS_ALL}点の行を取り出せませんでした。auto.js の数字は触りません。`);
  }
}
{
  /* この節は「回収率が100%を超えた買い方」があるときだけ出る。
     219レースにしたら、どの買い方も100%に届かなくなって節ごと消えた
     （2026-10-26）。無いのは異常ではないので、落とさず null にする。
     画面側は、値が null のときは書き換えない（下の rules を見ること）。 */
  const i0 = out.indexOf('100%を超えた買い方の中身');
  if(i0 < 0){
    V.rest10 = null; V.boot10 = null;
    console.log('  ※ 「100%を超えた買い方の中身」は出ていません'
              + '（どの買い方も100%に届いていない）。関係する数字は触りません。');
  }else{
    const s = sec('100%を超えた買い方の中身','→ 残りの回収率が');
    const i = s.indexOf('10点 均等 100円');
    const t = i<0 ? '' : s.slice(i);
    V.rest10 = (t.match(/その2つを除いた残り\d+レースの回収率 (\d+)%/)||[])[1] || null;
    V.boot10 = (t.match(/引き直してプラスになる割合 (\d+)%/)||[])[1] || null;
  }
}

/* ---- 画面の数字を書き直す ---------------------------------------- */
const P = n => V.pts[n] || {pct:'?',hit:'?'};
const rules = [
  /* 点数ごとの表（2箇所。強調つきの行とそうでない行がある） */
  ...['1','6','8','10','12','15','18','19','20','30'].map(n=>({
    re: new RegExp(`(<tr><td>(?:<b>)?${n}点(?:</b>)?</td><td>(?:<b>)?)\\d+(%(?:</b>)?</td><td>(?:<b>)?)\\d+/\\d+`,'g'),
    to: m => `$1${P(n).pct}$2${P(n).hit}/${V.n}` })),
  /* 1点・10点・19点を文章で書いている箇所 */
  {re:RX(`(<b>やめどきの目安。<\\/b>)\\d+(レース時点で、本線${PTS.main}点の回収率は)\\d+(%です。)`),
   to:()=>`$1${V.n}$2${V.main.pct}$3`},
  /* 以前はここに「いちばん効いた2レースを除くと」「引き直してプラスになる割合」の
     2つを置いていた。どちらも『回収率が100%を超えた買い方の中身』の節からしか
     取れず、その節は100%を超える買い方が無いと出ない。
     505レースで節ごと消えたため、画面には — が入り、
     しかも規則が \d+ しか探していなかったので二度と数字に戻らなくなっていた。
     いつでも計算できる数字（最大1件除いた値と、選り好みなしの合計）に替える。
     （— でも当たるように (?:\d+|—) にしてある。空振りの再発を防ぐため） */
  {re:/(いちばん効いた1レースを除くと)(?:\d+|—)(%に落ちます)/, to:()=>`$1${V.main.cut}$2`},
  {re:/(まる1日ぶんそろえた<b>)(?:\d+|—)(場日（)(?:\d+|—)(レース）だけ<\/b>で見ると)(?:\d+|—)(%)/,
   to:()=> V.fair ? `$1${V.fair.days}$2${V.fair.n}$3${V.fair.pct}$4` : '$1—$2—$3—$4'},
  {re:/(測って決めたこと／まだ決まっていないこと（)\d+(レース時点）)/, to:()=>`$1${V.n}$2`},
  {re:/(穴を足すと、実測では回収率が下がります（)\d+(レース）)/, to:()=>`$1${V.n}$2`},
  {re:/(点数ごとの実測（)\d+(レース・1点100円）)/, to:()=>`$1${V.n}$2`},
  {re:/(点数を増やすといくら落ちるか（実測)\d+(レース）)/, to:()=>`$1${V.n}$2`},
  {re:/(<b>本線に使うほうが実測では上です<\/b>（)\d+(レースで)\d+(%）。)/,
   to:()=>`$1${V.n}$2${V.main.pct}$3`},
  /* 差は符号つきで書いている（10点のほうが低ければ -4 になる）。
     規則は \d+ しか探していなかったので、符号が付いた時点で当たらなくなり、
     89%/85% のまま固定されていた（505レースでは 82%/70%）。
     数字が動いても当たるよう、符号を許す。 */
  {re:/(有料noteでよく見る19点前後は<b>)(?:\d+|—)(%の帯<\/b>です。10点の)(?:\d+|—)(%とは)[+-]?(?:\d+|—)(ポイント違います。)/,
   to:()=>`$1${P('19').pct}$2${P('10').pct}$3${Number(P('10').pct)-Number(P('19').pct)}$4`},
  {re:/(<b>波乱を9点足しても、的中は)\d+(→)\d+(と)\d+(レースしか増えません。<\/b>)/,
   to:()=>`$1${V.hMainHit}$2${V.hPlusHit}$3${Number(V.hPlusHit)-Number(V.hMainHit)}$4`},
  /* 1着の的中（画面の2箇所で『実測11レースで8/11』のまま止まっていた） */
  {re:/(実測)\d+(レースで<b>1着の的中は)\d+\/\d+(（)\d+(%）<\/b>)/,
   to:()=>`$1${V.hit1[1]}$2${V.hit1[0]}/${V.hit1[1]}$3${V.hit1[2]}$4`},
  {re:/(   実測)\d+(レースで、モデルが1位に評価した艇が1着になったのは )\d+\/\d+(（)\d+(%）。)/,
   to:()=>`$1${V.hit1[1]}$2${V.hit1[0]}/${V.hit1[1]}$3${V.hit1[2]}$4`},
  {re:/(「常に1号艇を買う」も同じ )\d+\/\d+(（)\d+(%）。)/,
   to:()=>`$1${V.hit1[0]}/${V.hit1[1]}$2${V.hit1[2]}$3`},
  /* 期待値方式の通算 */
  {re:/(<b>期待値方式を使わない。<\/b>)\d+(レースで)\d+\/\d+(・回収率)\d+(%。)/,
   to:()=>`$1${V.ev.n}$2${V.ev.hit}/${V.ev.n}$3${V.ev.pct}$4`},
  /* 波乱ブロックの表（説明パネル側） */
  {re:/(<tr><td><b>本線10点のみ<\/b><\/td><td><b>)\d+(%<\/b><\/td><td><b>)\d+\/\d+(<\/b><\/td><\/tr>)/,
   to:()=>`$1${V.hMain}$2${V.hMainHit}/${V.n}$3`},
  {re:/(<tr><td>本線10＋波乱9（モデル順）<\/td><td>)\d+(%<\/td><td>)\d+\/\d+/,
   to:()=>`$1${V.hPlus}$2${V.hPlusHit}/${V.n}`},
  /* 荒れ予想カードの表 */
  {re:/(<b>この枠を本線に足しても、)\d+(レースで的中は)\d+(→)\d+(しか増えません。<\/b>)/,
   to:()=>`$1${V.n}$2${V.hMainHit}$3${V.hPlusHit}$4`},
  {re:/(<tr><td>本線10点のみ<\/td><td><b>)\d+(%<\/b><\/td><td>)\d+\/\d+/,
   to:()=>`$1${V.hMain}$2${V.hMainHit}/${V.n}`},
  {re:/(<tr><td>本線10＋この枠9点<\/td><td>)\d+(%<\/td><td>)\d+\/\d+/,
   to:()=>`$1${V.hPlus}$2${V.hPlusHit}/${V.n}`},
  {re:/(<tr><td>この枠だけ9点<\/td><td>)\d+(%<\/td><td>)\d+\/\d+/,
   to:()=>`$1${V.hOnly}$2${V.hOnlyHit}/${V.n}`},
  {re:/(<b>投資は約1\.5倍になり、回収率は)\d+(%から)\d+(%へ下がります。<\/b>)/,
   to:()=>`$1${V.hMain}$2${V.hPlus}$3`},
  {re:/(この枠だけを買うと)\d+(%です。)/, to:()=>`$1${V.hOnly}$2`},
  {re:/(当てた)\d+(回の払戻は<b>平均¥)[\d,]+(<\/b>)/, to:()=>`$1${V.hN}$2${V.hAvg}$3`},
  /* 買い目カード（至極 / 本線 / 波乱） */
  {re:/(この1点だけで買うと実測)\d+(%（)\d+(レース・)\d+\/\d+(）。)/,
   to:()=>`$1${V.top.pct}$2${V.n}$3${V.top.hit}/${V.n}$4`},
  {re:/(本線 \$\{plan\.main\.length\}点[\s\S]{0,40}?実測)\d+(%（)\d+\/\d+(）)/,
   to:()=>`$1${V.main.pct}$2${V.main.hit}/${V.n}$3`},
  {re:/(波乱 \$\{plan\.ana\.length\}点[\s\S]{0,40}?実測)\d+(%（)\d+\/\d+(）)/,
   to:()=>`$1${V.ana.pct}$2${V.ana.hit}/${V.n}$3`},
  {re:RX(`(<tr><td>本線\\$\\{plan\\.main\\.length\\}点だけ<\\/td><td><b>)\\d+(%<\\/b><\\/td><td>)\\d+\\/\\d+`),
   to:()=>`$1${V.main.pct}$2${V.main.hit}/${V.n}`},
  {re:RX(`(<tr><td>波乱\\$\\{plan\\.ana\\.length\\}点だけ<\\/td><td>)\\d+(%<\\/td><td>)\\d+\\/\\d+`),
   to:()=>`$1${V.ana.pct}$2${V.ana.hit}/${V.n}`},
  {re:RX(`(<tr><td>\\$\\{plan\\.all\\.length\\}点まとめて<\\/td><td>)\\d+(%<\\/td><td>)\\d+\\/\\d+`),
   to:()=>`$1${V.all.pct}$2${V.all.hit}/${V.n}`},
  {re:/(<b>波乱を足すと、当たる回数は)\d+(→)\d+(に増えますが、回収率は)\d+(%→)\d+(%に落ちます。<\/b>)/,
   to:()=>`$1${V.main.hit}$2${V.all.hit}$3${V.main.pct}$4${V.all.pct}$5`},
  {re:/(点の取り方を変えても（素の確率順にしても）結果は同じ)\d+(%でした。)/,
   to:()=>`$1${V.anaProb}$2`},
  {re:/()\d+(レースで買い目は毎回違ったのに、当たったのは同じ)\d+(レースだけです。)/,
   to:()=>`$1${V.n}$2${V.diffHit}$3`},
  {re:/(至極の一点だけで買うと<b>)\d+(%（)\d+\/\d+(）<\/b>です。)/,
   to:()=>`$1${V.top.pct}$2${V.top.hit}/${V.n}$3`},
  /* 賭け金の表 */
  {re:/(点ぜんぶ100円<\/td><td>[^<]*<\/td><td>)\d+(%<\/td><\/tr>)/, to:()=>`$1${V.stake.all100}$2`},
  {re:/(<tr><td>至極¥500／他100円<\/td><td>[^<]*<\/td><td>)\d+(%<\/td><\/tr>)/, to:()=>`$1${V.stake.all500}$2`},
  {re:/(<tr><td>至極¥1000／他100円<\/td><td>[^<]*<\/td><td>)\d+(%<\/td><\/tr>)/, to:()=>`$1${V.stake.all1000}$2`},
  {re:/(点ぜんぶ100円<\/td><td>[^<]*<\/td><td><b>)\d+(%<\/b><\/td><\/tr>)/, to:()=>`$1${V.stake.main100}$2`},
  {re:/(<tr><td>本線・至極¥500／他100円<\/td><td>[^<]*<\/td><td>)\d+(%<\/td><\/tr>)/, to:()=>`$1${V.stake.main500}$2`},
  {re:/(<tr><td>本線・至極¥1000／他100円<\/td><td>[^<]*<\/td><td>)\d+(%<\/td><\/tr>)/, to:()=>`$1${V.stake.main1000}$2`},
  {re:/(至極の一点だけを100円で買ったときの回収率が<b>)\d+(%（)\d+\/\d+(）<\/b>)/,
   to:()=>`$1${V.top.pct}$2${V.top.hit}/${V.n}$3`},
  /* 1号艇が飛びやすい形か */
  {re:/(<b>1号艇が飛びやすい形か<\/b>（)\d+(レースで測った2つの条件）)/, to:()=>`$1${V.n}$2`},
  {re:/(該当。この形の)\d+(レースでは1号艇の1着率が)\d+(%でした（非該当は)\d+(%）。)/,
   to:()=>`$1${V.eN}$2${V.eW1}$3${V.eOutW1}$4`},
  {re:/(非該当。この形の)\d+(レースでは1号艇の1着率が)\d+(%でした（該当は)\d+(%）。)/,
   to:()=>`$1${V.eOutN}$2${V.eOutW1}$3${V.eW1}$4`},
  {re:/(艇が動いています。この形の)\d+(レースでは1号艇の1着率が)\d+(%でした（枠なりは)\d+(%）。ただし)\d+(件しかありません。)/,
   to:()=>`$1${V.fN}$2${V.fW1}$3${V.fOutW1}$4${V.fN}$5`},
  {re:/(枠なりです。この形の)\d+(レースでは1号艇の1着率が)\d+(%でした。)/,
   to:()=>`$1${V.fOutN}$2${V.fOutW1}$3`},
  {re:/(（高配当)\d+(件のモデル順位は)[\d・]+(番目）。)/,
   to:()=>`$1${V.bigCount}$2${V.bigRanks.join('・')}$3`},
  {re:/(E該当の)\d+(レースでこれを買うと回収率)\d+(%でしたが、<b>いちばん大きい1件を除くと)\d+(%<\/b>に落ちます。)/,
   to:()=>`$1${V.eN}$2${V.Ecurve['10'].pct}$3${V.Ecurve['10'].cut}$4`},
  {re:/(点数を増やすほど下がります（6点)\d+(%→)\d+(%／20点)\d+(%→)\d+(%／30点)\d+(%→)\d+(%）。)/,
   to:()=>`$1${V.Ecurve['6'].pct}$2${V.Ecurve['6'].cut}$3${V.Ecurve['20'].pct}$4${V.Ecurve['20'].cut}$5${V.Ecurve['30'].pct}$6${V.Ecurve['30'].cut}$7`},
  /* コメントの中の数字（読む人向けなので、ここも古くしない） */
  {re:/(   )\d+(レースの実測では本線だけ)\d+(%、波乱を足すと)\d+(%だった。)/,
   to:()=>`$1${V.n}$2${V.main.pct}$3${V.hPlus}$4`},
  {re:/(どちらが良いかは)\d+(レースでは決着していないので、)/, to:()=>`$1${V.n}$2`},
  {re:/(実測（)\d+(レース）は prob )\d+(% \/ cond )\d+(%。どちらも本線だけ\()\d+(%\)より低い。)/,
   to:()=>`$1${V.n}$2${V.anaProb}$3${V.ana.pct}$4${V.main.pct}$5`},
  /* ここには index.html の buyPlan カードのコメントに書いていた実測5行
     （本線10点だけ71% …）を書き換える規則があった。
     点数を書き写すとずれるので、2026-10-29 にコメントそのものを
     「実測は sync-figures.js が書き換える」に替えて数字を消した。
     規則の行き先が無くなったので外す。画面に出る表のほうは下の規則が見ている。 */
  {re:/(     )\d+(レースで測った結果、ここだけは件数が足りていて)/, to:()=>`$1${V.n}$2`},
  {re:/(       E モデルの1号艇1着確率 < 45%   該当)\d+(件 1号艇1着)\d+(% ／ 非該当)\d+(件 )\d+(%)/,
   to:()=>`$1${V.eN}$2${V.eW1}$3${V.eOutN}$4${V.eOutW1}$5`},
  {re:/(       F 展示進入が枠なりでない        該当 ?)\d+(件 1号艇1着)\d+(% ／ 非該当)\d+(件 )\d+(%)/,
   to:()=>`$1${V.fN}$2${V.fW1}$3${V.fOutN}$4${V.fOutW1}$5`},
  {re:/(     上位10点を買うと回収率)\d+(%だが、最大の1件を除くと)\d+(%に落ちる。)/,
   to:()=>`$1${V.Ecurve['10'].pct}$2${V.Ecurve['10'].cut}$3`},
  /* 「実測 本線10点…（Nレース）」（backtest.js の結果まち出力） */
];

let html = fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const before = html;
let changed = 0, missed = [];
for(const r of rules){
  const src = html;
  html = html.replace(r.re, r.to());
  if(html === src){
    /* 置換後の値が既に正しい場合も同じ文字列になる。本当に無いのかを見る。 */
    if(!r.re.test(src)) missed.push(String(r.re).slice(0,70));
  } else changed++;
}
if(missed.length){
  console.log('※ 当たらなかった規則（画面から消えた可能性）:');
  for(const m of missed) console.log('   '+m);
}
/* backtest.js の結果まち出力にも同じ値を書いている */
let bt = fs.readFileSync(path.join(ROOT,'backtest.js'),'utf8');
const btBefore = bt;
/* auto.js が走り始めに出す実測も書き換える。
   「数字は sync-figures が書き換える1箇所に寄せた」と書いておきながら、
   規則を足し忘れていた（2026-10-30に気づいた）。
   457レース91% のまま止まっていて、実際は575レース93%。
   見出しは点数から作っているので、数字とレース数だけを当てる。 */
let au = fs.readFileSync(path.join(ROOT,'auto.js'),'utf8');
const auBefore = au;
if(V.fair && V.fairAll){
  au = au.replace(/(選り好みのない)\d+(レースの実測では \$\{PTS_ALL\}点で回収率)\d+(%`\);)/,
                  `$1${V.fair.n}$2${V.fairAll.pct}$3`);
  au = au.replace(/(（最大の払戻1件を除くと)\d+(%）。)/, `$1${V.fairAll.cut}$2`);
}

/* 見出しは backtest.js 側が点数から組み立てているので、
   ここでは数字の部分だけを当てる（見出しの点数は当てにしない）。 */
bt = bt.replace(/(実測 \$\{L_MAIN\})\d+(% ／ \$\{L_ANA\}だけ)\d+(% ／ \$\{PTS_ALL\}点まとめて)\d+(%（)\d+(レース）。)/,
                `$1${V.main.pct}$2${V.ana.pct}$3${V.all.pct}$4${V.n}$5`);

if(CHECK){
  console.log(html===before ? 'index.html は最新です' : `index.html に ${changed} 箇所の書き換えが必要です`);
  console.log(bt===btBefore ? 'backtest.js は最新です' : 'backtest.js に書き換えが必要です');
  console.log(au===auBefore ? 'auto.js は最新です' : 'auto.js に書き換えが必要です');
  process.exit((html===before && bt===btBefore && au===auBefore) ? 0 : 1);
}
fs.writeFileSync(path.join(ROOT,'index.html'), html);
fs.writeFileSync(path.join(ROOT,'backtest.js'), bt);
fs.writeFileSync(path.join(ROOT,'auto.js'), au);
console.log(`${V.n}レースの実測に合わせて書き直した（index.html ${changed}箇所`+
            `${bt===btBefore?'':' / backtest.js 1箇所'}）`);
