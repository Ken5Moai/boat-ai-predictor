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

const pick=rows.filter(r=>!r.outA);
console.log(`\n■ 「外にA級なし」のレース  ${pick.length}件`);
if(!pick.length){
  console.log('  今日はありません。この条件で狙えるレースはゼロです。');
}else{
  pick.sort((a,b)=>b.p1[1]-a.p1[1]);
  for(const r of pick)
    console.log(`  ${String(r.rno).padStart(2)}R ${r.close}  1号艇${(r.p1[1]*100).toFixed(0)}%  `+
                `上位3 ${r.top3.join(' ')}`);
  console.log('\n  ※ 配当は安い（実測の中央値¥790）。当たっても大きくはならない。');
  console.log('  ※ この条件はまだ採用していない。20レースそろってから判定する。');
}

const avoid=rows.filter(r=>r.outA);
console.log(`\n■ 「外にA級あり」のレース  ${avoid.length}件`);
console.log('  実測ではモデルの平均順位23.4番目。荒れるが、当てられていない。');
console.log('  配当は大きい（中央値¥3,110）が、狙って取れた実績はない。');
console.log(`  ${avoid.map(r=>r.rno+'R').join(' ')}`);

console.log('\n※ 当日は必ずアプリで採点し直すこと。');
console.log('  展示タイム・展示ST・チルト・オッズが入ると点は変わる。');
console.log('  ここでの採点は、どのレースを見に行くかを決めるためだけのもの。');
