/* 買う点数が1箇所で決まっていて、どこもずれていないか
   ------------------------------------------------------------------
   2026-10-29 に 本線10点＋波乱8点（18点）から 本線6点＋波乱4点（10点）へ
   変えた。そのとき {main:10, ana:8} が20箇所以上に直書きされていて、
   1つ残せば静かにずれる状態だった。

   ずれ方がたちが悪い。
     ・backtest が「本線10点 91%」と出しながら、中身は6点を計算する
     ・auto.js が「1レース¥1,800」と出しながら、実際は¥1,000しか使わない
       （残高の見積りと損切りの判断がずれる）
     ・predict.js が「本線10点」という文字で backtest の出力を探していて、
       見出しが「本線6点」に変わった瞬間に黙って何も出さなくなる
   どれも画面に出る数字が嘘になるだけで、エラーにはならない。

   なので「1箇所で決めていること」を機械で見張る。 */
const fs=require('fs'), path=require('path');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

console.log('\n=== 点数を決めている場所 ===');
const HTML=read('index.html');
const m=HTML.match(/const BUY_POINTS = \{\s*main:\s*(\d+),\s*ana:\s*(\d+)\s*\}/);
ok(!!m, 'index.html に BUY_POINTS がある（ここだけで点数を決める）');
if(!m){ console.log('\n================ 結果: '+pass+' 件成功 / '+fail+' 件失敗 ================');
        process.exitCode=1; return; }
const MAIN=Number(m[1]), ANA=Number(m[2]), ALL=MAIN+ANA;
console.log(`      いまの点数: 本線${MAIN}点 ＋ 波乱${ANA}点 ＝ ${ALL}点`);
ok((HTML.match(/const BUY_POINTS = \{/g)||[]).length===1,
   'BUY_POINTS の定義は1つだけ（2つあるとどちらが効くか分からない）');

console.log('\n=== buyPlan が既定値として使っているか ===');
ok(/opt\.main != null \? opt\.main : BUY_POINTS\.main/.test(HTML),
   'buyPlan の本線の既定値は BUY_POINTS.main');
ok(/opt\.ana\s+!= null \? opt\.ana\s+: BUY_POINTS\.ana/.test(HTML),
   'buyPlan の波乱の既定値は BUY_POINTS.ana');

console.log('\n=== 呼ぶ側が点数を直書きしていないか ===');
/* 直書きが残っていると、そこだけ古い点数で動く。
   例外は2つだけ。どちらも「わざと固定している」もので、理由をコードに書いてある。
     判定⑦ PREREG7_MAIN … 2026-10-25 に凍結した条件（10点・10倍）
     波乱ブロックの検証   … 「本線10点＋波乱9点」という案そのものを測る節 */
for(const f of ['index.html','backtest.js','predict.js','auto.js','plan.js','vote-assist.js']){
  const src=read(f);
  /* コメントの中は見ない（説明文に書いてある）。
     buyPlan( … {main: 数字 … } の形の呼び出しだけを探す。 */
  /* [^)]*? では toC(x) の閉じ括弧を越えられず、
     buyPlan(toC(x), {main:10, ana:8}) を見逃した（自分で試して気づいた）。
     buyPlan( の位置から先の決まった長さだけを見る形にする。 */
  const bad=[];
  let at=-1;
  while((at=src.indexOf('buyPlan', at+1))>=0){
    const open=src.indexOf('(', at);
    if(open<0 || open-at>8) continue;
    const seg=src.slice(open, open+160);
    const end=seg.indexOf(';');
    const call=end>=0 ? seg.slice(0,end) : seg;
    for(const mm of call.matchAll(/\b(main|ana)\s*:\s*(\d+)\b/g))
      bad.push(`${mm[1]}:${mm[2]}`);
  }
  ok(bad.length===0,
     `${f} の buyPlan 呼び出しに点数の直書きがない`
     + (bad.length?`（${[...new Set(bad)].join(' / ')}）`:''));
}
ok(/const PREREG7_MAIN = 10;/.test(read('backtest.js')),
   '判定⑦ は書いた日の10点に固定されている（凍結した条件の意味を変えない）');
ok(/buyPlan\(toC\(x\.r\), \{main:PREREG7_MAIN\}\)/.test(read('backtest.js')),
   '判定⑦ の計算が PREREG7_MAIN を使っている');

console.log('\n=== 金額が点数から出ているか（残高の見積りに使う） ===');
const AUTO=read('auto.js');
ok(/const YEN_PER_RACE = PTS_ALL \* 100;/.test(AUTO),
   'auto.js の1レースの金額は点数から出している（1800 と書き写していない）');
ok(!/const YEN_PER_RACE = \d+;/.test(AUTO),
   'auto.js に金額の直書きが残っていない');

console.log('\n=== 見出しを点数から組み立てているか ===');
const BT=read('backtest.js');
ok(/const L_MAIN = `本線\$\{PTS\.main\}点`;/.test(BT),
   'backtest.js は見出しを点数から作っている');
const PRED=read('predict.js');
ok(/new RegExp\(`本線\$\{PTS\.main\}点/.test(PRED),
   'predict.js は backtest の見出しを点数から組み立てて探している（空振りしない）');

console.log('\n=== 実際に走らせて、点数が一致するか ===');
/* 文字の検査だけでは、呼び出しの経路が違っていても気づけない。
   本物の buyPlan を呼んで、返ってくる点数を数える。 */
{
  const {JSDOM}=require(path.join(ROOT,'node_modules','jsdom'));
  const d=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
    beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  d.window.Element.prototype.scrollIntoView=function(){};
  const W=d.window;
  /* 120通りに適当な確率を付けて渡す */
  const combos=[];
  for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)
    if(a!==b&&b!==c&&a!==c) combos.push({combo:`${a}-${b}-${c}`, p:1/(a*10+b+c/10)});
  const pl=W.buyPlan(combos);
  ok(pl.main.length===MAIN, `buyPlan() の本線が ${MAIN}点（実際 ${pl.main.length}点）`);
  ok(pl.ana.length===ANA,   `buyPlan() の波乱が ${ANA}点（実際 ${pl.ana.length}点）`);
  ok(pl.all.length===ALL,   `buyPlan() の合計が ${ALL}点（実際 ${pl.all.length}点）`);
  ok(pl.main.includes(pl.best), '至極の一点は本線に入っている');
  ok(pl.ana.every(k=>!pl.main.includes(k)), '波乱は本線と重なっていない');
  ok(new Set(pl.all).size===pl.all.length, '買い目に重複がない');
  ok(pl.all.length*100 === ALL*100, `1レースの金額は ¥${(ALL*100).toLocaleString()}`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
