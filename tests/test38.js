/* 同じ日に何度も走る選手を使って、書き写しを突き合わせる
   ------------------------------------------------------------------
   1節のあいだ、ひとりの選手は同じ日に2回も3回も走る。
   そのとき出走表の数字（全国・当地・モーター・ボート・平均ST・F数・級別）は
   同じ日なら同じ値のはずで、1つでも違えば、どちらかを読み違えている。

   さらに今節成績には、同じ日の前のレースの結果が1行ずつ足されていく。
   そのレースをこちらも記録していれば、着順を突き合わせられる。
     例: 唐津7R の山口の最終走 = 唐津1R。1Rの正解は 1-3-5 で山口は1号艇 → 1着。
         今節成績も「1着」と出ている。合う。

   どちらも、オッズの検算（払戻・人気）とは別のところを見る当たり判定になる。
   採点に使う数字そのものを見ているので、こちらのほうが効く。 */
const fs=require('fs'),path=require('path'),vm=require('vm');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(DIR,'backtest.js'),'utf8');
const from=src.indexOf('const RACES=['), to=src.indexOf('\n];',from);
if(from<0||to<0){ console.log('  ✗ FAIL: RACES を取り出せない'); process.exit(1); }
const RACES=vm.runInNewContext(src.slice(from+'const RACES='.length, to+2));

console.log('\n=== 同じ日に2回以上走った選手の出走表が食い違っていないか ===');
const FIELDS=['g','nat','loc','mot','bt','st','F'];
const seen=new Map();          /* "日付|登番" → [{race, boat}] */
for(const r of RACES){
  if(!r.date) continue;
  for(const b of r.B){
    const k=`${r.date}|${b.reg}`;
    if(!seen.has(k)) seen.set(k,[]);
    seen.get(k).push({race:r, b});
  }
}
/* 中身を確かめきれていない食い違い。消さずにここに名前で残す。
   「とりあえず通す」ための場所ではないので、理由と次にやることを必ず書く。 */
const UNRESOLVED = {
  '2026-09-24|5143|bt':
    '三国5R=42.61 / 三国11R=27.54。モーター2連率は両方34.4で同じなので、'
    +'モーターは替わっていない。展示タイムは6.67→6.81と重くなっており、'
    +'ボートだけ交換した可能性がある（公式はボート変更を赤字で出す）。'
    +'書き写しの誤りか本当の交換かは、9/24の出走表を見直さないと決められない。'
    +'どちらか分かるまで、この1件だけ別扱いにする。',
};
let pairs=0, unresolved=0;
for(const [k,list] of seen){
  if(list.length<2) continue;
  pairs++;
  const [d,reg]=k.split('|');
  const first=list[0];
  const bad=[];
  for(const cur of list.slice(1))
    for(const f of FIELDS)
      if(first.b[f]!==cur.b[f]){
        const key=`${d}|${reg}|${f}`;
        if(UNRESOLVED[key]){
          unresolved++;
          console.log(`  － 未解決 ${key}\n      ${UNRESOLVED[key]}`);
        }else{
          bad.push(`${f}: ${first.race.name}=${first.b[f]} / ${cur.race.name}=${cur.b[f]}`);
        }
      }
  if(bad.length===0 && !list.slice(1).some(cur=>FIELDS.some(f=>first.b[f]!==cur.b[f]))){
    ok(true, `${d} 登番${reg}（${list.length}走: ${list.map(x=>'R'+x.race.rno).join(' ')}）の出走表が一致`);
  }else if(bad.length){
    ok(false, `${d} 登番${reg}（${list.length}走）の出走表が一致  ${bad.join(' / ')}`);
  }
}
ok(pairs>0, `同じ日に2回以上走った選手が ${pairs} 人ぶんあり、突き合わせできている`);
ok(unresolved===Object.keys(UNRESOLVED).length,
   `未解決として別扱いにしている食い違いは ${unresolved} 件（一覧と同じ数）`);

console.log('\n=== 今節成績の着順が、記録ずみのレース結果と食い違っていないか ===');
/* 同じ日・同じ場で、この選手が出ていた「前のレース」を古い順に並べる。
   今節成績は古い→新しい順なので、末尾からその数だけが前のレースに対応する。 */
let checked=0, notRecorded=0;
for(const r of RACES){
  if(!r.date) continue;
  for(const b of r.B){
    const earlier=RACES.filter(x=>x!==r && x.date===r.date && x.jcd===r.jcd
                                && x.rno<r.rno && x.B.some(q=>q.reg===b.reg))
                       .sort((a,c)=>a.rno-c.rno);
    if(!earlier.length) continue;
    const rec=b.rec||[];
    if(rec.length===0){
      /* 今節成績そのものを取っていないレースがある。取っていないのと
         間違っているのは別なので、ここは失敗にせず、取りこぼしとして数える。 */
      notRecorded++;
      continue;
    }
    if(rec.length<earlier.length){
      ok(false,`${r.name} 登番${b.reg} の今節成績が ${rec.length}走ぶんしかない（前のレースは${earlier.length}件）`);
      continue;
    }
    const tail=rec.slice(rec.length-earlier.length);
    earlier.forEach((x,i)=>{
      checked++;
      const order=String(x.result).split('-');          /* 上位3艇だけ分かる */
      const lane=x.B.findIndex(q=>q.reg===b.reg)+1;     /* 出走表の並び＝枠番 */
      const place=order.indexOf(String(lane));          /* -1 なら4着以下 */
      const got=tail[i][2];
      if(place>=0){
        ok(got===place+1,
           `${r.name} 登番${b.reg} の今節成績「${got}着」＝ ${x.name} の実際（${place+1}着）`);
      }else{
        ok(!(got>=1 && got<=3),
           `${r.name} 登番${b.reg} の今節成績「${got}」は、${x.name}（${x.result}）に入っていないので4着以下のはず`);
      }
    });
  }
}
ok(checked>0, `記録ずみのレースと突き合わせできた走行が ${checked} 件ある`);
if(notRecorded) console.log(`  － 今節成績を取っていないため突き合わせできなかった選手 ${notRecorded} 人（古い記録。誤りではない）`);

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
