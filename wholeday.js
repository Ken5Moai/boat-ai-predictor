/* 1日の全開催を、いまのモデルでまとめて採点する
   ==================================================================
   使い方
     node wholeday.js 20261026              その日の全場・全レースを取って採点
     node wholeday.js 20261026 --cache-only すでに取ってあるぶんだけで採点（取りに行かない）

   なぜ要るのか。
   これまで記録してきたレースは「買ったレース」「見てもらったレース」の
   寄せ集めで、選り好みが入っている。backtest.js の 96レースで
   本線10点 107% と出ているが、それは選んだ結果かもしれない。
   1日ぜんぶ（12場×12R）を、選ばずに採点すれば、そこが分かる。

   2026-10-26 で最初に走らせた結果は 142レースで本線10点 72% だった。
   96レースの 107% とは 35pt 違う。1日ぶんなので「その日が悪かった」のか
   「107%が選り好みだった」のかはこれだけでは決まらない。
   何日かためてから言うこと。

   取ってきたデータは tmp/wholeday/<日付>/ に置く。backtest.js の RACES には
   入れない（142本を一度に足すと、画面の数字も判定の母数も全部動くため）。
   入れるかどうかは人が決める。 */
const fs=require('fs'), path=require('path');
const {JSDOM}=require('jsdom');
const F=require('./fetch.js');
const BT=require('./backtest.js');

const HTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
/* 場コード→場名も、開催場の一覧も index.html の VENUES から読む（二重に持たない） */
const VN={}; { const re=/'(\d{2})':\{name:'([^']+)'/g; let m; while((m=re.exec(HTML))) VN[m[1]]=m[2]; }
const ALL_JCD=Object.keys(VN).sort();

const HD=process.argv[2];
if(!/^\d{8}$/.test(HD||'')){
  console.log('使い方: node wholeday.js YYYYMMDD [--cache-only]');
  process.exit(1);
}
const CACHE_ONLY=process.argv.includes('--cache-only');
const DIR=path.join(__dirname,'tmp','wholeday',HD);
fs.mkdirSync(DIR,{recursive:true});

/* ---- 取ってくる（1場ずつ。すでにある場は飛ばす） -------------------- */
async function grab(jcd){
  const f=path.join(DIR,`${jcd}.json`);
  if(fs.existsSync(f)) return JSON.parse(fs.readFileSync(f,'utf8'));
  if(CACHE_ONLY) return null;
  const races=[], skipped=[];
  for(let rno=1; rno<=12; rno++){
    try{
      const r=await F.fetchRace(jcd, rno, HD);
      /* 結果が出ていない・不成立・欠場（オッズが120通りでない）は数に入れない。
         入れると「買えなかったレース」を買ったことにしてしまう。 */
      if(!r.result || r.result.void || r.result.result==null){ skipped.push({rno,why:'結果なし/不成立'}); continue; }
      if(Object.keys(r.odds).length!==120){ skipped.push({rno,why:`オッズ${Object.keys(r.odds).length}通り（欠場）`}); continue; }
      races.push(r);
    }catch(e){ skipped.push({rno,why:String(e.message).slice(0,60)}); }
  }
  /* 1レースも取れなかった場は、その日に開催が無かったとみなしてファイルを作らない。
     ファイルを作ると、次に --cache-only で走らせたとき「0本の場」として残る。 */
  if(!races.length) return {jcd,hd:HD,races:[],skipped};
  const out={jcd,hd:HD,races,skipped};
  fs.writeFileSync(f,JSON.stringify(out));
  return out;
}

/* ---- 採点して並べる ------------------------------------------------ */
const toRace=r=>({
  name:`全${r.jcd}_${r.rno}R_${r.hd}`, jcd:r.jcd, rno:r.rno,
  date:`${r.hd.slice(0,4)}-${r.hd.slice(4,6)}-${r.hd.slice(6,8)}`,
  result:r.result.result, pop:r.result.pop, pay:r.result.pay,
  wind:null, ws:r.result.ws, wave:r.result.wave, temp:r.result.temp, wtemp:r.result.wtemp,
  B:r.boats.map(b=>({reg:b.reg,g:b.g,nat:b.nat,loc:b.loc,mot:b.mot,bt:b.bt,st:b.st,F:b.F,
    exST:b.exST,exF:b.exF,exT:b.exT,tilt:b.tilt,wt:b.wt,adj:b.adj,parts:b.parts,
    entry:b.entry,rec:b.rec}))
});

const pct=(b,i)=>i?Math.round(b/i*100):0;
const yen=v=>`${v>=0?'+':'-'}¥${Math.abs(v).toLocaleString()}`;

(async()=>{
  const packs=[];
  for(const jcd of ALL_JCD){
    const p=await grab(jcd);
    if(p && p.races.length){ packs.push(p); process.stderr.write(`${VN[jcd]} ${p.races.length}本\n`); }
  }
  if(!packs.length){ console.log('この日のデータがありません。'); return; }

  const all=[], oddsOf={};
  for(const p of packs) for(const r of p.races){ const R=toRace(r); all.push(R); oddsOf[R.name]=r.odds; }

  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
    beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  dom.window.Element.prototype.scrollIntoView=function(){};
  const buyPlan=dom.window.eval('buyPlan');

  const scored=BT.runWith({},null,{races:all});
  const by=new Map();
  all.forEach((R,i)=>{
    const x=scored[i];
    const pl=buyPlan(Object.entries(x.probOf).map(([combo,p])=>({combo,p})),{main:10,ana:8});
    const res=String(R.result), o=oddsOf[R.name]||{};
    const row={rno:R.rno,res,pay:R.pay,pop:R.pop,rank:x.rank,
      cheap:pl.main.filter(c=>o[c]!=null&&o[c]<10).length,
      hitB:res===pl.best, hitM:pl.main.includes(res), hitA:pl.ana.includes(res),
      nM:pl.main.length, nA:pl.ana.length};
    if(!by.has(R.jcd)) by.set(R.jcd,[]);
    by.get(R.jcd).push(row);
  });

  const tally=rows=>{
    const g=(sel,nOf)=>{
      const inv=rows.reduce((a,c)=>a+nOf(c)*100,0);
      const pays=rows.filter(sel).map(r=>r.pay);
      return {inv, back:pays.reduce((a,c)=>a+c,0), hit:pays.length,
              top:pays.length?Math.max(...pays):0};
    };
    return {n:rows.length, B:g(r=>r.hitB,()=>1), M:g(r=>r.hitM,r=>r.nM),
            A:g(r=>r.hitA,r=>r.nA), ALL:g(r=>r.hitM||r.hitA,r=>r.nM+r.nA),
            lane1:rows.filter(r=>r.res.startsWith('1')).length,
            avgRank:rows.reduce((a,c)=>a+c.rank,0)/rows.length};
  };

  const list=[...by].map(([jcd,rows])=>({jcd,rows,t:tally(rows)}))
                    .sort((a,b)=>(b.t.M.back-b.t.M.inv)-(a.t.M.back-a.t.M.inv));

  const d=`${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)}`;
  console.log(`\n=== ${d} の全開催 ${all.length}レースを、いまのモデルで採点したら ===`);
  console.log('  1点100円。本線10点の収支が良い順。選り好みなし。\n');
  console.log('  順  場      R   本線10点                      18点                     至極    1号艇1着  平均順位');
  const row=(label,t)=>console.log(`  ${label}${String(t.n).padStart(3)}  `+
    `${yen(t.M.back-t.M.inv).padStart(9)} ${String(pct(t.M.back,t.M.inv)).padStart(4)}% ${String(t.M.hit+'/'+t.n).padStart(6)}  `+
    `${yen(t.ALL.back-t.ALL.inv).padStart(9)} ${String(pct(t.ALL.back,t.ALL.inv)).padStart(4)}% ${String(t.ALL.hit+'/'+t.n).padStart(6)}  `+
    `${String(t.B.hit+'/'+t.n).padStart(6)}  ${String(t.lane1+'/'+t.n).padStart(6)}  ${t.avgRank.toFixed(1).padStart(6)}`);
  list.forEach((v,i)=>row(`${String(i+1).padStart(2)}  ${(VN[v.jcd]||v.jcd).padEnd(5)}`, v.t));
  console.log('  '+'-'.repeat(100));
  const G=tally(list.flatMap(v=>v.rows));
  row('    合計  ', G);

  console.log('\n=== 大きい払戻を外すと、回収率はどうなるか ===');
  const rows=list.flatMap(v=>v.rows);
  const dist=(label,sel,nOf)=>{
    const inv=rows.reduce((a,c)=>a+nOf(c)*100,0);
    const pays=rows.filter(sel).map(r=>r.pay).sort((a,b)=>b-a);
    const back=pays.reduce((a,c)=>a+c,0);
    const k=n=>`${String(pct(back-pays.slice(0,n).reduce((a,c)=>a+c,0),inv)).padStart(4)}%`;
    console.log(`  ${label.padEnd(10)} 的中${String(pays.length).padStart(3)}/${rows.length}  `+
      `そのまま${k(0)}  最大1件除く${k(1)}  上位2件除く${k(2)}  上位3件除く${k(3)}`+
      `   最大の払戻 ¥${(pays[0]||0).toLocaleString()}`);
  };
  dist('至極1点', r=>r.hitB, ()=>1);
  dist('本線10点', r=>r.hitM, r=>r.nM);
  dist('波乱8点', r=>r.hitA, r=>r.nA);
  dist('18点', r=>r.hitM||r.hitA, r=>r.nM+r.nA);
  console.log('  ※ 上位を外して100%を割るなら、その回収率は「その1件が出たから」の数字。');

  console.log('\n=== 警告（本線10点のうち10倍未満が2点以上）で分けたら ===');
  for(const [lab,arr] of [['警告あり',rows.filter(r=>r.cheap>=2)],['警告なし',rows.filter(r=>r.cheap<2)]]){
    if(!arr.length){ console.log(`  ${lab} 0レース`); continue; }
    const inv=arr.reduce((a,c)=>a+c.nM*100,0);
    const pays=arr.filter(r=>r.hitM).map(r=>r.pay).sort((a,b)=>b-a);
    const back=pays.reduce((a,c)=>a+c,0);
    console.log(`  ${lab.padEnd(8)} ${String(arr.length).padStart(3)}レース  本線10点 ${yen(back-inv).padStart(9)}  `+
      `回収率${String(pct(back,inv)).padStart(4)}%  最大1件除くと${String(pct(back-(pays[0]||0),inv)).padStart(4)}%  的中${pays.length}/${arr.length}`);
  }

  console.log('\n=== 場ごとの中身 ===');
  for(const v of list){
    const t=v.t;
    console.log(`\n  ${VN[v.jcd]||v.jcd}（本線10点 ${pct(t.M.back,t.M.inv)}%・${yen(t.M.back-t.M.inv)}）`);
    console.log('      R   正解      払戻  人気  モデル順位  至極  本線  波乱  10倍未満');
    for(const r of [...v.rows].sort((a,b)=>a.rno-b.rno))
      console.log(`      ${String(r.rno).padStart(2)}  ${r.res.padEnd(8)}¥${String(r.pay).padStart(6)}  `+
        `${String(r.pop??'—').padStart(3)}  ${String(r.rank).padStart(8)}番目  `+
        `${r.hitB?'○ ':'× '}  ${r.hitM?'○ ':'× '}  ${r.hitA?'○':'×'}  ${String(r.cheap).padStart(5)}`+
        `${r.cheap>=2?' ←警告':''}`);
  }
  const skipped=packs.flatMap(p=>p.skipped.map(s=>`${VN[p.jcd]}${s.rno}R（${s.why}）`));
  if(skipped.length) console.log(`\n  数に入れなかったレース ${skipped.length}本: ${skipped.join(' / ')}`);
  console.log('\n  ※ ここの数字は backtest.js の RACES には入っていない。');
  console.log('     入れるかどうかは人が決めること（142本足すと判定の母数が全部動く）。');
})();
