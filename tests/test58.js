/* 投票履歴から書き写した収支（data/settled.js）が、公式の結果と合っているか
   ------------------------------------------------------------------
   このファイルは人が画面から書き写す。だから打ち間違いが入る。
   入ったまま気づかないと、「実際はこうだった」という一番強い数字が
   静かに嘘になる。

   確かめるのは2つ。
     ・ファイルの中で足し算が合っているか（払戻の合計 = 払戻金額合計）
     ・的中した組番と払戻が、公式の結果（races.js）と一致するか
   一致しなければ、書き写しを間違えているか、別のレースを見ている。

   モデルは使わない。ここは「実際に何が起きたか」だけを見る場所。 */
const path=require('path');
const fs=require('fs');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const P=path.join(ROOT,'data','settled.js');
if(!fs.existsSync(P)){
  ok(true, 'data/settled.js は無い（買った記録が消えた日がまだ無い）');
  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exitCode = 0;
  return;
}
const S=require(P);
const RACES=require(path.join(ROOT,'data','races.js'));
ok(Array.isArray(S), 'data/settled.js は配列を返す');

console.log('\n=== 日ごとの形 ===');
{
  const seen=new Set();
  for(const d of S){
    ok(/^\d{4}-\d{2}-\d{2}$/.test(d.date||''), `日付が書いてある（${d.date}）`);
    ok(!seen.has(d.date), `${d.date} が2回書かれていない`);
    seen.add(d.date);
    ok(typeof d.source==='string' && d.source.length>0, `${d.date} 出どころが書いてある`);
    ok(Number.isInteger(d.races) && d.races>0, `${d.date} 購入R数が整数（${d.races}）`);
    ok(Number.isInteger(d.hitRaces) && d.hitRaces>=0 && d.hitRaces<=d.races,
       `${d.date} 的中R数が購入R数以下（${d.hitRaces}/${d.races}）`);
    ok(Number.isInteger(d.invested) && d.invested>0, `${d.date} 投資が整数（¥${d.invested}）`);
    ok(Number.isInteger(d.returned) && d.returned>=0, `${d.date} 払戻が整数（¥${d.returned}）`);
    /* 買った記録がそろっているなら、そちらが本物。こちらに書く必要はない。 */
    const bought=path.join(ROOT,'data','bought',`${d.date.replace(/-/g,'')}.json`);
    ok(!fs.existsSync(bought),
       `${d.date} は data/bought/ に本物の記録が無い日（あるならそちらを使う）`);
  }
}

console.log('\n=== 足し算が合っているか ===');
for(const d of S){
  const sum=(d.hits||[]).reduce((a,h)=>a+h.total,0);
  if(d.hitsOnly){
    /* 的中だけの画面なので、払戻の合計は払戻金額合計と一致するはず
       （外れた買い目の払戻は0なので、合計には効かない）。 */
    ok(sum===d.returned,
       `${d.date} 的中の払戻を足すと払戻金額合計になる（¥${sum} = ¥${d.returned}）`);
  }else{
    ok(sum===d.returned, `${d.date} 払戻の合計が合う（¥${sum} = ¥${d.returned}）`);
  }
  const races=new Set((d.hits||[]).map(h=>`${h.jcd}|${h.rno}`));
  ok(races.size===d.hitRaces,
     `${d.date} 的中した別々のレースが的中R数と合う（${races.size} = ${d.hitRaces}）`);
  for(const h of (d.hits||[])){
    /* 1件ぶんの払戻 = 100円あたりの払戻 × 買った金額/100 */
    ok(h.total===h.per100*(h.yen/100),
       `${d.date} ${h.venue}${h.rno}R ¥${h.yen}で¥${h.per100}なら払戻¥${h.per100*(h.yen/100)}（書いてあるのは¥${h.total}）`);
  }
  ok(d.returned<=d.invested*1000,
     `${d.date} 払戻が投資に対してありえない額になっていない`);
}

console.log('\n=== 公式の結果と一致するか ===');
for(const d of S){
  for(const h of (d.hits||[])){
    const r=RACES.find(x=>x.date===d.date && x.jcd===h.jcd && x.rno===h.rno);
    if(!r){
      /* まだ取り込んでいない日なら、照合できないとだけ言う（嘘にはしない）。 */
      ok(true, `${d.date} ${h.venue}${h.rno}R は races.js にまだ無いので照合しない`);
      continue;
    }
    ok(r.result===h.combo,
       `${d.date} ${h.venue}${h.rno}R の正解が一致（履歴 ${h.combo} / 公式 ${r.result}）`);
    ok(r.pay===h.per100,
       `${d.date} ${h.venue}${h.rno}R の払戻が一致（履歴 ¥${h.per100} / 公式 ¥${r.pay}）`);
  }
}

console.log('\n=== 同じレースを 2回買わないか ===');
/* 11/3 の投票履歴に、下関9R の 1-3-4 が受付006と007の2件入っていた。
   同じレースの同じ組番を、連番の受付で2回。お金が増える側の間違い。
   auto.js に止める仕組みを入れたので、それが働くかを見る。 */
{
  const A=require(path.join(ROOT,'auto.js'));
  ok(typeof A.alreadyBought==='function', 'auto.js が alreadyBought を出している');
  const src=fs.readFileSync(path.join(ROOT,'auto.js'),'utf8');
  ok(/const dup = alreadyBought\(r\.jcd, r\.rno\)/.test(src),
     '買う直前に、その日すでに買っていないかを見ている');
  ok(/if\(dup\)\{[\s\S]{0,400}continue;/.test(src),
     'すでに買っていたら、押さずに飛ばす');
  ok(/require\.main !== module\) return/.test(src),
     'require しただけでは買いに行かない（読み込みで走り出さない）');
  /* 実際に記録を置いて、見つけられるかを見る。使い終わったら消す。 */
  const HD=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
  const f=path.join(ROOT,'tmp',`bought-${HD}.json`);
  const had=fs.existsSync(f);
  if(had){
    ok(true, `tmp/bought-${HD}.json がすでにあるので、置いて確かめるのは飛ばす`);
  }else{
    fs.mkdirSync(path.join(ROOT,'tmp'),{recursive:true});
    fs.writeFileSync(f, JSON.stringify([{jcd:'19',rno:9,total:1000,at:new Date().toISOString()}]));
    try{
      ok(!!A.alreadyBought('19',9), '買った記録にあるレースを「買った」と答える');
      ok(A.alreadyBought('19',10)===false, '買っていないレースは「買っていない」と答える');
      ok(A.alreadyBought('24',9)===false, '場が違えば「買っていない」と答える');
    } finally { fs.unlinkSync(f); }
    ok(A.alreadyBought('19',9)===null,
       '記録そのものが無いときは「分からない」と答える（買っていない、とは言わない）');
  }
}

console.log('\n=== settle-bought.js がこれを見るか ===');
{
  const src=fs.readFileSync(path.join(ROOT,'settle-bought.js'),'utf8');
  ok(/settled\.js/.test(src),
     'settle-bought.js は、買った記録が無いとき settled.js を見る');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exitCode = fail ? 1 : 0;
