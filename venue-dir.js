/* 場ごとの「向き」を集める（結果ページの is-direction）
   ==================================================================
     node venue-dir.js        … data/venue-dir.js を作る

   なぜ要るか。
   結果ページの風向き is-windN は絶対方位で、場の向きとは関係ない。
   場をまたいで「追い風か向かい風か」を比べるには、その場の向き
   is-directionN を引いてコース基準に直す必要がある。
   向きは場ごとに一定（レースが変わっても同じ）なので、1場1回取れば足りる。 */
const fs=require('fs'), path=require('path');
const F=require('./fetch.js');
const sleep=require('./sleep.js');
const ROOT=__dirname;
const RACES=require('./data/races.js');

/* 場ごとに、いちばん新しい1レースを選ぶ */
const one=new Map();
for(const r of RACES){ if(!r.jcd||!r.date||!r.rno) continue;
  const cur=one.get(r.jcd);
  if(!cur || r.date>cur.date) one.set(r.jcd, r); }
const jcds=[...one.keys()].sort();
console.log(`=== 場ごとの向きを取る（${jcds.length}場）===`);

const out={};
for(const jcd of jcds){
  const r=one.get(jcd);
  const hd=r.date.replace(/-/g,'');
  try{
    const html=F.getPage(
      `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${r.rno}&jcd=${jcd}&hd=${hd}`);
    const res=F.parseResult(html);
    if(res.result!==r.result){ console.log(`  × ${jcd} 結果が違うので採りません`); continue; }
    if(res.dirN==null){ console.log(`  × ${jcd} 向きが読めません`); continue; }
    out[jcd]=res.dirN;
    console.log(`  ${jcd}  向き ${res.dirN}  （${r.name}）`);
  }catch(e){ console.log(`  × ${jcd} 取れません: ${String(e.message).slice(0,40)}`); }
  sleep(1);
}
fs.writeFileSync(path.join(ROOT,'data','venue-dir.js'),
  '/* node venue-dir.js が書く。手で書かないこと。\n'
  + '   場ごとの向き（結果ページの is-directionN）。場ごとに一定。\n'
  + '   コース基準の風 = (windN - dirN + 16) % 16 */\n'
  + 'module.exports = ' + JSON.stringify(out,null,2) + ';\n');
console.log(`\n  data/venue-dir.js に ${Object.keys(out).length}場 書きました`);
