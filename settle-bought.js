/* 実際に買ったものだけで、その日の収支を出す
   ==================================================================
     node settle-bought.js [YYYYMMDD]

   なぜ要るか。
   買ったあとにモデルを走らせ直して収支を数えると、答えが変わる。
   今節成績はレースが終わるたびに増えるので、買った時点とは中身が違う。
   2026-10-29、それで大村12Rを「外れ」と数えて本人に伝え、
   本人のスクリーンショット（1-2-4 ¥1,020 的中）で間違いが分かった。

   なので、数えるのは auto.js が買った瞬間に書いた tmp/bought-<日付>.json だけ。
   そこに「実際に押した買い目」が入っている。結果は公式から取る。
   モデルは一切走らせない。走らせたら、また別のものを数えてしまう。

   出るのは1日ぶんの表と合計。読むだけで、何も書き換えない。 */
const fs=require('fs'), path=require('path');
const F=require('./fetch.js');
const ROOT=__dirname;

const HD = process.argv.find(a=>/^\d{8}$/.test(a))
        || new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
const FILE = path.join(ROOT,'tmp',`bought-${HD}.json`);

if(!fs.existsSync(FILE)){
  /* tmp/ はコンテナと一緒に消えるので、消えない側から戻してみる。 */
  let got=null;
  try{ got=require('./captures.js').restoreBought(HD); }catch(e){}
  if(got) console.log(`  data/bought/${HD}.json から戻しました。`);
}
if(!fs.existsSync(FILE)){
  /* 買った記録が消えていても、本人の投票履歴から書き写した
     収支が data/settled.js にあるかもしれない。
     買い目の全体は無いが、実際の数字はそっちのほうが正しい。 */
  let sd=null;
  try{ sd=(require('./data/settled.js')||[])
         .find(x=>x.date===`${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)}`); }catch(e){}
  if(sd){
    const net=sd.returned-sd.invested;
    console.log(`\n=== ${HD} 実際の収支（${sd.source}）===`);
    console.log('  ※ auto.js の買った記録は残っていません。投票履歴から書き写した数字です。\n');
    console.log(`  買った ${sd.races}レース  的中 ${sd.hitRaces}レース`
      + `（${Math.round(sd.hitRaces/sd.races*100)}%）`);
    console.log(`  投資¥${sd.invested.toLocaleString()}  払戻¥${sd.returned.toLocaleString()}  `
      + `収支 ${net>=0?'+':'-'}¥${Math.abs(net).toLocaleString()}  `
      + `回収率${Math.round(sd.returned/sd.invested*100)}%`);
    if(sd.hits && sd.hits.length){
      console.log('\n  的中した買い目');
      for(const h of sd.hits)
        console.log(`    ${String(h.venue).padEnd(4)} ${String(h.rno).padStart(2)}R  ${h.combo}  `
          + `¥${String(h.yen).padStart(4)}買い → ¥${h.total.toLocaleString()}`);
    }
    if(sd.hitsOnly)
      console.log('\n  外れたレースの組番は残っていません（画面が的中だけの表示だったため）。');
    return;
  }
  console.log(`${FILE} がありません（data/bought/${HD}.json もありません）。`);
  console.log('その日は auto.js で買っていないか、別のパソコンで走らせています。');
  console.log('買い目は買った時点のものしか残せないので、あとから作り直せません。');
  console.log('公式サイトの「投票履歴」には残っています（ログインはこちらではできません）。');
  process.exitCode = 1;
  return;
}
let rows;
try{ rows = JSON.parse(fs.readFileSync(FILE,'utf8')); }
catch(e){ console.log(`${FILE} が読めません: ${e.message}`); process.exitCode = 1; return; }
if(!Array.isArray(rows) || !rows.length){ console.log('買った記録が空です。'); return; }

(async()=>{
  console.log(`\n=== ${HD} 実際に買ったぶんだけの収支 ===`);
  console.log(`  もとにした記録: tmp/bought-${HD}.json（${rows.length}本）`);
  console.log('  ※ モデルは走らせていません。押した買い目そのものを数えています。\n');
  console.log('場     R   買った点数  投資    正解     払戻    人気  当たり  収支');

  let inv=0, back=0, hit=0, pending=0, skipped=0;
  const odd=[];
  for(const b of rows){
    const picks=[...new Set(b.picks||[])];
    const unit = b.unitYen || 100;
    const spent = b.total != null ? b.total : picks.length*unit;
    /* 1点あたりの金額がそろっていない買い方（至極を厚くするなど）は、
       どの点にいくら載せたかが記録に無い。数えずに断る。 */
    if(picks.length*unit !== spent) odd.push(`${b.venue}${b.rno}R`);

    let res=null, pay=null, pop=null, why='';
    /* レース番号を先に確かめる。
       公式の結果ページは rno=99 のような範囲外を渡しても断らず、
       その日の最終レースの結果を返してくる（2026-11-03 に確認）。
       そのまま数えると、別のレースの払戻でその日の収支を出してしまう。
       記録が壊れていたら、黙って別の数字を出すより、その1本を落とす。 */
    if(!(Number.isInteger(b.rno) && b.rno>=1 && b.rno<=12)){
      skipped++;
      console.log(`${String(b.venue||b.jcd).padEnd(4)} ${String(b.rno).padStart(2)}R  `
        + `${String(picks.length).padStart(6)}点  ¥${String(spent).padStart(5)}  `
        + `レース番号がおかしいので数えません`);
      continue;
    }
    try{
      const html = await F.getPage(
        `https://www.boatrace.jp/owpc/pc/race/raceresult?rno=${b.rno}&jcd=${b.jcd}&hd=${HD}`);
      const o = F.parseResult(html);
      if(o && o.result!=null){ res=String(o.result); pay=o.pay; pop=o.pop; }
      else why = o && o.void ? (o.voidReason||'不成立') : '結果まだ';
    }catch(e){ why = String(e.message).slice(0,30); }

    if(res==null){
      pending++;
      console.log(`${String(b.venue||b.jcd).padEnd(4)} ${String(b.rno).padStart(2)}R  `
        + `${String(picks.length).padStart(6)}点  ¥${String(spent).padStart(5)}  ${why}`);
      continue;
    }
    const won = picks.includes(res);
    const got = won ? pay*(unit/100) : 0;
    inv += spent; back += got; if(won) hit++;
    console.log(`${String(b.venue||b.jcd).padEnd(4)} ${String(b.rno).padStart(2)}R  `
      + `${String(picks.length).padStart(6)}点  ¥${String(spent).padStart(5)}  `
      + `${res.padEnd(7)} ¥${String(pay).padStart(6)}  ${String(pop??'—').padStart(3)}  `
      + `${won?'○':'×'}      ${(got-spent>=0?'+¥':'-¥')}${String(Math.abs(got-spent)).padStart(5)}`);
  }

  const net = back-inv;
  console.log('');
  if(!inv){ console.log('  結果の出たレースがまだありません。'); return; }
  const counted = rows.length - pending - skipped;
  console.log(`  買った ${counted}本  投資¥${inv.toLocaleString()}  `
    + `払戻¥${back.toLocaleString()}  収支 ${net>=0?'+':'-'}¥${Math.abs(net).toLocaleString()}  `
    + `回収率${Math.round(back/inv*100)}%  的中${hit}/${counted}`);
  if(pending) console.log(`  （結果待ち ${pending}本は数に入れていません）`);
  if(skipped) console.log(`  （記録がおかしい ${skipped}本は数に入れていません）`);
  if(odd.length){
    console.log(`\n  ※ 1点あたりの金額がそろっていないレースがあります: ${odd.join(' / ')}`);
    console.log('     どの点にいくら載せたかが記録に無いので、払戻がずれている可能性があります。');
  }
  console.log('\n  当たっても収支がマイナスになることがあります。');
  console.log(`  1レース¥${rows[0] && rows[0].total ? rows[0].total.toLocaleString() : '1,000'} 使うので、`
    + 'それより払戻が少なければ、当たっていても減ります。');
})();
