/* predict.js を2本同時に走らせても、共有ファイルを壊さないか
   ------------------------------------------------------------------
   pending.js / odds.js / odds-live.js は「読んで→足して→書く」。
   2本同時に走ると、後から書いたほうが先の分を消すか、
   書きかけのところに割り込んでファイルが壊れる。

   2026-11-08、4レースを並行で走らせて pending.js が壊れた。
   5件中3件が読めなくなり、backtest.js が止まった。
   「速く出したい」からの並行実行は今後もやるので、仕組みで止める。 */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

console.log('=== 書き込みにロックがあるか ===');
{
  const src=fs.readFileSync(path.join(ROOT,'predict.js'),'utf8');
  ok(/predict\.lock/.test(src), 'predict.js がロックファイルを使う');
  ok(/flag:'wx'/.test(src),
     'ロックは「無いときだけ作る」で取る（あとから上書きできない取り方では意味がない）');
  ok(/finally\s*\{\s*freeLock\(\)/.test(src),
     '書き終わったら必ず外す（途中で落ちても外れる）');
  ok(/mtimeMs[\s\S]{0,80}unlinkSync/.test(src),
     '古いロックは捨てる（落ちたプロセスのロックで永久に止まらない）');
  ok(/書きません/.test(src),
     '取れなかったときは、書かずに止めて、その旨を出す');
}

console.log('\n=== 実際に2本で取り合う ===');
{
  /* predict.js 本体は通信するので呼べない。ロックの取り方だけ同じ手で試す。 */
  const LOCK=path.join(ROOT,'tmp','predict.lock.test');
  try{ fs.unlinkSync(LOCK); }catch(e){}
  fs.mkdirSync(path.join(ROOT,'tmp'),{recursive:true});
  let first=false, second=false;
  try{ fs.writeFileSync(LOCK,'1',{flag:'wx'}); first=true; }catch(e){}
  try{ fs.writeFileSync(LOCK,'2',{flag:'wx'}); second=true; }catch(e){}
  ok(first && !second, '1本目は取れて、2本目は取れない');
  fs.unlinkSync(LOCK);
  let third=false;
  try{ fs.writeFileSync(LOCK,'3',{flag:'wx'}); third=true; }catch(e){}
  ok(third, '外したあとは、次が取れる');
  try{ fs.unlinkSync(LOCK); }catch(e){}
}

console.log('\n=== 共有ファイルがいま読めるか ===');
for(const f of ['pending.js','odds.js','odds-live.js','races.js']){
  const p=path.join(ROOT,'data',f);
  if(!fs.existsSync(p)){ ok(true, `${f} は無い`); continue; }
  let v=null, err=null;
  try{ delete require.cache[require.resolve(p)]; v=require(p); }catch(e){ err=e; }
  ok(!err, `${f} が読める` + (err?`（${String(err.message).slice(0,60)}）`:''));
  if(Array.isArray(v)) ok(!v.some(x=>!x), `${f} に穴が無い`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exitCode = fail?1:0;
