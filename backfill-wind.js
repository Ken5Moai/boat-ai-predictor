/* 過去のレースに、風向きを後から入れる
   ==================================================================
     node backfill-wind.js --dry    何本に入るかだけ見る（取りには行く）
     node backfill-wind.js          data/races.js に書き込む

   なぜ要るか。
   fetch.js は 2026-11-07 まで風向きを一度も取っていなかった（wind:null の
   決め打ち）。ボートレースで風は最も効くと言われる情報なのに、
   1362レース中3レースにしか入っていない。モデルが市場に勝てない理由が
   これだとは限らないが、見ていない情報があるのは確かなので、埋める。

   風向きは結果ページの水面気象（レース時点）から取る。
   取り直しがきくのは、結果ページが過去ぶんも残っているから。
   買える時点のオッズと違い、これは後から埋められる。

   取ったものは scratch に貯める（途中で止めても続きから）。
   公式サイトには1レース1ページしか見に行かない。 */
const fs=require('fs'), path=require('path');
const F=require('./fetch.js');
const ROOT=__dirname;
const DRY=process.argv.includes('--dry');
const LIMIT=(()=>{ const i=process.argv.indexOf('--limit'); return i<0?Infinity:Number(process.argv[i+1]); })();
const CACHE=path.join(ROOT,'tmp','wind-cache.json');
const SRC=path.join(ROOT,'data','races.js');

const RACES=require(SRC);
/* CPU を回して待たない。project の sleep.js は秒で待つ実物を使う。
   会員規約 第25条(2)「極めて短時間に機械的に反復して…照会」に触れないよう、
   1レース1ページ・1秒あけて取る。 */
const sleepSec=require('./sleep.js');

let cache={}; try{ cache=JSON.parse(fs.readFileSync(CACHE,'utf8')); }catch(e){}
const key=r=>`${r.date.replace(/-/g,'')}_${r.jcd}_${r.rno}`;

/* すでに windN が入っているレースは触らない */
const todo=RACES.filter(r=>r.windN==null && r.date && r.jcd && r.rno);
console.log(`=== 風向きを後から入れる ===`);
console.log(`  記録 ${RACES.length}レース / 風向きが無い ${todo.length}レース`);
console.log(`  すでに取ってある ${Object.keys(cache).length}レース\n`);

let got=0, fail=0, n=0;
for(const r of todo){
  if(n>=LIMIT) break;
  const k=key(r);
  if(cache[k]!==undefined) continue;
  n++;
  const hd=r.date.replace(/-/g,'');
  try{
    const html=F.getPage(
      `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${r.rno}&jcd=${r.jcd}&hd=${hd}`);
    const res=F.parseResult(html);
    /* 取り違えていないかを、そのレースの結果で確かめてから採る。
       レース番号が範囲外でも公式は最終レースを返してくるので、
       確かめずに入れると別のレースの風を入れてしまう。 */
    if(res.result!==r.result){
      cache[k]=null; fail++;
      console.log(`  × ${r.name} 結果が違う（${res.result} ≠ ${r.result}）ので入れません`);
    }else{
      cache[k]=res.windN ?? null;
      if(res.windN!=null) got++; else fail++;
    }
  }catch(e){ console.log(`  × ${r.name} 取れません: ${String(e.message).slice(0,40)}`); }
  if(n%25===0){
    fs.writeFileSync(CACHE, JSON.stringify(cache));
    console.log(`  ${n}/${todo.length}本（取れた ${got} / 入らない ${fail}）`);
  }
  sleepSec(1);
}
fs.writeFileSync(CACHE, JSON.stringify(cache));
const have=Object.entries(cache).filter(([,v])=>v!=null);
console.log(`\n  取れた風向き ${have.length}レース ぶん`);

if(DRY){ console.log('  --dry なので書いていません。'); return; }
if(!have.length){ console.log('  書くものがありません。'); return; }

/* races.js を1レースずつ書き換える。
   name は一意（test23 が見ている）なので、name を手がかりに探す。 */
/* 書く直前に読み直す。最初に読んだ中身を持ち回すと、
   走っている間に absorb-day.js が足したレースを上書きで消す。
   この道具は数時間走るので、その間に他の道具を走らせたくなる。 */
let out=fs.readFileSync(SRC,'utf8'), wrote=0, missed=[];
for(const r of RACES){
  const v=cache[key(r)];
  if(v==null) continue;
  const i=out.indexOf(`name:'${r.name.replace(/'/g,"\\'")}'`);
  if(i<0){ missed.push(r.name); continue; }
  /* そのレースの塊の中の wind:null だけを差し替える */
  const j=out.indexOf('wind:null', i);
  if(j<0 || j-i>4000){ missed.push(r.name); continue; }
  if(out.slice(j, j+40).includes('windN:')){ continue; }
  out = out.slice(0,j) + `wind:null,windN:${v}` + out.slice(j+'wind:null'.length);
  wrote++;
}
fs.writeFileSync(SRC, out);
console.log(`  data/races.js に ${wrote}レース 書きました`
  + (missed.length?`（見つからなかった ${missed.length}本）`:''));
/* 書いたものを読み直して確かめる */
delete require.cache[require.resolve(SRC)];
const after=require(SRC);
const n2=after.filter(r=>r.windN!=null).length;
console.log(`  読み直すと、風向きがあるレースは ${n2}本`);
