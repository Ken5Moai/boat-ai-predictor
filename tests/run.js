/* 全テストを順に実行する。  node tests/run.js  */
require('../need-data.js')(require('path').join(__dirname,'..'));
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const files=fs.readdirSync(__dirname).filter(f=>/^test\d*\.js$/.test(f))
  .sort((a,b)=>(parseInt(a.replace(/\D/g,''))||1)-(parseInt(b.replace(/\D/g,''))||1));
let pass=0,fail=0,bad=[];
for(const f of files){
  let out='';
  /* maxBuffer の既定は1MBしかない。テストの出力は増え続けるので広く取る。 */
  try{ out=execFileSync(process.execPath,[path.join(__dirname,f)],
                        {encoding:'utf8', maxBuffer:256*1024*1024}); }
  catch(e){ out=(e.stdout||'')+(e.stderr||''); }
  const m=out.match(/結果: (\d+) 件成功 \/ (\d+) 件失敗/);
  if(!m){
    /* 集計行が無い。以前はこれだけ出していたが、原因が何も分からなかった。
       出力の末尾を見せる（例外で落ちたならその文面がここに出る）。 */
    bad.push(f);
    console.log(`${f.padEnd(12)} 実行できませんでした（集計行が出ていない）`);
    const tail=out.trimEnd().split('\n').slice(-6);
    tail.forEach(l=>console.log('             | '+l));
    if(!out.trim()) console.log('             | 出力が空です');
    continue;
  }
  pass+=+m[1]; fail+=+m[2];
  console.log(`${f.padEnd(12)} ${String(m[1]).padStart(4)} 成功 / ${m[2]} 失敗${+m[2]?'  ←':''}`);
  if(+m[2]) bad.push(f);
}
console.log(`\n合計 ${pass} 件成功 / ${fail} 件失敗`);
if(bad.length) console.log(`確認が必要: ${bad.join(' ')}`);
/* process.exit() は使わない。
   stdout が配管（パイプ）のとき Node の書き出しは非同期で、
   process.exit() は流れきる前にプロセスを落とす。実際 2026-10-28、
   test38 の出力が 4272 行に増えたところで末尾が切れ、tests/run.js が
   「実行できませんでした」と出した。切れる位置は実行ごとに変わるので、
   運が悪ければ FAIL 行ごと黙って消える。終了コードだけ置いて自然に終わらせる。 */
process.exitCode = (fail||bad.length) ? 1 : 0;
