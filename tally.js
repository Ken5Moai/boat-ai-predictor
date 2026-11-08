/* その日に出した買い目が、いくらになったかを数える
   ==================================================================
     node tally.js [YYYYMMDD]

   predict.js は1レースぶんを tmp/plan.json に書く。
   次のレースで上書きされるので、出すたびに
   tmp/plan-<場>-<R>-<日付>.json として残している。
   ここはその残したぶんを全部拾って、公式の結果と突き合わせる。

   なぜ要るか。
   「資金がつづくかぎり」で回すなら、いまいくら減っているかが
   見えていないと、止めどきが分からない。
   1レースずつ結果を見ていると、負けを数えないほうに気持ちが寄る。
   全部まとめて機械に数えさせる。

   ※ ここが数えるのは「出した買い目」であって「買ったもの」ではない。
      実際に買ったぶんは node settle-bought.js で数える。
      買わなかったレースも入るので、使い分けること。 */
const fs=require('fs'), path=require('path');
const F=require('./fetch.js');
const sleep=require('./sleep.js');
const ROOT=__dirname;
const HD = process.argv.find(a=>/^\d{8}$/.test(a))
  || new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
const VN=(()=>{ const o={}; const h=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const re=/'(\d{2})':\{name:'([^']+)'/g; let m; while((m=re.exec(h))) o[m[1]]=m[2]; return o; })();

const files=fs.readdirSync(path.join(ROOT,'tmp'))
  .filter(f=>new RegExp(`^plan-\\d\\d-\\d+-${HD}\\.json$`).test(f)).sort();
if(!files.length){
  console.log(`\n${HD} に出した買い目がありません（tmp/plan-<場>-<R>-${HD}.json）。`);
  return;
}
console.log(`\n=== ${HD} 出した買い目の収支 ===`);
console.log(`  ${files.length}レースぶん。※ 実際に買ったかどうかは見ていません。\n`);
console.log('場     R   点数  投資    正解     払戻   人気  当たり  収支');

let inv=0, back=0, hit=0, wait=0;
for(const f of files){
  const m=f.match(/^plan-(\d\d)-(\d+)-/);
  const jcd=m[1], rno=Number(m[2]);
  let p; try{ p=JSON.parse(fs.readFileSync(path.join(ROOT,'tmp',f),'utf8')); }catch(e){ continue; }
  const picks=[...new Set([...(p.main||[]), ...(p.ana||[])])];
  const unit=p.unitYen||100;
  const spent=picks.length*unit;
  let res=null, pay=null, pop=null, why='';
  try{
    const html=F.getPage(
      `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${rno}&jcd=${jcd}&hd=${HD}`);
    const o=F.parseResult(html);
    if(o && o.result!=null){ res=String(o.result); pay=o.pay; pop=o.pop; }
    else why = o && o.void ? (o.voidReason||'不成立') : '結果まだ';
  }catch(e){ why=String(e.message).slice(0,24); }
  const lab=`${(VN[jcd]||jcd).padEnd(4)} ${String(rno).padStart(2)}R  ${String(picks.length).padStart(3)}点`;
  if(res==null){
    wait++;
    console.log(`${lab}  ¥${String(spent).padStart(5)}  ${why}`);
    sleep(1); continue;
  }
  const won=picks.includes(res);
  const got=won ? pay*(unit/100) : 0;
  inv+=spent; back+=got; if(won) hit++;
  console.log(`${lab}  ¥${String(spent).padStart(5)}  ${res.padEnd(7)} `
    + `¥${String(pay).padStart(6)}  ${String(pop??'—').padStart(3)}  ${won?'○':'×'}      `
    + `${got-spent>=0?'+¥':'-¥'}${String(Math.abs(got-spent)).padStart(5)}`);
  sleep(1);
}
const net=back-inv;
console.log('');
if(!inv){ console.log('  結果の出たレースがまだありません。'); return; }
console.log(`  結果の出た ${files.length-wait}レース  投資¥${inv.toLocaleString()}  `
  + `払戻¥${back.toLocaleString()}  収支 ${net>=0?'+':'-'}¥${Math.abs(net).toLocaleString()}  `
  + `回収率${Math.round(back/inv*100)}%  的中${hit}/${files.length-wait}`);
if(wait) console.log(`  結果待ち ${wait}レース`);
/* 実測の見込みと並べる。今日が良くても悪くても、見込みは動かない。 */
try{
  const E=require('./data/edge.js');
  console.log(`\n  実測の見込みは10点で回収率87%前後（1630レース）。`
    + `今日の${Math.round(back/inv*100)}%は${files.length-wait}レースぶんの振れです。`);
  if(!E.edge) console.log('  長く回すほど見込みに寄ります。見込みは100%を下回っています。');
}catch(e){}
