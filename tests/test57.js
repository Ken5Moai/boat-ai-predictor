/* レースを渡す順番で、答えが変わらないこと
   ------------------------------------------------------------------
   2026-11-06 に見つけた壊れ方。

   backtest.js の runWith は、1つの画面（JSDOM）を使い回して
   レースを1本ずつ入れ替えながら採点している。
   そのとき、風向き・気温・水温を「値があるときだけ」書き込んでいた。
   値が無いレースでは前のレースの値が画面に残り、そのまま採点された。

   races.js の風向きは 1362レース中 3レースにしかない。
   その3本（28〜30本目）を通ったあとは、残り1332レースが全部
   「向かい風」として採点されていた。確率は最大5.7ポイントずれる。

   欠測を 0 で採点しないのと同じことで、欠測を「前のレースの値」で
   採点してもいけない。順番で答えが変わるものは測定ではない。

   この試験は数字を固定しない。「順番を変えても同じ」だけを見る。
   モデルを変えても、データが増えても、ここは成り立っていなければならない。 */
const path=require('path');
const BT=require(path.join(__dirname,'..','backtest.js'));
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const same=(a,b)=>{ let n=0,d=0;
  for(const k of Object.keys(a.probOf)){
    const q=Math.abs(a.probOf[k]-b.probOf[k]);
    if(q>1e-12) n++; if(q>d) d=q; }
  return {n, d}; };

console.log('=== 前に別のレースを走らせても、答えが変わらないか ===');
{
  /* 風向きのあるレースと無いレースを選ぶ。
     無いほうが「引きずられる側」になる。 */
  const windy = BT.RACES.filter(r=>r.wind);
  const plain = BT.RACES.filter(r=>!r.wind);
  ok(plain.length>0, `風向きの無いレースがある（${plain.length}本）`);
  if(windy.length && plain.length){
    const W=windy[0], P=plain[plain.length-1];
    const solo  = BT.runWith({},null,{races:[P]})[0];
    const after = BT.runWith({},null,{races:[W,P]})[1];
    const r=same(solo,after);
    ok(r.n===0,
      `風向きのあるレースの次でも同じ確率になる（${P.name}／違う組 ${r.n}・最大差 ${r.d.toExponential(1)}）`
      + (r.n?'  → 画面に前のレースの値が残っている':''));
  }
  /* 気温・水温も同じ。値の無いレースを、値のあるレースの次に置く。 */
  const hasT = BT.RACES.find(r=>r.temp!=null);
  const noT  = BT.RACES.find(r=>r.temp==null);
  if(hasT && noT){
    const solo  = BT.runWith({},null,{races:[noT]})[0];
    const after = BT.runWith({},null,{races:[hasT,noT]})[1];
    const r=same(solo,after);
    ok(r.n===0, `気温のあるレースの次でも同じ確率になる（${noT.name}／違う組 ${r.n}）`);
  } else {
    ok(true, '気温の無いレースが無いので、この確かめは要らない');
  }
  /* 順番をまるごと逆にしても同じ。 */
  const sub=BT.RACES.slice(20,45);
  const a=BT.runWith({},null,{races:sub});
  const b=BT.runWith({},null,{races:[...sub].reverse()});
  const mb=new Map(b.map(x=>[x.name,x]));
  let bad=0, worst=0;
  for(const x of a){ const r=same(x, mb.get(x.name)); if(r.n) bad++; if(r.d>worst) worst=r.d; }
  ok(bad===0, `${sub.length}本を逆順にしても全部同じ（違ったレース ${bad}・最大差 ${worst.toExponential(1)}）`);
}

console.log('\n=== 書き込みが「値があるときだけ」になっていないか ===');
{
  const fs=require('fs');
  const src=fs.readFileSync(path.join(__dirname,'..','backtest.js'),'utf8');
  for(const id of ['windDir','temp','waterTemp']){
    const cond=new RegExp(`if\\(R\\.\\w+[^)]*\\)\\s*d\\.getElementById\\('${id}'\\)`);
    ok(!cond.test(src),
      `${id} を条件付きで書き込んでいない（条件付きだと前の値が残る）`);
  }
  ok(/getElementById\('windDir'\)\.value\s*=\s*R\.wind \|\| ''/.test(src),
     '風向きは、無いときに空に戻している');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exitCode = fail?1:0;
