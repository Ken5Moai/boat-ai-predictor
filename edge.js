/* モデルと生データは、市場が知らないことを持っているか
   ==================================================================
     node edge.js            … 3つとも測る（数分かかる）
     node edge.js --save     … 測ったうえで data/edge.js に書き出す

   なぜ要るか。
   控除率は約25%ある。つまり何も考えずに買えば回収率75%になる。
   これを超えるには「市場より正しい確率」を持っているしかない。
   買い方（点数・配分・損切り）をいくら工夫しても、持っていなければ
   75%の線は越えられない。順番が逆なので、まずここを測る。

   測るのは3つ。どれも「学習に使っていない日」で測る。
     ① 市場の確率 q とモデルの確率 p を q^a × p^b で混ぜ、a,b を学習する。
        b が 0 なら、モデルは市場に何も足していない。
     ② オッズ帯・人気帯ごとに、その帯の組を全部買ったときの回収率。
        モデルを使わない。100%を超える帯があれば、そこが歪み。
     ③ 手で決めた重みを捨て、生データから重みを学習する（Plackett-Luce）。
        市場の1着確率を土台に置いて、生データが上乗せになるかを見る。

   2026-11-07 の結果（選り好みなし1309レース）
     ① b=0.015（モデルの重みはほぼゼロ）。測定側の改善 +0.003 で、
        的中率・回収率は市場だけの場合と同じ。
     ② どの帯も100%未満。いちばん良い2番人気でも91%、
        いちばん良いオッズ帯（3〜5倍）でも89%。
     ③ 生データを足すと測定側で -0.005 悪化する。罰則を強くするほど
        良くなる＝重みを全部ゼロにしたい、という形。

   結論。いまのデータでは、どんな買い方を作っても負ける。
   これが変わるとすれば、いま取っていない情報を取れるようになったとき。 */
const fs=require('fs'), path=require('path');
const ROOT=__dirname;
const BT=require('./backtest.js');
const ODDS=require('./data/odds.js');
const UNS=require('./data/unscorable.js');
const SAVE=process.argv.includes('--save');

/* ---- 選り好みなしの場日だけを使う ---- */
function fairRaces(){
  const byDay=new Map();
  for(const r of BT.RACES){ const k=`${r.date}|${r.jcd}`;
    if(!byDay.has(k)) byDay.set(k,[]); byDay.get(k).push(r); }
  const out=[];
  for(const [k,list] of byDay){
    const [date,jcd]=k.split('|');
    const skip=new Set(UNS.filter(u=>u.date===date&&u.jcd===jcd).map(u=>u.rno));
    const nos=new Set(list.map(r=>r.rno));
    if([...Array(12)].every((_,i)=>nos.has(i+1)||skip.has(i+1))) out.push(...list);
  }
  return out;
}
const EPS=1e-9;
const splitDays=D=>{
  const days=[...new Set(D.map(r=>r.date))].sort();
  const cut=days[Math.floor(days.length*0.7)];
  return {cut, tr:D.filter(r=>r.date<cut), te:D.filter(r=>r.date>=cut)};
};

console.log('=== モデルと生データは、市場が知らないことを持っているか ===');
const fair=fairRaces();
console.log(`  選り好みなし ${fair.length}レース。モデルを走らせます（数分）…`);
const run=BT.runWith({},null,{races:fair});
const byName=new Map(fair.map(r=>[r.name,r]));

/* 1レース分をまとめる */
const D=[];
for(const x of run){
  const O=ODDS[x.name]; if(!O || Object.keys(O).length!==120) continue;
  const r=byName.get(x.name);
  if(!r.B || r.B.length!==6) continue;
  const order=String(r.result).split('-').map(Number);
  if(order.length!==3 || order.some(v=>!(v>=1&&v<=6))) continue;
  const combos=Object.keys(O);
  const inv=combos.map(k=>1/O[k]); const s=inv.reduce((a,c)=>a+c,0);
  D.push({name:x.name, date:r.date, result:x.result, pay:x.pay, combos,
          p:combos.map(k=>x.probOf[k]), q:combos.map((k,i)=>inv[i]/s),
          o:combos.map(k=>O[k]), take:1-1/s, B:r.B, order});
}
const {cut,tr,te}=splitDays(D);
console.log(`  使えるレース ${D.length}本  控除率の中央値 `
  + `${(D.map(r=>r.take).sort((a,b)=>a-b)[D.length>>1]*100).toFixed(1)}%`);
console.log(`  決める ${tr.length}本（${cut}より前）／測る ${te.length}本\n`);

/* ---- ① モデルを市場に混ぜる ---- */
const blend=(r,a,b)=>{
  const s=r.combos.map((_,i)=>Math.pow(Math.max(r.q[i],EPS),a)*Math.pow(Math.max(r.p[i],EPS),b));
  const t=s.reduce((x,y)=>x+y,0); return s.map(x=>x/t);
};
const LL=(set,a,b)=>set.reduce((acc,r)=>
  acc+Math.log(Math.max(blend(r,a,b)[r.combos.indexOf(r.result)],EPS)),0)/set.length;
let B1={ll:-1e9,a:1,b:0};
for(let a=0;a<=2.001;a+=0.1) for(let b=0;b<=1.501;b+=0.05){
  const ll=LL(tr,a,b); if(ll>B1.ll) B1={ll,a,b};
}
for(let a=Math.max(0,B1.a-0.1);a<=B1.a+0.1;a+=0.01)
  for(let b=Math.max(0,B1.b-0.05);b<=B1.b+0.05;b+=0.005){
    const ll=LL(tr,a,b); if(ll>B1.ll) B1={ll,a,b};
  }
const mk1=LL(te,1,0), bl1=LL(te,B1.a,B1.b);
console.log('① モデルの確率を市場に混ぜる');
console.log(`   学習でいちばん良い混ぜ方  市場 a=${B1.a.toFixed(2)}  モデル b=${B1.b.toFixed(3)}`);
console.log(`   測定側の対数尤度  市場だけ ${mk1.toFixed(4)} → 混ぜると ${bl1.toFixed(4)}`
  + `（${bl1-mk1>=0?'+':''}${(bl1-mk1).toFixed(4)}）`);
const ret1=(set,a,b,n)=>{ let inv=0,back=0;
  for(const r of set){ const s=blend(r,a,b);
    const top=r.combos.map((k,i)=>i).sort((x,y)=>s[y]-s[x]).slice(0,n);
    inv+=100*n; if(top.some(i=>r.combos[i]===r.result)) back+=r.pay; }
  return Math.round(back/inv*100); };
console.log(`   上位10点の回収率（測定側）  市場だけ ${ret1(te,1,0,10)}%  `
  + `混ぜると ${ret1(te,B1.a,B1.b,10)}%`);

/* ---- ② 市場の歪みを帯ごとに ---- */
console.log('\n② 市場の歪み（モデルを使わない。人気帯ごとに全部買う）');
const redges=[1,2,3,4,6,9,13,19,27,37,50,70,95,120,121];
const acc=redges.slice(0,-1).map(()=>({n:0,back:0,win:0}));
for(const r of D){
  const idx=r.combos.map((k,i)=>i).sort((x,y)=>r.o[x]-r.o[y]);
  idx.forEach((i,n0)=>{
    const rk=n0+1;
    for(let b=0;b<redges.length-1;b++) if(rk>=redges[b]&&rk<redges[b+1]){
      acc[b].n++; if(r.combos[i]===r.result){ acc[b].win++; acc[b].back+=r.pay; } break; }
  });
}
let bestBand={pct:0,lab:''};
for(let b=0;b<acc.length;b++){
  const a=acc[b]; if(!a.n) continue;
  const pct=Math.round(a.back/(a.n*100)*100);
  const lab= redges[b+1]-redges[b]===1?`${redges[b]}番人気`:`${redges[b]}〜${redges[b+1]-1}番人気`;
  console.log(`   ${lab.padEnd(14)} ${String(a.n).padStart(6)}組  回収率${String(pct).padStart(4)}%`);
  if(pct>bestBand.pct) bestBand={pct,lab};
}
console.log(`   → いちばん良い帯は ${bestBand.lab} の ${bestBand.pct}%`
  + `（控除率25%なので、歪みが無ければどこも75%）`);

/* ---- ③ 生データから重みを学習する ---- */
console.log('\n③ 手で決めた重みを捨て、生データから学習する（Plackett-Luce）');
let VDIR={}; try{ VDIR=require('./data/venue-dir.js'); }catch(e){ VDIR={}; }
const NUM=['nat','loc','mot','bt','st','exST','exT','tilt','wt','recAvg','recST','recN'];
const BIN=['F','gradeA','grade1'];
const FEAT=[...NUM,...NUM.map(k=>k+'_na'),...BIN,'lane2','lane3','lane4','lane5','lane6'];
const WFEAT=[...FEAT];
for(let l=1;l<=6;l++) WFEAT.push(`wind_cos_L${l}`,`wind_sin_L${l}`);
for(let l=1;l<=6;l++) WFEAT.push(`ws_L${l}`,`wave_L${l}`);
for(const r of D){
  const mkt1=[0,0,0,0,0,0];
  r.combos.forEach((k,i)=>{ mkt1[Number(k[0])-1]+=r.q[i]; });
  r.lm=mkt1.map(v=>Math.log(Math.max(v,1e-6)));
  const bo=r.B.map((b,i)=>{ const rec=b.rec||[];
    return { lane:i+1, nat:b.nat??null, loc:(b.loc===0?null:(b.loc??null)),
      mot:b.mot??null, bt:b.bt??null, st:b.st??null, exST:b.exST??null, exT:b.exT??null,
      tilt:b.tilt??null, wt:b.wt??null, F:b.F?1:0,
      recN:rec.length, recAvg:rec.length?rec.reduce((a,x)=>a+x[2],0)/rec.length:null,
      recST:rec.length?rec.reduce((a,x)=>a+(x[1]??0),0)/rec.length:null,
      gradeA:/A/.test(b.g||'')?1:0, grade1:/1$/.test(b.g||'')?1:0 }; });
  const mean={},sd={};
  for(const k of NUM){ const v=bo.map(b=>b[k]).filter(x=>x!=null);
    mean[k]=v.length?v.reduce((a,c)=>a+c,0)/v.length:0;
    const w=bo.map(b=>b[k]==null?mean[k]:b[k]);
    const m=w.reduce((a,c)=>a+c,0)/w.length;
    sd[k]=Math.sqrt(w.reduce((a,c)=>a+(c-m)*(c-m),0)/w.length)||1; }
  /* 数でないものが1つでも混じると、そのレースは丸ごと計算できなくなる
     （0 を掛けても NaN のままなので、重みを使わない比較まで巻き添えになる）。
     2026-11-07、593レース中112レースがこれで落ちていた。
     落とさず、数でないものは 0（＝そのレースの平均）に置き換えて、
     「欠けていた」印のほうで拾う。 */
  let bad=0;
  const fin=(v,k)=>{ if(Number.isFinite(v)) return v; bad++; return 0; };
  r.X=bo.map(b=>{ const x=[];
    for(const k of NUM) x.push(fin(((b[k]==null?mean[k]:b[k])-mean[k])/sd[k],k));
    for(const k of NUM) x.push(b[k]==null||!Number.isFinite(Number(b[k]))?1:0);
    for(const k of BIN) x.push(fin(Number(b[k]),k));
    for(let L=2;L<=6;L++) x.push(b.lane===L?1:0);
    return x; });
  r.badFeat=bad;
  /* 風を使う版。レース全体に共通の値（風向き・風速・波）は、
     そのまま入れても 6艇全部に同じだけ足され、比べるときに消える。
     効かせるには艇の側の何かと掛け合わせるしかないので、コースと掛ける。
     風向きは16方位の番号なので、角度に戻して cosとsin に分ける
     （16と１が隣り合わせなのに遠い数字になるのを避けるため）。
     場の向きを引いてコース基準に直す。引けない場は風を使わない。 */
  const dir = VDIR[r.jcd];
  const hasWind = (r.windN!=null && dir!=null);
  r.hasWind = hasWind;
  const th = hasWind ? 2*Math.PI*(((r.windN-dir)%16+16)%16)/16 : 0;
  const ws = Number.isFinite(r.ws)?r.ws:0, wv = Number.isFinite(r.wave)?r.wave:0;
  r.XW = r.X.map((x,i)=>{
    const L=i+1, add=[];
    for(let l=1;l<=6;l++){
      const on = (L===l && hasWind) ? 1 : 0;
      add.push(on*ws*Math.cos(th)/10, on*ws*Math.sin(th)/10);
    }
    for(let l=1;l<=6;l++){
      const on = (L===l) ? 1 : 0;
      add.push(on*ws/10, on*wv/10);
    }
    return x.concat(add.map(v=>Number.isFinite(v)?v:0));
  });
}
/* 使えなかったレースは、数にも入れない。
   2026-11-07、ここで「飛ばしたのに全レース数で割る」をやっていた。
   飛ばした回は 0 を足すので、平均が良いほうへ動く。
   -3.86 が -3.12 に見えていた（2割ほど飛んでいた）。
   総当たりで出せる最良より良い数字が出たので気づいた。 */
let FKEY='X';     /* 'X'=生のデータだけ / 'XW'=風も使う */
function llg(set,a,W,lam,grad){
  let ll=0, used=0; const gW=new Float64Array(W.length); let gA=0;
  for(const r of set){
    const z=r[FKEY].map((x,i)=>{ let s=a*r.lm[i]; for(let k=0;k<W.length;k++) s+=W[k]*x[k]; return s; });
    const mx=Math.max(...z), v=z.map(t=>Math.exp(t-mx));
    const [o1,o2,o3]=r.order.map(x=>x-1);
    const S0=v.reduce((x,y)=>x+y,0), S1=S0-v[o1], S2=S1-v[o2];
    if(!(S1>0&&S2>0) || !Number.isFinite(S0+S1+S2)) continue;
    used++;
    ll+=(z[o1]-mx-Math.log(S0))+(z[o2]-mx-Math.log(S1))+(z[o3]-mx-Math.log(S2));
    if(!grad) continue;
    for(let j=0;j<6;j++){
      let d=(j===o1?1:0)-v[j]/S0;
      if(j!==o1) d+=(j===o2?1:0)-v[j]/S1;
      if(j!==o1&&j!==o2) d+=(j===o3?1:0)-v[j]/S2;
      gA+=d*r.lm[j];
      for(let k=0;k<W.length;k++) gW[k]+=d*r[FKEY][j][k];
    }
  }
  if(!used) return {ll:-Infinity, used:0, skipped:set.length, gA:0, gW};
  ll-=lam*W.reduce((x,y)=>x+y*y,0)*used;
  if(grad) for(let k=0;k<W.length;k++) gW[k]-=2*lam*W[k]*used;
  return {ll:ll/used, used, skipped:set.length-used,
          gA:gA/used, gW:gW.map(x=>x/used)};
}
function fit(set,lam,useW,iters=600,nf){
  let a=1; const W=new Float64Array(nf||FEAT.length);
  let mA=0,vA=0; const mW=new Float64Array(W.length), vW=new Float64Array(W.length);
  const lr=0.05,b1=0.9,b2=0.999,eps=1e-8;
  for(let t=1;t<=iters;t++){
    const g=llg(set,a,useW?W:new Float64Array(W.length),lam,true);
    mA=b1*mA+(1-b1)*g.gA; vA=b2*vA+(1-b2)*g.gA*g.gA;
    a+=lr*(mA/(1-Math.pow(b1,t)))/(Math.sqrt(vA/(1-Math.pow(b2,t)))+eps);
    if(useW) for(let k=0;k<W.length;k++){
      mW[k]=b1*mW[k]+(1-b1)*g.gW[k]; vW[k]=b2*vW[k]+(1-b2)*g.gW[k]*g.gW[k];
      W[k]+=lr*(mW[k]/(1-Math.pow(b1,t)))/(Math.sqrt(vW[k]/(1-Math.pow(b2,t)))+eps); }
  }
  return {a,W:useW?W:new Float64Array(W.length)};
}
{
  const nb=D.filter(r=>r.badFeat>0).length;
  const nl=D.filter(r=>r.lm.some(v=>!Number.isFinite(v))).length;
  console.log(`   数でない値を置き換えたレース ${nb}本 / 市場側が計算できないレース ${nl}本`);
}
const m0=fit(tr,0,false);
/* a は1つしかないので総当たりでも出せる。勾配法が収束したかを、ここで突き合わせる。
   2026-11-07、片方が -3.12、総当たりが -3.86 と食い違った。
   計算が合わないまま結論を出すわけにいかないので、毎回ここで照合する。 */
let brute={ll:-1e9,a:0};
for(let a=0;a<=2.5;a+=0.01){ const v=llg(tr,a,new Float64Array(FEAT.length),0,false).ll;
  if(v>brute.ll) brute={ll:v,a}; }
const useA = llg(tr,m0.a,m0.W,0,false).ll >= brute.ll ? m0.a : brute.a;
console.log(`   市場だけ        学習でのa  勾配法 ${m0.a.toFixed(3)} / 総当たり ${brute.a.toFixed(2)}`
  + `（差 ${Math.abs(m0.a-brute.a).toFixed(3)}）`);
const zeroW=new Float64Array(FEAT.length);
const base3=llg(te,useA,zeroW,0,false).ll;
if(process.env.EDGE_DEBUG){
  const z=te[0];
  require('fs').writeFileSync('/tmp/claude-0/-home-user-boat-ai-predictor/95fe63c4-5cf5-5bcd-8923-6bf098464b41/scratchpad/dbg.json',
    JSON.stringify({teLen:te.length, trLen:tr.length, cut,
      first:{name:z.name, lm:z.lm, order:z.order, result:z.result}}, null, 1));
}
const b3=llg(te,useA,zeroW,0,false);
console.log(`   市場だけ        測定 ${base3.toFixed(4)}`
  + (b3.skipped?`   ※ 計算できなかった ${b3.skipped}レースは数に入れていません`:''));
let best3=null;
for(const lam of [0.3,0.1,0.03,0.01]){
  const m=fit(tr,lam,true);
  const t3=llg(te,m.a,m.W,0,false).ll;
  console.log(`   市場+生データ   測定 ${t3.toFixed(4)}（罰則 ${lam}）`);
  if(!best3 || t3>best3.te) best3={lam,m,te:t3};
}
console.log(`   → 市場との差 ${best3.te-base3>=0?'+':''}${(best3.te-base3).toFixed(4)}`);

/* ---- ④ 風を足すと変わるか ---- */
console.log('\n⑤ 風を足す（コースと掛け合わせる）');
let best4=null, cov=D.filter(r=>r.hasWind).length;
console.log(`   風向きが使えるレース ${cov}/${D.length}本`
  + `（場の向きがある場 ${Object.keys(VDIR).length}）`);
if(cov < D.length*0.5){
  console.log('   風向きが半分も無いので、まだ測りません。');
  console.log('   node backfill-wind.js と node venue-dir.js を走らせてから。');
}else{
  FKEY='XW';
  for(const lam of [0.3,0.1,0.03,0.01]){
    const m=fit(tr,lam,true,600,WFEAT.length);
    const t4=llg(te,m.a,m.W,0,false).ll;
    console.log(`   市場+生データ+風   測定 ${t4.toFixed(4)}（罰則 ${lam}）`);
    if(!best4 || t4>best4.te) best4={lam,m,te:t4};
  }
  console.log(`   → 市場だけとの差 ${best4.te-base3>=0?'+':''}${(best4.te-base3).toFixed(4)}`
    + `／風を足す前との差 ${best4.te-best3.te>=0?'+':''}${(best4.te-best3.te).toFixed(4)}`);
  /* 風の重みだけ見る */
  const w=[...best4.m.W].map((v,i)=>({f:WFEAT[i],v}))
    .filter(x=>/^wind_/.test(x.f)).sort((x,y)=>Math.abs(y.v)-Math.abs(x.v)).slice(0,6);
  console.log('   風の重み（大きい順） ' + w.map(x=>`${x.f} ${x.v>=0?'+':''}${x.v.toFixed(3)}`).join(' / '));
  FKEY='X';
}

/* ---- まとめ ---- */
const verdict = (bl1-mk1 > 0.02) || (bestBand.pct >= 100) || (best3.te-base3 > 0.02)
  || (best4 && best4.te-base3 > 0.02);
console.log('\n=== 結論 ===');
console.log(verdict
  ? '  市場に足せるものが出ています。買い方を設計する価値があります。'
  : '  どれも市場に足せていません。いまのデータでは、どんな買い方を作っても負けます。');
console.log('  （①が+0.02超、②が100%以上、③が+0.02超、のどれかで結論が変わります）');

if(SAVE){
  const o={ measuredAt:new Date().toISOString().slice(0,10), races:D.length, trainTo:cut,
    testRaces:te.length,
    blendB:Number(B1.b.toFixed(3)), blendGain:Number((bl1-mk1).toFixed(4)),
    retMarket10:ret1(te,1,0,10), retBlend10:ret1(te,B1.a,B1.b,10),
    bestBand:bestBand.lab, bestBandPct:bestBand.pct,
    learnGain:Number((best3.te-base3).toFixed(4)),
    windRaces:cov, windGain: best4?Number((best4.te-base3).toFixed(4)):null,
    edge:verdict };
  fs.writeFileSync(path.join(ROOT,'data','edge.js'),
    '/* node edge.js --save が書く。手で書かないこと。 */\nmodule.exports = '
    + JSON.stringify(o,null,2) + ';\n');
  console.log(`\n  data/edge.js に書きました。`);
}
