/* 全テストを順に実行する。  node tests/run.js  */
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const files=fs.readdirSync(__dirname).filter(f=>/^test\d*\.js$/.test(f))
  .sort((a,b)=>(parseInt(a.replace(/\D/g,''))||1)-(parseInt(b.replace(/\D/g,''))||1));
let pass=0,fail=0,bad=[];
for(const f of files){
  let out='';
  try{ out=execFileSync(process.execPath,[path.join(__dirname,f)],{encoding:'utf8'}); }
  catch(e){ out=(e.stdout||'')+(e.stderr||''); }
  const m=out.match(/結果: (\d+) 件成功 \/ (\d+) 件失敗/);
  if(!m){ bad.push(f); console.log(`${f.padEnd(12)} 実行できませんでした`); continue; }
  pass+=+m[1]; fail+=+m[2];
  console.log(`${f.padEnd(12)} ${String(m[1]).padStart(4)} 成功 / ${m[2]} 失敗${+m[2]?'  ←':''}`);
  if(+m[2]) bad.push(f);
}
console.log(`\n合計 ${pass} 件成功 / ${fail} 件失敗`);
if(bad.length) console.log(`確認が必要: ${bad.join(' ')}`);
process.exit(fail||bad.length?1:0);
