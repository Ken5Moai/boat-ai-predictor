/* 書き写したオッズが、結果と食い違っていないかを機械で確かめる
   ------------------------------------------------------------------
   オッズ120通りは手で書き写している。1つ読み違えても気づけない。
   ところが「締切時オッズ」のレースには、照合に使える手がかりが2つある。

     ① 払戻 = 当たった組のオッズ × 100
     ② 人気 = オッズの安い順に並べたときの順位

   どちらも結果画面に出ている数字なので、書き写したオッズから計算して
   突き合わせれば、読み違いがその場で見つかる。
   （締切前オッズのレースは締切までに動くので、この照合はできない。除外する）

   実際、唐津2R(10/20) は 4-5-1 を 123.7 と読んでいたが、
   拡大して見直すと 123.2 だった。この手の誤りを拾うためのテスト。 */
const fs=require('fs'),path=require('path'),vm=require('vm');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const ODDS=require(path.join(DIR,'data','odds.js'));

/* backtest.js は読み込むだけで全部走ってしまうので、RACES の部分だけ取り出す。 */
const src=fs.readFileSync(path.join(DIR,'data','races.js'),'utf8');
const from=src.indexOf('module.exports = [');
const to=src.indexOf('\n];', from);
if(from<0||to<0){ console.log('  ✗ FAIL: backtest.js から RACES を取り出せない'); process.exitCode = 1; return; }
const RACES=vm.runInNewContext(src.slice(from+'module.exports ='.length, to+2));

const ALL=[];
for(let a=1;a<=6;a++)for(let b=1;b<=6;b++)for(let c=1;c<=6;c++)
  if(a!==b&&b!==c&&a!==c) ALL.push(`${a}-${b}-${c}`);

console.log('\n=== オッズ表そのものの形 ===');
for(const [name,o] of Object.entries(ODDS)){
  const keys=Object.keys(o);
  const missing=ALL.filter(k=>!(k in o));
  const extra=keys.filter(k=>!ALL.includes(k));
  const bad=keys.filter(k=>!(typeof o[k]==='number') || !(o[k]>1));
  ok(keys.length===120 && !missing.length && !extra.length && !bad.length,
     `${name} 120通りが過不足なく数値で入っている`
     + (missing.length?` 欠け:${missing.slice(0,3).join(',')}`:'')
     + (extra.length?` 余計:${extra.slice(0,3).join(',')}`:'')
     + (bad.length?` 値がおかしい:${bad.slice(0,3).join(',')}`:''));
}

console.log('\n=== 締切時オッズ: 払戻と人気が、書き写したオッズと合うか ===');
let checked=0;
for(const r of RACES){
  const o=ODDS[r.name];
  if(!o) continue;
  if(r.preClose){                       /* 締切前は動くので照合できない */
    console.log(`  － ${r.name} は締切前オッズ（${r.preClose}）なので照合しない`);
    continue;
  }
  checked++;
  /* 返還艇がある回は、その艇が絡む買い目が全部返金される。
     ・払戻は締切時オッズのままでは出ない（売上が減るので安くなる）
     ・人気順位は「返還艇を除いた組の中での順位」になる
     どちらも素通りさせず、できるほうの照合をする。 */
  const ref = Array.isArray(r.refund) ? r.refund.map(String) : [];
  const alive = Object.entries(o)
    .filter(([k])=>!k.split('-').some(d=>ref.includes(d)));
  if(typeof r.pay==='number'){
    const want=Math.round(o[r.result]*100);
    if(!ref.length){
      ok(Math.abs(want-r.pay)<=10,
         `${r.name} 払戻 ${r.result} = ${o[r.result]}倍 → ¥${want}（結果画面 ¥${r.pay}）`);
    }else{
      const share = 1 - r.pay/want;
      ok(r.pay < want && share > 0 && share < 1,
         `${r.name} 返還艇${ref.join('・')}号艇あり。払戻¥${r.pay}は締切時オッズ換算¥${want}より安い`
         + `（売上の${(share*100).toFixed(0)}%が返還艇がらみだった計算）`);
    }
  }
  if(typeof r.pop==='number'){
    const list = ref.length ? alive : Object.entries(o);
    const sorted=[...list].sort((a,b)=>a[1]-b[1]);
    const rank=sorted.findIndex(([k])=>k===r.result)+1;
    /* オッズがぴったり同じ組は、どちらが何番人気かをオッズからは決められない。
       公式の人気は票数で付いていて、票数は表示オッズより細かいため。
       219レースにしたとき3件で1つずれた（丸亀12R 1-2-4と1-2-5がどちらも10.4倍、
       大村1R 1-3-4と1-3-5が10倍、大村11R 1-3-4と1-4-2が8.9倍）。
       データの誤りではないので、同値の組がまたがる範囲に入っていれば通す。 */
    const mine=o[r.result];
    const lo=sorted.findIndex(([,v])=>v===mine)+1;
    const hi=sorted.length-[...sorted].reverse().findIndex(([,v])=>v===mine);
    const tied=hi>lo;
    ok(r.pop>=lo && r.pop<=hi,
       `${r.name} 人気 ${r.result} は${ref.length?`返還艇を除く${list.length}通りの中で`:'オッズ順'}${rank}番目`
       + (tied?`（${mine}倍の同値が${lo}〜${hi}番目にあるので ${r.pop}番人気で合う）`
             :`（結果画面 ${r.pop}番人気）`));
  }
}
ok(checked>0, `締切時オッズのレースが ${checked} 件あり、照合できている`);

console.log('\n=== 唐津2R(10/20) を名指しで ===');
const t2=ODDS['唐津2R 予選(10/20)'];
ok(!!t2, 'オッズが入っている');
if(t2){
  ok(t2['5-3-6']===140.4, `正解 5-3-6 は 140.4倍（払戻¥14,040）  実際 ${t2['5-3-6']}`);
  ok(t2['1-3-5']===7.8 && Math.min(...Object.values(t2))===7.8,
     '1番人気は 1-3-5 の 7.8倍');
  ok(t2['4-5-1']===123.2, `4-5-1 は 123.2倍（123.7 と読み違えていた箇所）  実際 ${t2['4-5-1']}`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
