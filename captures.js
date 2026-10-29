/* 捕獲した1日ぶんのデータを、非公開リポジトリ側に残す／戻す
   ==================================================================
     node captures.js save      … tmp/wholeday を data/wholeday へ固めて置く
     node captures.js restore   … data/wholeday から tmp/wholeday へ戻す
     node captures.js list      … どの日が残っているかを出す

   なぜ要るのか。
   1日ぶんの捕獲は、1場12レース × 4ページ × 10場 で500回ほど公式サイトを
   見に行く。それが tmp/ にしか無く、tmp/ は git に入れていない。
   このコンテナは使い終わると片付けられるので、消えたら取り直しになる。
   取り直しは時間もかかるし、公式サイトにも同じだけ負荷をかける。

   レース記録（data/races.js）は非公開リポジトリに入れてあるので、
   捕獲データも同じところに置く。圧縮すると1日あたり0.15MBほど。

   wholeday.js は走り始めに restore を呼ぶので、
   コンテナが変わっても自動で戻る（手でやる必要はない）。 */
const fs=require('fs'), path=require('path'), zlib=require('zlib');
const ROOT=__dirname;
const TMP=path.join(ROOT,'tmp','wholeday');
const KEEP=path.join(ROOT,'data','wholeday');

/* 1日ぶんを1ファイルに固める。場ごとに分けたままだと
   日が増えるたびにファイルが10個ずつ増えて、差分が見づらい。 */
function save(date){
  const dir=path.join(TMP,date);
  if(!fs.existsSync(dir)) return null;
  const packs={};
  for(const f of fs.readdirSync(dir).filter(x=>/^\d\d\.json$/.test(x)).sort())
    packs[f.slice(0,2)]=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
  if(!Object.keys(packs).length) return null;
  fs.mkdirSync(KEEP,{recursive:true});
  const out=path.join(KEEP,`${date}.json.gz`);
  fs.writeFileSync(out, zlib.gzipSync(JSON.stringify(packs), {level:9}));
  /* 書いたものが読み戻せるかを、その場で確かめる。
     固める側が壊れていると、消えたことに気づくのが「取り直したい日」になる。 */
  const back=JSON.parse(zlib.gunzipSync(fs.readFileSync(out)).toString());
  const n=Object.keys(back).length, m=Object.keys(packs).length;
  if(n!==m) throw new Error(`${date}: 固めたものを読み戻せない（${m}場→${n}場）`);
  const races=Object.values(back).reduce((a,p)=>a+p.races.length,0);
  return {date, venues:n, races, bytes:fs.statSync(out).size};
}

function restore(date){
  const src=path.join(KEEP,`${date}.json.gz`);
  if(!fs.existsSync(src)) return null;
  const dir=path.join(TMP,date);
  const packs=JSON.parse(zlib.gunzipSync(fs.readFileSync(src)).toString());
  fs.mkdirSync(dir,{recursive:true});
  let wrote=0;
  for(const [jcd,pack] of Object.entries(packs)){
    const f=path.join(dir,`${jcd}.json`);
    /* すでに tmp にあるほうは触らない。
       取り直して増えているかもしれないので、古いもので上書きしない。 */
    if(fs.existsSync(f)) continue;
    fs.writeFileSync(f, JSON.stringify(pack));
    wrote++;
  }
  return {date, wrote, total:Object.keys(packs).length};
}

const dates = () => fs.existsSync(KEEP)
  ? fs.readdirSync(KEEP).filter(x=>/^\d{8}\.json\.gz$/.test(x)).map(x=>x.slice(0,8)).sort()
  : [];

/* wholeday.js から呼ぶ用。その日のぶんを静かに戻す。 */
function restoreQuiet(date){ try{ return restore(date); }catch(e){ return null; } }

module.exports={save, restore, restoreQuiet, dates};

if(require.main===module){
  const cmd=process.argv[2];
  if(cmd==='save'){
    const only=process.argv[3];
    const list=fs.existsSync(TMP)
      ? fs.readdirSync(TMP).filter(x=>/^\d{8}$/.test(x)).sort() : [];
    const todo=only?list.filter(d=>d===only):list;
    if(!todo.length){ console.log('固めるものがありません。'); process.exitCode=1; return; }
    for(const d of todo){
      const r=save(d);
      if(r) console.log(`  ${r.date}  ${r.venues}場 ${r.races}レース  ${(r.bytes/1024).toFixed(0)}KB`);
    }
    console.log(`\ndata/wholeday/ に置きました。非公開リポジトリ側でコミットしてください。`);
  }else if(cmd==='restore'){
    const only=process.argv[3];
    const todo=only?[only]:dates();
    if(!todo.length){ console.log('data/wholeday に何もありません。'); process.exitCode=1; return; }
    for(const d of todo){
      const r=restore(d);
      if(!r) console.log(`  ${d}  data/wholeday にありません`);
      else console.log(`  ${d}  ${r.wrote}場を戻しました（固めてあるのは${r.total}場。`
                     + `すでに tmp にある場は触りません）`);
    }
  }else if(cmd==='list'){
    const ds=dates();
    if(!ds.length){ console.log('data/wholeday に何もありません。'); return; }
    for(const d of ds){
      const p=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(KEEP,`${d}.json.gz`))).toString());
      const races=Object.values(p).reduce((a,x)=>a+x.races.length,0);
      console.log(`  ${d}  ${Object.keys(p).length}場 ${races}レース`);
    }
  }else{
    console.log('使い方: node captures.js save|restore|list [YYYYMMDD]');
    process.exitCode=1;
  }
}
