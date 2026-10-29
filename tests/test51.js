/* 捕獲ぶんの保存と復元が本当に効くか
   ------------------------------------------------------------------
   1日ぶんの捕獲は、公式サイトを500回ほど見に行って作る。
   それが tmp/ にしか無く、tmp/ は git に入れていない。
   このコンテナは使い終わると片付けられるので、消えたら取り直しになる。
   取り直しは時間もかかるし、公式サイトにも同じだけ負荷をかける。

   そこで非公開リポジトリ側（data/wholeday）に固めて置くようにしたが、
   「固めたつもりで中身が入っていない」が最悪の失敗になる。
   消えたことに気づくのは、取り直したい日（＝もう遅い）。
   固める→戻す を本物のデータでやって、往復して同じになるかを見る。 */
const fs=require('fs'), path=require('path'), zlib=require('zlib');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const ROOT=path.join(__dirname,'..');
const CAP=require(path.join(ROOT,'captures.js'));
const KEEP=path.join(ROOT,'data','wholeday');
const TMP=path.join(ROOT,'tmp','wholeday');

console.log('\n=== 保存してある日 ===');
const ds=CAP.dates();
ok(ds.length>0, `data/wholeday に ${ds.length}日ぶんある`);

console.log('\n=== 固めたものが読み戻せるか（本物のデータで） ===');
for(const d of ds){
  let p=null, err=null;
  try{ p=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(KEEP,`${d}.json.gz`))).toString()); }
  catch(e){ err=e.message; }
  if(err){ ok(false, `${d} を読み戻せる（${err}）`); continue; }
  const vs=Object.keys(p);
  const races=Object.values(p).reduce((a,x)=>a+(x.races||[]).length,0);
  ok(vs.length>0 && races>0, `${d} は ${vs.length}場 ${races}レース`);
  /* 場コードが2桁、各場に races 配列があること。
     形が違うと、戻したあと wholeday.js が黙って0本として扱う。 */
  const badKey=vs.filter(k=>!/^\d\d$/.test(k));
  ok(badKey.length===0, `${d} の場コードがすべて2桁${badKey.length?'（違う: '+badKey.join(',')+'）':''}`);
  const badPack=vs.filter(k=>!Array.isArray(p[k].races) || p[k].jcd!==k);
  ok(badPack.length===0, `${d} の各場に races があり jcd が一致する${badPack.length?'（違う: '+badPack.join(',')+'）':''}`);
}

console.log('\n=== tmp にあるものと、固めたものが食い違っていないか ===');
/* tmp にあるのに固めていない日があれば、その日は消えたら終わり。
   逆に固めたほうが新しければ、戻すときに古いもので上書きしかねない。 */
{
  const inTmp=fs.existsSync(TMP)
    ? fs.readdirSync(TMP).filter(x=>/^\d{8}$/.test(x)).sort() : [];
  const notKept=inTmp.filter(d=>!ds.includes(d));
  ok(notKept.length===0,
     `tmp にある日がすべて固めてある${notKept.length?'（固めていない: '+notKept.join(',')+'。node captures.js save を走らせること）':''}`);
  for(const d of inTmp){
    if(!ds.includes(d)) continue;
    const dir=path.join(TMP,d);
    const tmpRaces=fs.readdirSync(dir).filter(x=>/^\d\d\.json$/.test(x))
      .reduce((a,f)=>a+JSON.parse(fs.readFileSync(path.join(dir,f),'utf8')).races.length,0);
    const kept=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(KEEP,`${d}.json.gz`))).toString());
    const keptRaces=Object.values(kept).reduce((a,x)=>a+x.races.length,0);
    ok(keptRaces>=tmpRaces,
       `${d} 固めたほう（${keptRaces}本）が tmp（${tmpRaces}本）より少なくない`
       + (keptRaces<tmpRaces?'  → node captures.js save を走らせること':''));
  }
}

console.log('\n=== 戻すときに、すでにあるものを壊さないか ===');
/* 取り直して増えた tmp を、古い保存で上書きしてはいけない。
   実際に1場を書き換えてから restore を呼び、触られないことを見る。 */
{
  const d=ds[ds.length-1];
  const dir=path.join(TMP,d);
  if(!fs.existsSync(dir)){
    ok(true, `${d} は tmp に無いので、この検査は飛ばす`);
  }else{
    const f=fs.readdirSync(dir).filter(x=>/^\d\d\.json$/.test(x))[0];
    const full=path.join(dir,f);
    const before=fs.readFileSync(full,'utf8');
    const mark=JSON.parse(before); mark.races=mark.races.slice(0,1);
    fs.writeFileSync(full, JSON.stringify(mark));
    CAP.restore(d);
    const after=JSON.parse(fs.readFileSync(full,'utf8'));
    ok(after.races.length===1,
       `restore は tmp にすでにある場を上書きしない（${f} は1本のまま）`);
    fs.writeFileSync(full, before);   /* 元に戻す */
    const back=JSON.parse(fs.readFileSync(full,'utf8'));
    ok(back.races.length===JSON.parse(before).races.length, '検査のあと元に戻した');
  }
}

console.log('\n=== wholeday.js が自分で戻し、自分で残すか ===');
{
  const src=fs.readFileSync(path.join(ROOT,'wholeday.js'),'utf8');
  ok(/CAP\.restoreQuiet\(HD\)/.test(src),
     'wholeday.js は走り始めに保存ぶんを戻す（コンテナが変わっても手作業がいらない）');
  ok(/require\('\.\/captures\.js'\)\.save\(HD\)/.test(src),
     'wholeday.js は捕獲のあと自分で残す（採点で落ちても捕獲は残る）');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
