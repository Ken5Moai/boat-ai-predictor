/* plan.js — 買い目の行から組番と plan を組み立てる部分
   締切の10〜20分前に動くコードなので、ここは落ちても気づけない。
   実際の backtest.js の出力と同じ形の文章を入れて確かめる。 */
const PLAN=require('../plan.js');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };

console.log('\n=== expand（略記を組番に開く） ===');
ok_(PLAN.expand('1-2-3').join()==='1-2-3', '1点はそのまま');
{
  const r=PLAN.expand('12-12-345');
  /* 1着∈{1,2} 2着∈{1,2} 3着∈{3,4,5}。1着と2着が同じ組は作らないので
     (1,2)(2,1) の2通り × 3 = 6点。本線10点はこの行ともう1行の合計。 */
  ok_(r.length===6, `12-12-345 は6点（${r.length}点）`);
  ok_(!r.some(c=>{const d=c.split('-');return new Set(d).size!==3;}), '同じ艇が2回出る組を作らない');
  ok_(r.includes('1-2-3')&&r.includes('2-1-5'), '中身が合っている');
}
{
  const r=PLAN.expand('123-123-12');
  ok_(!r.includes('1-1-2'), '1-1-2 のような組は作らない');
  ok_(r.includes('3-1-2')&&r.includes('2-3-1'), '3桁×3桁×2桁が開けている');
}
ok_(PLAN.expand('1-2-3 / 1-2-3').length===1, '同じ組は1回だけ');
ok_(PLAN.expand('').length===0, '空文字は0点');
ok_(PLAN.expand(null).length===0, 'null でも落ちない');
ok_(PLAN.expand('1-2').length===0, '形が足りない項は捨てる');

console.log('\n=== buildPlan（実際の出力と同じ形） ===');
const META={jcd:'01',rno:12,date:'2026-10-26',race:'桐生12R (10/26)',provisional:false};
const BLOCK=`  桐生12R (10/26)
  モデルの並び  1(63.4) 2(55.0) 3(53.1)
  至極の一点  1-2-3（8.1%）
  ── 買い目 ──
  至極の一点  1-2-3（8.1%）
  本線10点    12-12-345 / 123-123-12
  波乱 8点    35-135-135 / 25-125-12 / 3-1-4
              （1号艇が飛んだ場合に限った確率。本線とは重ならない）
  合計 18点＝1点100円で ¥1,800。`;
{
  const {plan,why}=PLAN.buildPlan(BLOCK,META);
  ok_(!!plan, `読めている（${why||'理由なし'}）`);
  ok_(plan.best==='1-2-3', `至極は 1-2-3（${plan.best}）`);
  ok_(plan.main.includes('1-2-3'), '至極が本線の中にある');
  ok_(plan.main.length>=10, `本線が${plan.main.length}点`);
  ok_(plan.ana.every(c=>!plan.main.includes(c)), '波乱が本線と重なっていない');
  ok_(new Set([...plan.main,...plan.ana]).size===plan.main.length+plan.ana.length,
      '全体で同じ組番が2回出ていない');
  ok_(plan.unitYen===100 && plan.bestYen===100, '金額は全点100円（機械が勝手に上げない）');
  ok_(plan.jcd==='01' && plan.rno===12 && plan.date==='2026-10-26', 'レースの指定が入っている');
  ok_(plan.provisional===false, '確定として記録されている');
}
{
  const {plan}=PLAN.buildPlan(BLOCK,{...META,provisional:true});
  ok_(plan.provisional===true, '暫定のときは暫定として記録される');
}

console.log('\n=== 読めないときは書かない（推測で埋めない） ===');
{
  const {plan,why}=PLAN.buildPlan('  本線の行がない文章です',META);
  ok_(plan===null, '本線が無ければ null');
  ok_(/本線/.test(why||''), `理由が出る（${why}）`);
}
{
  const bad=BLOCK.replace('至極の一点  1-2-3（8.1%）','至極の一点  6-5-4（8.1%）');
  const {plan,why}=PLAN.buildPlan(bad,META);
  ok_(plan===null, '至極が本線の外なら null');
  ok_(/至極/.test(why||''), `理由が出る（${why}）`);
}
{
  const {plan}=PLAN.buildPlan('  本線10点    1-2\n',META);
  ok_(plan===null, '本線から組番が作れなければ null');
}
{
  const noAna=BLOCK.replace(/  波乱 8点.*\n.*\n/,'');
  const {plan}=PLAN.buildPlan(noAna,META);
  ok_(!!plan && plan.ana.length===0, '波乱の行が無くても本線だけで通る');
}

console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
process.exitCode = ng ? 1 : 0;
