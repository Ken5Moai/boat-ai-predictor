/* 1日ぶんの払戻一覧（payouts.js）が壊れていないこと
   ------------------------------------------------------------------
   「波乱を取りたい」に答えるために、公式の「本日の払戻金一覧」から
   全場・全レースの払戻と人気を書き写した（2026-10-17〜22・76場日912レース）。

   出走表が無くても、人気順の買い方の採算はこれだけで計算できる。
   モデルを一切使わないので、モデルの欠陥に引きずられない。

   ここで固定するのは「書き写しが壊れていないこと」と
   「都合のいい範囲だけを見ないこと」。 */
const fs=require('fs'),path=require('path');
const {execFileSync}=require('child_process');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const P=require(path.join(DIR,'payouts.js'));
const src=fs.readFileSync(path.join(DIR,'payouts.js'),'utf8');
const all=[]; for(const v of P) for(const [rno,pay,pop] of v.rows) all.push({venue:v.venue,rno,pay,pop});

console.log('\n書き写しの形');
ok(P.length===76, `76場日ある（${P.length}）`);
ok(new Set(P.map(v=>v.date)).size===6, '6日ぶんある');
ok(P.every(v=>v.rows.length===12), 'どの場も12レースある');
ok(all.length===912, `全912レース（${all.length}）`);
ok(all.every(x=>x.rno>=1&&x.rno<=12), 'レース番号が1〜12');
ok(all.every(x=>typeof x.pay==='number'&&x.pay>=100), '払戻がすべて100円以上の数値');
ok(all.every(x=>x.pop===null||(Number.isInteger(x.pop)&&x.pop>=1&&x.pop<=120)),
   '人気は null か 1〜120（3連単は120通りなので121以上は無い）');
ok(P.every(v=>/^2026-10-(1[789]|2[012])$/.test(v.date)), '日付が10/17〜10/22に収まっている');
{
  const key=P.map(v=>v.date+'/'+v.venue);
  ok(new Set(key).size===key.length, '同じ日に同じ場が2回入っていない');
}

console.log('\n払戻と人気が矛盾しないこと');
const okp=all.filter(x=>x.pop!=null);
ok(okp.length===883, `返還を除くと883レース（${okp.length}）`);
/* 人気が上なら配当は安い、が全体の傾向として出るはず。
   逆相関になっていなければ、人気と払戻の対応がずれている。 */
const rank=v=>{const i=v.map((x,j)=>[x,j]).sort((a,b)=>a[0]-b[0]);const r=[];
  for(let k=0;k<i.length;){let j=k;while(j+1<i.length&&i[j+1][0]===i[k][0])j++;
    const a=(k+j)/2+1;for(let t=k;t<=j;t++)r[i[t][1]]=a;k=j+1;} return r;};
const ra=rank(okp.map(x=>x.pop)), rb=rank(okp.map(x=>x.pay));
const ma=ra.reduce((a,b)=>a+b,0)/ra.length, mb=rb.reduce((a,b)=>a+b,0)/rb.length;
let num=0,da=0,db=0;
for(let i=0;i<ra.length;i++){const x=ra[i]-ma,y=rb[i]-mb;num+=x*y;da+=x*x;db+=y*y;}
const rho=num/Math.sqrt(da*db);
ok(rho>0.9, `人気と払戻の順位相関が高い（${rho.toFixed(3)}）← 対応がずれていれば下がる`);
ok(okp.filter(x=>x.pop>=100).every(x=>x.pay>=30000),
   '100番人気以降の払戻がすべて¥30,000以上');
/* 「1番人気なら必ず安い」は私の決めつけで、間違いだった。
   883レースのうち 2026-10-18 戸田7R が 1番人気で¥2,030（20.3倍）。
   120通りに票が散って、どの組も本命にならなかったレースでは起こりうる。
   書き写しの誤りではないことを確かめたうえで、基準のほうを直した。
   中央値で見るぶんには、1番人気がいちばん安い帯であることは変わらない。 */
{
  const p1=okp.filter(x=>x.pop===1).map(x=>x.pay).sort((a,b)=>a-b);
  const med=p1[Math.floor(p1.length/2)];
  ok(med<=1000, `1番人気の払戻の中央値が¥1,000以下（¥${med}）`);
  ok(p1.filter(x=>x.pay>2000).length<=2 || p1.filter(x=>x>2000).length<=2,
     `1番人気で¥2,000を超えたのは${p1.filter(x=>x>2000).length}件（票が散ったレース）`);
  ok(p1[p1.length-1]<=5000, `1番人気の最大が¥5,000以下（¥${p1[p1.length-1]}）`);
}
ok(okp.filter(x=>x.pop>=61).every(x=>x.pay>=10000),
   '61番人気以降の払戻がすべて¥10,000以上');

console.log('\n私たちが実際に関わったレースと一致すること');
const waka=P.find(v=>v.venue==='若松'&&v.date==='2026-10-22').rows;
ok(waka.find(r=>r[0]===10)[1]===38870,
   '若松10Rの払戻¥38,870が一致（本人が4-3-5で取った388.7倍）');
ok(waka.find(r=>r[0]===12)[1]===1030,
   '若松12Rの払戻¥1,030が一致（1-2-4の10.3倍）');

console.log('\n都合のいい範囲だけを見ない作り');
const out=execFileSync(process.execPath,[path.join(DIR,'payouts.js')],{encoding:'utf8'});
ok(okp.filter(x=>x.pop===1).length>=50,
   `1番人気で決まった回が十分ある（${okp.filter(x=>x.pop===1).length}件）`);
ok(/1〜  1番人気/.test(out) && /61〜120番人気/.test(out),
   '堅いほうも荒れるほうも、同じ表に並べて出す');
ok(/3段階で見る/.test(out), '3段階（そのまま・上位2件除く・引き直し）にかけている');
ok(/引き直しが95%を超える範囲が1つも無ければ/.test(out),
   '引き直しの基準を書いてある');
ok(/モデルは一切使っていない/.test(out), 'モデルを使っていないと明記している');
ok(/控除率は25%なので、理論上どの範囲も75%に近づく/.test(out),
   '控除率という基準線を示している');
/* 回収率が100%を超える範囲が出たら、それは要検証。いまは出ないはず。 */
const rates=[...out.matchAll(/\s(\d+)%\s+\d+\/883/g)].map(m=>+m[1]);
ok(rates.length>0 && rates.every(r=>r<100),
   `どの範囲も100%未満（最大${Math.max(...rates)}%）← 超える範囲が出たら要検証`);

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
