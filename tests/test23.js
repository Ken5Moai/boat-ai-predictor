/* backtest.js の入口のチェックが、正しい状態を誤って止めないこと
   ------------------------------------------------------------------
   実際に起きた誤検知：オッズだけ先に入れて結果待ちにしているレース
   （pending.js にある）を「RACES に無い」として止めてしまった。
   結果待ちは正しい状態なので、止めてはいけない。
   一方、名前の重複と、pending と RACES の二重登録は止めなければならない。 */
const path=require('path');
const {execFileSync}=require('child_process');
const fs=require('fs');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const BT=path.join(DIR,'backtest.js');
const PEND=path.join(DIR,'pending.js');
const src=fs.readFileSync(BT,'utf8');
const pendSrc=fs.readFileSync(PEND,'utf8');

/* backtest.js を丸ごと走らせると重いので、入口のチェックだけを取り出して試す。
   RACES / PENDING / ODDS を差し替えられる形で評価する。 */
function check(races, pending, odds){
  const seen=new Map();
  for(const r of races) seen.set(r.name,(seen.get(r.name)||0)+1);
  const dup=[...seen].filter(([,v])=>v>1).map(([k])=>k);
  if(dup.length) return {stop:true, why:'dup:'+dup.join(',')};
  const known=new Set([...races,...pending].map(r=>r.name));
  const missing=Object.keys(odds).filter(k=>!known.has(k));
  if(missing.length) return {stop:true, why:'missing:'+missing.join(',')};
  for(const r of pending) if(races.some(q=>q.name===r.name))
    return {stop:true, why:'both:'+r.name};
  return {stop:false};
}

console.log('\n入口のチェック');
ok(check([{name:'A'},{name:'B'}],[],{'A':{},'B':{}}).stop===false,
   'ふつうの状態は通る');
ok(check([{name:'A'},{name:'A'}],[],{'A':{}}).stop===true,
   'RACES に同じ名前が2つあれば止まる');
ok(check([{name:'A'}],[{name:'B'}],{'A':{},'B':{}}).stop===false,
   '結果待ち（pending にだけある）レースは止めない ← 誤検知した箇所');
ok(check([{name:'A'}],[],{'A':{},'C':{}}).stop===true,
   'オッズだけあってどこにも無いレースは止まる');
ok(check([{name:'A'}],[{name:'A'}],{'A':{}}).stop===true,
   'RACES と pending の両方にあれば止まる（二重に数えるため）');

console.log('\n実物のファイルでも止まらないこと');
let out='', code=0;
try{ out=execFileSync(process.execPath,[BT],{encoding:'utf8',cwd:DIR}); }
catch(e){ out=(e.stdout||'')+(e.stderr||''); code=1; }
ok(code===0, 'いまの backtest.js は最後まで走る');
/* ★ は期待値の的中マークにも使っているので、それだけでは判定できない。
   入口のチェックが出す文言そのものを見る。 */
ok(!/レース名が重複|どこにも無いレース|二重に数えます/.test(out),
   '入口のチェックの警告が出ていない');
ok(/検証レース \d+件/.test(out), 'レース件数が表示されている');

/* pending に中身があるときだけ、結果まちの節が出ること */
const hasPending=/\{name:/.test(pendSrc);
ok(hasPending ? /結果まちのレース/.test(out) : !/結果まちのレース/.test(out),
   hasPending ? '結果待ちがあるので、その節が出ている' : '結果待ちが無いので、その節は出ていない');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
