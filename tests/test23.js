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

/* odds.js はオブジェクトなので、同じレース名を2回書くと
   古いほうが JavaScript の時点で消える。消えてからでは気づけない。
   2026-09-27、9/25の三国8Rを足すときに実際に踏みかけた
   （9/24にも「三国8R 一般」があった）。 */
function dupKeys(src){
  const names=[...src.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map(m=>m[1]);
  const c=new Map(); for(const n of names) c.set(n,(c.get(n)||0)+1);
  return [...c].filter(([,v])=>v>1).map(([k])=>k);
}
console.log('\nodds.js の見出しの重複');
ok(dupKeys("module.exports={\n 'A': {\n 'B': {\n}").length===0, '重複が無ければ通る');
ok(dupKeys("module.exports={\n 'A': {\n 'A': {\n}")[0]==='A', '同じ名前が2回あれば見つかる');
const oddsSrc=fs.readFileSync(path.join(DIR,'odds.js'),'utf8');
ok(dupKeys(oddsSrc).length===0, 'いまの odds.js に重複した見出しが無い');
const names=[...oddsSrc.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map(m=>m[1]);
ok(names.length===Object.keys(require(path.join(DIR,'odds.js'))).length,
   '見出しの数と読み込めたレース数が一致する（消えていない）');
ok(/odds\.js に同じレース名が2回書かれています/.test(src),
   'backtest.js にその検査が入っている');

/* 名前と中身が食い違っていないか
   ------------------------------------------------------------------
   実際にあった間違い：「桐生8R 女子」なのに rno:1 が入っていた。
   公式から取り直すまで気づかなかった。名前が「8R」なら rno も 8 のはず。
   場コードも同じで、名前の頭が場の名前と合っているはず。 */
console.log('\n名前と中身（場・レース番号）');
{
  const vm2=require('vm');
  const bt=fs.readFileSync(BT,'utf8');
  const a=bt.indexOf('const RACES=['), b2=bt.indexOf('\n];',a);
  const RACES=vm2.runInNewContext(bt.slice(a+'const RACES='.length,b2+2));
  const VEN={'01':'桐生','04':'平和島','10':'三国','13':'尼崎','18':'徳山',
             '19':'下関','20':'若松','23':'唐津','24':'大村'};
  let ng=0;
  for(const r of RACES){
    const m=String(r.name).match(/^(\D+?)(\d+)R/);
    if(!m){ ng++; console.log('  ✗ FAIL: 名前からレース番号が読めない: '+r.name); continue; }
    if(Number(m[2])!==r.rno){ ng++;
      console.log(`  ✗ FAIL: ${r.name} のレース番号 名前${m[2]} / 記録${r.rno}`); }
    else if(VEN[r.jcd] && VEN[r.jcd]!==m[1]){ ng++;
      console.log(`  ✗ FAIL: ${r.name} の場 名前${m[1]} / 記録${VEN[r.jcd]}`); }
  }
  ok(ng===0, `${RACES.length}レースすべて、名前と場・レース番号が合っている`);
}

console.log('\n=== 配列に穴（undefined）が開いていないか ===');
/* 2回やらかしている。どちらもレコードを足したり移したりしたときのカンマ。
     backtest.js … 末尾が「]},」で終わっているところへ「,」を足して ]},, になった
     pending.js  … レースを RACES へ移したあと、カンマだけが行として残った
   どちらも JavaScript としては正しい文法で、読み込みも通る。
   できるのは要素が undefined の「穴」で、使う側で初めて落ちる。
   文字列で ,, を探すのでは見つからない（空行をはさむ形があるため）。
   実際に読み込んで中身を見るのが確実。 */
{
  const look = (label, arr) => {
    let holes=0, badB=0;
    arr.forEach((r,i)=>{
      if(!r){ holes++; console.log(`    ${label}[${i}] が穴`); return; }
      if(!Array.isArray(r.B) || r.B.length!==6){ badB++; console.log(`    ${r.name} の B が6艇でない`); return; }
      r.B.forEach((b,j)=>{ if(!b){ holes++; console.log(`    ${r.name} の B[${j}] が穴`); } });
    });
    ok(holes===0, `${label} に穴が無い（${arr.length}件）`);
    ok(badB===0,  `${label} はすべて6艇ぶん持っている`);
  };
  const BT = fs.readFileSync(path.join(__dirname,'..','backtest.js'),'utf8');
  const RACES_ = eval('['+BT.match(/const RACES=\[([\s\S]*?)\n\];\n/)[1]+']');
  look('RACES', RACES_);
  const PENDING = require(path.join(__dirname,'..','pending.js'));
  look('PENDING', PENDING);
}
console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
