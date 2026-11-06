/* 判定⑪（期待値方式を採らない）の根拠が、画面と機械で食い違わないか
   ------------------------------------------------------------------
   期待値方式は「1054レースで回収率100%」と出ていて、ずっと唯一の希望だった。
   2026-11-06 に判定して捨てた。根拠は2つ。

   ① 払戻の偏り。選り好みなし1011レースの払戻のうち、最大の1件 ¥232,020 が
      23.0% を占める。先に書いた上限（PREREG_MAX_SHARE = 5%）の外。
      その1件を除くと 77%。
   ② 100%の計算に使っているのが締切前後のオッズで、買える値段ではない。
      両方そろう38レースで測ると、買える時点で期待値1.10以上だった組の値段は
      締切までに平均80%まで下がる（7割が下がる）。
      払戻ベースでは 0.88 で、1を切る。

   ここで見張るのは数字そのものではなく「仕組み」。
   画面のこの段落は、¥16,820／72% のまま何週間も固まっていた。
   実際は ¥232,020／77% に変わっていたのに、文章に数字が埋まっていたので
   sync-figures.js が書き換えられなかった。
   同じ固まり方をもう起こさないために、
     ・画面側の数字は span id で持つ
     ・span id ひとつひとつに sync-figures.js の規則がある
     ・中身は backtest.js の出力と一致している
   を機械で確かめる。 */
const fs=require('fs'), path=require('path');
const {execFileSync}=require('child_process');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const BT=fs.readFileSync(path.join(ROOT,'backtest.js'),'utf8');
const SF=fs.readFileSync(path.join(ROOT,'sync-figures.js'),'utf8');

console.log('\n=== 判定⑪が backtest.js に書いてある ===');
ok(/【判定⑪・2026-11-06/.test(BT), '判定⑪の見出しがある（いつ判定したかが入っている）');
ok(/判定⑪[\s\S]{0,2000}PREREG_MAX_SHARE/.test(BT),
   '判定の条件を先に書いた定数（PREREG_MAX_SHARE）から取っている');
{
  /* 「採る／採らない」を手で書いた文にしていないか。
     判定⑧は数字を測り直すたびに裏返ったので、結論は必ず式から出す。 */
  const blk = BT.slice(BT.indexOf('【判定⑪'), BT.indexOf('【判定⑪')+7000);
  ok(/const ok1 = [\s\S]*?PREREG_MAX_SHARE/.test(blk),
     '結論は式（ok1）で出していて、文を手で書いていない');
  ok(/ok1 \?/.test(blk), '→ の行が ok1 で分岐している');
}

console.log('\n=== 画面の数字が span id で持たれている ===');
/* 同じ数字を画面の何か所かに出している。HTML の id は重ねられないので
   ev11cut / ev11cut2 / ev11cut3 のように尾に数字を付ける決まりにした。
   どの span も、尾の数字を落とした名前（key）で同じ値が入る。 */
const ids=[...HTML.matchAll(/<span id="(ev11[a-z]+)(\d*)">([^<]*)<\/span>/g)]
  .map(m=>({id:m[1]+m[2], key:m[1], val:m[3]}));
ok(ids.length>=10, `判定⑪の数字が ${ids.length} 個、span id で置かれている`);
for(const want of ['ev11n','ev11ret','ev11top','ev11share','ev11cut','ev11pairs',
                   'ev11race','ev11unit','ev11pts','ev11pay',
                   'ev11fin','ev11live','ev11gm','ev11down','ev11eff']){
  ok(ids.some(x=>x.key===want), `${want} がある`);
}
ok(new Set(ids.map(x=>x.id)).size===ids.length, 'span id が重複していない');

console.log('\n=== span ひとつひとつに sync-figures.js の規則がある ===');
/* 規則は Object.keys(V.ev11) を回して作っているので、
   V.ev11 に無いキーの span は永久に書き換わらない（＝固まる）。 */
const keys=[...SF.matchAll(/^\s*(ev11[a-z]+):/gm)].map(m=>m[1]);
for(const x of ids) ok(keys.includes(x.key),
  `${x.id} を sync-figures.js が読み取っている（読まない span は固まる）`);
ok(/span id="\$\{k\}\\\\d\*"/.test(SF),
   'span の中身を機械で差し替える規則がある（尾の数字を認める形）');
ok(/V\.ev11\[k\]!=null/.test(SF),
   '値が読めなかったときは触らない（キリ文字を入れない）');

console.log('\n=== 文章に数字を埋め直していないか ===');
{
  const i=HTML.indexOf('<b>期待値方式を使わない。</b>');
  ok(i>=0, '「期待値方式を使わない。」の項目がある');
  const li=HTML.slice(i, HTML.indexOf('</li>', i));
  /* span の外に金額を書かない。金額は測るたびに変わるので、
     文章に埋めるとそこだけ古いまま残る（¥16,820 がそうなった）。 */
  const outside = li.replace(/<span id="ev11[a-z]+\d*">[^<]*<\/span>/g,'');
  ok(!/\u00a5[\d,]+/.test(outside),
     '金額が span の外に書かれていない'
     + (/\u00a5[\d,]+/.test(outside)?`（${outside.match(/\u00a5[\d,]+/)[0]}）`:''));
  /* 測定した % も span の外に書かない。認めるのは2つだけ。
       ・見出しの「回収率NN%」… sync-figures.js の別の規則が持っている
       ・5%… PREREG_MAX_SHARE。先に決めた値で、測定値ではない
     以前は 100% を文字で認めていたが、それだと実測が 96% になったあとに
     本文の「この100%は捨てました」だけが古いまま通ってしまった（2026-11-06）。 */
  const pcts = (outside.replace(/・回収率\d+%/g,'').match(/\d+(?:\.\d+)?%/g)||[])
                 .filter(x=>x!=='5%');
  ok(pcts.length===0,
     '測定した % が span の外に書かれていない'
     + (pcts.length?`（残り: ${pcts.join(' ')}）`:''));
  /* 画面全体で、古い数字が残っていないか。
     ¥16,820 は判定⑪の前の値で、二か所に固まっていた。 */
  ok(!/¥16,820/.test(HTML), '古い ¥16,820 が画面のどこにも残っていない');
  ok(!/いちばん効きます/.test(HTML),
     '捨てた方式を「いちばん効きます」と勧めていない');
  ok(!/これが回収率を変えます/.test(HTML),
     '「期待値順に買うと回収率が変わる」と書いていない（判定⑪で否定された）');
}
ok(/(<b>期待値方式を使わない。<\/b>)\d+(レースで)\d+\/\d+(・回収率)\d+(%。)/
   .test(HTML.replace(/\$\d/g,'')) ||
   /<b>期待値方式を使わない。<\/b>\d+レースで\d+\/\d+・回収率\d+%。/.test(HTML),
   'sync-figures.js の既存の規則（通算の行）もまだ当たる形になっている');

console.log('\n=== 画面の数字が backtest.js の出力と一致している ===');
{
  let out='';
  try{ out=execFileSync(process.execPath,[path.join(ROOT,'backtest.js')],
        {encoding:'utf8', maxBuffer:256*1024*1024}); }
  catch(e){ out=(e.stdout||'')+(e.stderr||''); }
  const i=out.indexOf('【判定⑪');
  ok(i>=0, 'backtest.js が判定⑪を出している');
  if(i>=0){
    const J=out.slice(i, i+2500);
    const g=re=>(J.match(re)||[])[1]||null;
    const want={
      ev11n:     g(/選り好みなし \d+場日 (\d+)レース/),
      ev11ret:   g(/選り好みなし \d+場日 \d+レース\s+回収率(\d+)%/),
      ev11top:   (x=>x?'¥'+x:null)(g(/最大の払戻1件 ¥([\d,]+) =/)),
      ev11share: g(/払戻合計の([\d.]+)%/),
      ev11cut:   g(/その1件を除くと (\d+)%/),
      ev11race:  g(/その1件 = (.+?)  1点/),
      ev11unit:  g(/1点(\d+)円 ×/),
      ev11pts:   g(/× (\d+)点（/),
      ev11pay:   (x=>x?'¥'+x:null)(g(/このレースの払戻は¥([\d,]+)）/)),
      ev11pairs: g(/両方あるのは (\d+)レース/),
      ev11fin:   g(/締切オッズで選ぶ\s+回収率(\d+)%/),
      ev11live:  g(/買える時点で選ぶ\s+回収率(\d+)%/),
      ev11gm:    g(/締切までに平均 (\d+)% になる/),
      ev11down:  g(/（下がった組 (\d+)%）/),
      ev11eff:   g(/払戻ベースでは ([\d.]+)/)
    };
    for(const x of ids){
      if(want[x.key]==null){ ok(false, `${x.id} を backtest.js の出力から読めない`); continue; }
      ok(x.val===want[x.key],
        `${x.id} 画面 ${x.val} = 実測 ${want[x.key]}`
        + (x.val===want[x.key]?'':'  → node sync-figures.js を走らせること'));
    }
    /* 判定の向き。偏りが上限を超えているなら、採ってはいけない。 */
    const share=Number(want.ev11share);
    ok(Number.isFinite(share), '偏りが数字で出ている');
    if(Number.isFinite(share) && share>=5)
      ok(/採らない/.test(J), `偏り${share}%は上限5%の外なので「採らない」と出ている`);
    else
      ok(/条件を満たした/.test(J), '偏りが上限内なら、書き直すよう促している');
    /* 買える値段のほうが悪い、という向きも見る。
       逆（買える時点のほうが良い）になったら、結論を書き直す合図。 */
    const fin=Number(want.ev11fin), live=Number(want.ev11live);
    ok(Number.isFinite(fin)&&Number.isFinite(live), '両方の回収率が出ている');
    ok(!(live>fin), `買える時点で選ぶほうが良くなっていない（${fin}% → ${live}%）`
       + (live>fin?'  → 逆転した。判定⑪を書き直すこと':''));
    ok(Number(want.ev11gm)<100,
       `買える時点で選んだ組の値段は締切までに下がる（${want.ev11gm}%）`);
  }
}

console.log('\n=== 買える時点のオッズを集めるのは続ける ===');
/* 判定⑪で期待値方式は捨てたが、catch-odds.js を止める理由にはならない。
   買える時点のオッズは、そのとき取らないと後から手に入らない。 */
ok(fs.existsSync(path.join(ROOT,'catch-odds.js')), 'catch-odds.js がまだある');
ok(/catch-odds\.js/.test(BT), '判定⑪の注記が catch-odds.js を続ける理由を書いている');

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exitCode = fail ? 1 : 0;
