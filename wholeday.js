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

/* 捕獲ぶんは tmp/ にしか無く、tmp/ は git に入れていない。
   このコンテナは使い終わると片付けられるので、そのままでは消える。
   1日ぶんは公式サイトを500回ほど見に行くので、消えると取り直しになる。
   非公開リポジトリ側（data/wholeday）に固めてあるぶんを、
   走り始めに静かに戻す。すでに tmp にある場は触らない。 */
{
  const CAP=require('./captures.js');
  const r=CAP.restoreQuiet(HD);
  if(r && r.wrote) console.log(`保存してあった ${r.wrote}場を戻しました（data/wholeday/${HD}.json.gz）`);
}

/* ---- 取ってくる（1場ずつ。すでにある場は飛ばす） -------------------- */
/* 取れなかった理由のうち、あとで取れば入るもの（一時的なもの）を見分ける。
   昼に走らせると夕方のレースはまだ終わっていないので「結果なし」になる。
   欠場（5艇）はあとで取っても5艇のままなので、一時的ではない。

   以前は「ファイルがあれば読むだけ」で、ここを取りに行かなかった。
   そのため 2026-10-28 の江戸川は R1〜5 しか入らず（昼に捕獲した）、
   桐生12R も落ちたまま、12レースそろった日から外れていた。
   取り直せるものだけを埋める。すでに取れている分はもう触らない。 */
/* 理由は「あとで取れば入るもの」と「何度取っても入らないもの」に分かれる。
   以前は不成立と中止と『まだ走っていない』を「結果なし/不成立」という
   1つの文字列にしていたため、見分けられなかった。
   その結果、2026-10-28 江戸川の中止7レースと桐生12Rの不成立が
   毎回取り直しの対象になり、永久に埋まらない穴として残っていた。
   理由を分けて書くようにしたので、ここで見分けられる。 */
const WHY_NOT_YET = '結果まだ（走っていない）';
/* '結果なし/不成立' は理由を分ける前に書いた古い文字列。
   そのままでは不成立・中止・まだ走っていない のどれか分からないので、
   1度だけ取り直して正しい理由に書き換える。
   取り直せば中止・不成立になり、以降は取り直しの対象から外れる。 */
const LEGACY = '結果なし/不成立';
/* 取り直せるかの判定は「知っている永久の理由かどうか」で決める。
   以前は取り直せる側を並べていたが（/取得|timeout|ENOTFOUND|ECONN/）、
   2026-10-30 の児島10Rは "Command failed: curl -sS --fail ..." で落ちていて、
   どれにも当たらず永久に取り直されない状態だった。
   知らない失敗を「永久」と決めつけるのは危ない。並びを逆にする。

   永久なのは、何度取っても同じになるものだけ。
     欠場   … 5艇のまま（6艇前提のモデルでは採点できない）
     不成立 … 着順も払戻も出ない
     中止   … レースが行われなかった
   それ以外は全部取り直す（通信の失敗も、まだ走っていないのも）。
   data/unscorable.js の PERMANENT と同じ並び。片方だけ直すとずれる。 */
const PERMANENT = why => /欠場|不成立|中止/.test(why);
/* LEGACY（'結果なし/不成立'）は「不成立」を含むので PERMANENT に当たってしまうが、
   これは理由を分ける前の古い文字列で、中身が不成立なのか中止なのか
   まだ走っていないのか分からない。1度取り直して分類し直す。 */
const RETRYABLE = why => why === LEGACY || !PERMANENT(why);

async function grab(jcd){
  const f=path.join(DIR,`${jcd}.json`);
  if(fs.existsSync(f)){
    const had=JSON.parse(fs.readFileSync(f,'utf8'));
    const retry=(had.skipped||[]).filter(x=>RETRYABLE(x.why)).map(x=>x.rno);
    if(!retry.length || CACHE_ONLY) return had;
    console.log(`  ${VN[jcd]||jcd}: 前に取れなかった ${retry.length}レース`
              + `（${retry.join(',')}R）を取り直します`);
    const keep=(had.skipped||[]).filter(x=>!RETRYABLE(x.why));
    for(const rno of retry){
      try{
        const r=await F.fetchRace(jcd, rno, HD);
        if(!r.result || r.result.void || r.result.result==null){
          keep.push({rno, why: r.result && r.result.void
            ? `${r.result.voidReason||'不成立'}（レースが行われなかった）` : WHY_NOT_YET});
          continue; }
        if(Object.keys(r.odds).length!==120){ keep.push({rno,why:`オッズ${Object.keys(r.odds).length}通り（欠場）`}); continue; }
        had.races.push(r);
      }catch(e){ keep.push({rno,why:String(e.message).slice(0,60)}); }
    }
    had.races.sort((a,b)=>a.rno-b.rno);
    had.skipped=keep;
    fs.writeFileSync(f,JSON.stringify(had));
    console.log(`  ${VN[jcd]||jcd}: ${had.races.length}レースになりました`
              + (keep.length?`（まだ取れないのは ${keep.map(x=>x.rno+'R:'+x.why).join(' / ')}）`:''));
    return had;
  }
  if(CACHE_ONLY) return null;
  const races=[], skipped=[];
  for(let rno=1; rno<=12; rno++){
    try{
      const r=await F.fetchRace(jcd, rno, HD);
      /* 結果が出ていない・不成立・欠場（オッズが120通りでない）は数に入れない。
         入れると「買えなかったレース」を買ったことにしてしまう。 */
      if(!r.result || r.result.void || r.result.result==null){
        skipped.push({rno, why: r.result && r.result.void
          ? `${r.result.voidReason||'不成立'}（レースが行われなかった）` : WHY_NOT_YET});
        continue; }
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
  B:r.boats.map(b=>({reg:b.reg,g:b.g,nat:b.nat,loc:b.loc,
    motNo:b.motNo,mot:b.mot,btNo:b.btNo,bt:b.bt,st:b.st,F:b.F,
    exST:b.exST,exF:b.exF,exT:b.exT,tilt:b.tilt,wt:b.wt,adj:b.adj,parts:b.parts,
    entry:b.entry,rec:b.rec}))
});

const pct=(b,i)=>i?Math.round(b/i*100):0;
const yen=v=>`${v>=0?'+':'-'}¥${Math.abs(v).toLocaleString()}`;

/* その日に開催していた場だけを公式の一覧から取る。
   ここは以前 24場を総当たりしていた。開催の無い場はファイルを作らない作りなので
   （--cache-only で「0本の場」として残るのを避けるため）、
   走らせ直すたびに、開催していない13場ぶん・1場12レース・1レース4ページ＝
   150回以上を毎回取りに行っていた。2026-10-28 の取り直しで34分かかり、
   止めるまで気づかなかった。公式には開催場の一覧が1ページで出ているので、
   そこを1回だけ見る。
   一覧が読めなければ、これまでどおり総当たりに戻す（取りこぼさないため）。 */
async function racingVenues(){
  const all=Object.keys(VN).sort();
  if(CACHE_ONLY){
    /* 取りに行かない指定のときは、すでにあるファイルだけを見る。 */
    return fs.existsSync(DIR)
      ? fs.readdirSync(DIR).filter(x=>/^\d\d\.json$/.test(x)).map(x=>x.slice(0,2)).sort()
      : [];
  }
  try{
    const html=await F.getPage(`https://www.boatrace.jp/owpc/pc/race/index?hd=${HD}`);
    const found=[...new Set((html.match(/jcd=(\d\d)/g)||[]).map(x=>x.slice(4)))]
                  .filter(j=>all.includes(j)).sort();
    if(!found.length) throw new Error('開催場が読み取れない');
    console.log(`${HD} の開催は ${found.length}場（${found.map(j=>VN[j]).join('・')}）`);
    return found;
  }catch(e){
    console.log(`開催場の一覧が読めませんでした（${e.message}）。24場すべてを見ます。`);
    return all;
  }
}

(async()=>{
  const packs=[];
  const JCDS = await racingVenues();
  for(const jcd of JCDS){
    const p=await grab(jcd);
    if(p && p.races.length){ packs.push(p); process.stderr.write(`${VN[jcd]} ${p.races.length}本\n`); }
  }
  if(!packs.length){ console.log('この日のデータがありません。'); return; }
  /* 取れたぶんをすぐ固める。採点の途中で落ちても、捕獲は残る。
     （採点は何度でもやり直せるが、捕獲のやり直しは公式サイトに負荷をかける） */
  if(!CACHE_ONLY){
    try{
      const r=require('./captures.js').save(HD);
      if(r) console.log(`data/wholeday/${HD}.json.gz に残しました`
                      + `（${r.venues}場 ${r.races}レース / ${(r.bytes/1024).toFixed(0)}KB）。`
                      + `非公開リポジトリ側でコミットしてください。`);
    }catch(e){ console.log(`※ 捕獲ぶんを残せませんでした（${e.message}）。tmp/ にはあります。`); }
  }

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
