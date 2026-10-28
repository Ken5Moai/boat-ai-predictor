/* sleep.js — 本当に待つこと
   ==================================================================
   2026-10-28、実機（Windows）で待機ループが空回りした。
   「10分待ちます」が1秒に何十回も出た。

   原因は外の sleep コマンドを呼んでいたこと。Windows に sleep は無い。
   失敗を握りつぶしていたので、待たずに即座に戻っていた。
   このまま展示待ちに入ると公式サイトを高速で叩き続ける。
   会員規約 第25条(2)「極めて短時間に機械的に反復して…照会」そのもの。

   「待つ」は目で見て確かめにくいので、ここで実際に時間を測る。 */
const path=require('path'), fs=require('fs');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };
const sleep=require('../sleep.js');
const DIR=path.join(__dirname,'..');

console.log('\n=== 本当に待つか（実際に時間を測る） ===');
for(const sec of [0.3, 1, 2]){
  const t=Date.now(); sleep(sec); const d=Date.now()-t;
  const want=sec*1000;
  ok_(d >= want-60 && d < want+900, `${sec}秒 待つ（実測 ${d}ms）`);
}
{
  const t=Date.now(); sleep(0); const d=Date.now()-t;
  ok_(d < 50, `0秒は待たない（${d}ms）`);
}
{
  /* 空回りの検査。待つはずの時間が一瞬で終わっていないこと。
     10回呼んで合計が1秒未満なら空回りしている。 */
  const t=Date.now();
  for(let i=0;i<10;i++) sleep(0.1);
  const d=Date.now()-t;
  ok_(d >= 900, `0.1秒×10回で1秒前後かかる（${d}ms）＝空回りしていない`);
}

console.log('\n=== 外の sleep コマンドを呼んでいないこと ===');
{
  const files=fs.readdirSync(DIR).filter(f=>f.endsWith('.js'));
  let bad=[];
  for(const f of files){
    if(f==='sleep.js') continue;   /* 直したことをコメントに書いてある */
    const src=fs.readFileSync(path.join(DIR,f),'utf8');
    if(/execFileSync\(\s*['"`]sleep['"`]/.test(src)) bad.push(f);
  }
  ok_(bad.length===0, `外の sleep コマンドを呼ぶファイルが無い（${bad.join(' ')||'なし'}）`);
}
{
  /* 待つ側がちゃんと sleep.js を使っているか */
  for(const f of ['auto.js','predict.js','record.js','scan.js']){
    const src=fs.readFileSync(path.join(DIR,f),'utf8');
    ok_(/require\(['"`]\.\/sleep\.js['"`]\)/.test(src), `${f} が sleep.js を使っている`);
  }
}

console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
process.exitCode = ng ? 1 : 0;
