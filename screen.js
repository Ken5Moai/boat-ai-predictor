/* 1日の出走予定表から、その日のどのレースを狙うかを選ぶ道具。
   ------------------------------------------------------------------
   使い方:  node screen.js
   card.js に PDF から読み取った1日ぶんを入れておく。

   前提（ここを誤解すると無意味になる）
     ・PDFに当地勝率は無い（当地2連率だけ）。モデルが使うのは当地勝率なので未取得扱い
     ・展示タイム・展示ST・チルトは当日にならないと出ない
     ・オッズも無いので、市場との比較も期待値も出せない
   つまりここでの採点は「前夜に分かるぶんだけ」の採点。
   当日のレポートとは点が変わる。選ぶためだけに使う。

   選び方の根拠（28レースの実測）
     外にA級あり 21件  配当の中央値¥3,110  モデルの平均順位 23.4番目
     外にA級なし  7件  配当の中央値¥  790  モデルの平均順位  2.9番目
   荒れそうなレースほど、モデルは正解から遠い。
   だから狙うのは「荒れなさそうなレース」のほう。
   ただし n=7。まだ採用条件を満たしていない（20レースで判定する）。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const CARD=require('./card.js');
const HTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');

const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');

function scoreRace(R){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  R.B.forEach((x,i)=>{ d.getElementById('reg'+(i+1)).value=x.reg; });
  w.syncRegsFromInputs();
  R.B.forEach((x,i)=>{
    const b=w.boatOf(i+1);
    setField(b,'name','選手'+(i+1),'official');
    setField(b,'grade',x.g,'official');
    if(x.nat!=null) setField(b,'nationalWinRate',x.nat,'official');
    if(x.mot!=null) setField(b,'motor2Rate',x.mot,'official');
    if(x.bt!=null)  setField(b,'boat2Rate',x.bt,'official');
    if(x.st!=null)  setField(b,'averageST',x.st,'official');
    b.flagF=x.F||0; b.flagL=0;
  });
  d.getElementById('venue').value=CARD.jcd;
  d.getElementById('raceDate').value=CARD.date;
  d.getElementById('raceNo').value=String(R.rno);
  const ctx=w.scoreAll();
  const combos=w.buildProbabilities(ctx);
  const sorted=[...state.boats].sort((a,b)=>b.score-a.score);
  const p1={}; for(let a=1;a<=6;a++)
    p1[a]=combos.filter(c=>c.combo[0]===String(a)).reduce((t,c)=>t+c.p,0);
  return {
    order: sorted.map(b=>`${b.lane}(${b.score.toFixed(1)})`),
    head: sorted[0].lane,
    gap: sorted[0].score - sorted[1].score,
    p1, top3: combos.slice(0,3).map(c=>c.combo),
    top6: combos.slice(0,6).map(c=>String(c.combo)),
    topP: combos[0].p
  };
}

const outA = R => R.B.slice(2).some(b=>b.g==='A1'||b.g==='A2');

console.log(`\n${CARD.venue} ${CARD.date}  全${CARD.races.length}レース`);
console.log('（出走予定表だけで採点。展示・オッズ・当地勝率は入っていない）\n');
console.log('  R   締切   種別        外にA級  1号艇  頭  差   モデルの上位3');
const rows=[];
for(const R of CARD.races){
  const s=scoreRace(R);
  const o=outA(R);
  rows.push({rno:R.rno, close:R.close, type:R.type, outA:o, ...s});
  console.log(`  ${String(R.rno).padStart(2)}R  ${R.close}  ${R.type.padEnd(8)}`+
    `${o?'あり':'なし'}    ${(s.p1[1]*100).toFixed(0).padStart(3)}%  ${s.head}  `+
    `${s.gap.toFixed(1).padStart(4)}  ${s.top3.join(' ')}`);
}

/* 前夜に書いた買い目が、モデルの出力と本当に一致しているか毎回照合する。
   ------------------------------------------------------------------
   2026-09-25、三国1R・2Rの買い目を screened.js に手で書き写すときに間違えた。
   1Rは6点のうち3点が違っていて、しかも正解の 3-1-2（¥8,940）が
   モデルの5番目に入っていたのに、手書きのリストからは抜け落ちていた。
   つまり「モデルは当てていたが、私が渡したリストでは外れ」という状態。
   原因は手で書き写す工程そのものなので、ここで機械に照合させる。
   ズレていたら止める（黙って通すと、どちらが本当の成績か分からなくなる）。

   node screen.js --emit  で貼り付け用の pending ブロックを出す。
   以後、買い目は手で書かない。 */
{
  const SC=require('./screened.js');
  const pend=(SC.pending||[]).filter(e=>e.date===CARD.date);
  let bad=0;
  for(const e of pend){
    if(e.rno==null){ console.log(`\n!! ${e.name} に rno が無い。照合できない`); bad++; continue; }
    const r=rows.find(x=>x.rno===e.rno);
    if(!r){ console.log(`\n!! ${e.name} は card.js に無い`); bad++; continue; }
    const a=(e.picks||[]).join(' '), b=r.top6.join(' ');
    if(a!==b){
      console.log(`\n!! ${e.name} の買い目がモデルの出力と違う`);
      console.log(`     書いてある : ${a}`);
      console.log(`     モデル     : ${b}`);
      bad++;
    }
  }
  if(bad){
    console.log('\n   買い目を手で直さず、node screen.js --emit の出力をそのまま貼ること。');
    process.exit(1);
  }
  if(pend.length) console.log(`\n（結果待ち${pend.length}件の買い目はモデルの出力と一致している）`);
}

if(process.argv.includes('--emit')){
  console.log('\n── screened.js の pending に貼る ──');
  for(const r of rows.filter(x=>!x.outA)){
    const R=CARD.races.find(x=>x.rno===r.rno);
    console.log(` {name:'${CARD.venue}${r.rno}R ${R.type}', date:'${CARD.date}', rno:${r.rno}, close:'${r.close}',`);
    console.log(`  picks:[${r.top6.map(c=>`'${c}'`).join(',')}], p1:${r.p1[1].toFixed(2)},`);
    console.log(`  note:''},`);
  }
  console.log('──────────────────────────────');
}

const pick=rows.filter(r=>!r.outA);
console.log(`\n■ 「外にA級なし」のレース  ${pick.length}件`);
if(!pick.length){
  console.log('  今日はありません。この条件で狙えるレースはゼロです。');
}else{
  pick.sort((a,b)=>b.p1[1]-a.p1[1]);
  for(const r of pick)
    console.log(`  ${String(r.rno).padStart(2)}R ${r.close}  1号艇${(r.p1[1]*100).toFixed(0)}%  `+
                `上位3 ${r.top3.join(' ')}`);
  /* 配当の実測。最初の28レースの集計では中央値¥790で「安い」と書いていたが、
     2026-09-25の三国で1R ¥8,940・2R ¥6,270 が出て前提が崩れた。
     ここは書き換わる値なので、そのつど screened.js から数え直して出す。 */
  const P=require('./screened.js').map(r=>r.pay).sort((a,b)=>a-b);
  const med=P.length%2 ? P[(P.length-1)/2] : (P[P.length/2-1]+P[P.length/2])/2;
  console.log(`\n  ※ このグループの配当 実測${P.length}件  中央値¥${med.toLocaleString()}  `+
              `最高¥${P[P.length-1].toLocaleString()}  最低¥${P[0].toLocaleString()}`);
  console.log('  ※ 当初は「安い（中央値¥790）」と書いていたが、¥8,940が出て前提が崩れた。');
  console.log('  ※ この条件はまだ採用していない。20レースそろってから判定する。');
}

const avoid=rows.filter(r=>r.outA);
console.log(`\n■ 「外にA級あり」のレース  ${avoid.length}件`);
console.log('  最初の28レースの実測ではモデルの平均順位23.4番目。荒れるが、当てられていない。');
console.log('  配当は大きい（中央値¥3,110）が、狙って取れた実績はない。');
console.log(`  ${avoid.map(r=>r.rno+'R').join(' ')}`);

/* 避けたほうも数える。
   ------------------------------------------------------------------
   「外にA級あり」を避ける理由は「そちらのほうが当たらない」。
   なら避けたほうの成績も出さないと、避ける理由が検証できない。
   カードがある日は12レース全部をどちらかに入れる決まりにして、
   ここで取りこぼしを検出する（一部だけ拾うと選り好みになる）。 */
{
  const SC=require('./screened.js');
  const AV=SC.avoided||[];
  const day=rows.map(r=>r.rno);
  const inPicked=new Set(SC.filter(e=>e.date===CARD.date).map(e=>e.rno));
  const inAvoid =new Set(AV.filter(e=>e.date===CARD.date).map(e=>e.rno));
  const pend    =new Set((SC.pending||[]).filter(e=>e.date===CARD.date).map(e=>e.rno));
  let bad=0;
  for(const rno of day){
    const r=rows.find(x=>x.rno===rno);
    if(inPicked.has(rno)&&inAvoid.has(rno)){ console.log(`\n!! ${rno}R が両方に入っている`); bad++; }
    if(inPicked.has(rno)&&r.outA){ console.log(`\n!! ${rno}R は外にA級ありなのに picked 側にある`); bad++; }
    if(inAvoid.has(rno)&&!r.outA){ console.log(`\n!! ${rno}R は外にA級なしなのに avoided 側にある`); bad++; }
  }
  if(bad){ console.log('\n   振り分けが card.js と合っていない。直すまで数えない。'); process.exit(1); }

  const rest=day.filter(rno=>!inPicked.has(rno)&&!inAvoid.has(rno)&&!pend.has(rno));
  if(rest.length)
    console.log(`\n  （${CARD.date} でまだ結果を入れていないレース: ${rest.map(r=>r+'R').join(' ')}）`);

  if(AV.length){
    const inv=AV.length*600;
    const ret=AV.reduce((t,r)=>t+(r.rank<=6?r.pay:0),0);
    const hit=AV.filter(r=>r.rank<=6).length;
    const avgRank=AV.reduce((t,r)=>t+r.rank,0)/AV.length;
    const P=[...AV].sort((a,b)=>a.pay-b.pay);
    const med=P.length%2?P[(P.length-1)/2].pay:(P[P.length/2-1].pay+P[P.length/2].pay)/2;
    console.log(`\n  避けたほうを6点で買っていたら（実測${AV.length}件・出走予定表だけの採点）`);
    console.log(`    的中${hit}/${AV.length}  投資¥${inv.toLocaleString()} 払戻¥${ret.toLocaleString()}  `+
                `回収率 ${(ret/inv*100).toFixed(0)}%`);
    console.log(`    モデルの平均順位 ${avgRank.toFixed(1)}番目  配当の中央値¥${med.toLocaleString()}  `+
                `最高¥${P[P.length-1].pay.toLocaleString()}`);
    const big=AV.filter(r=>r.pay>=5000);
    if(big.length){
      console.log(`    うち¥5,000超 ${big.length}件のモデルの順位: `+
                  big.map(r=>`${r.name.replace(/^.{2}/,'')} ${r.rank}番目(¥${r.pay.toLocaleString()})`).join(' / '));
      console.log('    高い配当ほど順位が遠い。ここが「穴は当てられない」の中身。');
    }
    console.log(`    ※ ${AV.length}件しかない。避ける判断の根拠にはまだ足りない。`);
  }
}

/* ここまでの成績。採用するかどうかはここで決まる。 */
{
  const SC = require('./screened.js');
  const calc = a => {
    const inv = a.length*600;
    const ret = a.reduce((s,r)=>s+(r.rank<=6?r.pay:0), 0);
    const hit = a.filter(r=>r.rank<=6).length;
    const dd  = a.map(r=>({ n:r.name, v:(r.rank<=6?r.pay:0)-600 }));
    const top2 = [...dd].sort((x,y)=>y.v-x.v).slice(0,2).reduce((s,x)=>s+x.v,0);
    const restInv = (a.length-2)*600;
    const restRet = restInv + (dd.reduce((s,x)=>s+x.v,0) - top2);
    let win=0; const N=20000;
    for(let i=0;i<N;i++){ let t=0;
      for(let j=0;j<dd.length;j++) t += dd[Math.floor(Math.random()*dd.length)].v;
      if(t>0) win++; }
    return { n:a.length, hit, inv, ret, rate:ret/inv*100,
             rest: restInv>0 ? restRet/restInv*100 : null, boot:win/N*100 };
  };
  const all = calc(SC);
  const full = calc(SC.filter(r=>r.info==='full'));
  console.log('\n══════════ 「外にA級なし」の成績 ══════════');
  console.log(`  全${all.n}レース  的中${all.hit}/${all.n}  `+
              `投資¥${all.inv.toLocaleString()} 払戻¥${all.ret.toLocaleString()}  `+
              `回収率 ${all.rate.toFixed(0)}%`);
  console.log(`    いちばん効いた2レースを除くと ${all.rest!=null?all.rest.toFixed(0)+'%':'—'}`);
  console.log(`    引き直してプラスになる割合   ${all.boot.toFixed(0)}%`);
  const nCard = SC.filter(r=>r.info==='card').length;
  if(nCard){
    console.log(`\n  うち${nCard}レースは出走予定表だけで採点（展示が入っていない）。`);
    console.log(`  直前情報まで入れた${full.n}レースだけなら  回収率 ${full.rate.toFixed(0)}%  `+
                `除くと ${full.rest!=null?full.rest.toFixed(0)+'%':'—'}  引き直し ${full.boot.toFixed(0)}%`);
    console.log('  採点に使った情報が違うので、本来は混ぜられない。両方見ること。');
  }

  /* 先に決めた判定。ここは結果を見てから変えない。 */
  console.log('\n  【判定】20レースで次の3つをすべて満たせば採用、1つでも欠ければ捨てる');
  /* 判定と表示の桁を揃える。0桁だと「100なのに×」が起きて読めない。 */
  const ok = (label, v, need) =>
    console.log(`    ${v!=null && v>=need ? '○' : '×'} ${label}  `+
                `いま ${v!=null?v.toFixed(1):'—'}（必要 ${need}）`);
  ok('回収率100%以上          ', all.rate, 100);
  ok('上位2件を除いても100%以上', all.rest, 100);
  ok('引き直し95%以上         ', all.boot, 95);
  const left = Math.max(0, 20 - all.n);
  console.log(left ? `    → あと${left}レース` : '    → 20レースに到達。上の3つで判定する');
}

console.log('\n※ 当日は必ずアプリで採点し直すこと。');
console.log('  展示タイム・展示ST・チルト・オッズが入ると点は変わる。');
console.log('  ここでの採点は、どのレースを見に行くかを決めるためだけのもの。');
