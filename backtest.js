// 実際に走ったレースで採点の当たり具合を測る道具。
// 重みやバンドを思いつきで変えないための検証環境。
//   使い方: node backtest.js        （index.html と同じ場所で実行）
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const HTML_PATH=path.join(__dirname,'index.html');
const HTML=fs.readFileSync(HTML_PATH,'utf8');

// ---- 実際に走ったレース（結果つき） ----
// rec は [進入コース, ST, 着順] の並び。新しい順ではなく出走表の並び（古い→新しい）。
const RACES=[
{name:'桐生8R 女子',jcd:'01',rno:1,date:'2026-09-23',result:'1-5-4',pop:null,wind:'向かい風',ws:2,wave:1,
 B:[
 {reg:'4373',g:'A1',nat:6.14,loc:7.40,mot:38.31,bt:37.84,st:0.17,F:1,exST:0.22,exF:null,exT:6.74,tilt:-0.5,wt:46.5,rec:[[2,.18,4],[6,.26,3],[3,.24,3],[1,.24,1],[5,.23,4]]},
 {reg:'4720',g:'B1',nat:3.33,loc:5.70,mot:29.89,bt:37.70,st:0.20,F:1,exST:0.15,exF:null,exT:6.74,tilt:0.0,wt:47.8,rec:[[6,.23,6],[3,.08,4],[5,.26,6],[4,.17,3],[1,.23,6]]},
 {reg:'4443',g:'B1',nat:5.51,loc:null,mot:49.04,bt:40.86,st:0.19,F:0,exST:0.13,exF:null,exT:6.82,tilt:0.0,wt:50.2,rec:[[2,.19,1],[3,.27,5],[1,.14,2],[4,.15,3],[6,.20,5]]},
 {reg:'5213',g:'B1',nat:5.24,loc:5.09,mot:37.58,bt:37.31,st:0.20,F:0,exST:0.03,exF:'F',exT:6.69,tilt:-0.5,wt:46.5,rec:[[4,.11,'失'],[3,.15,2],[2,.25,1],[5,.30,2],[1,.22,2]]},
 {reg:'5195',g:'A2',nat:5.28,loc:4.22,mot:34.31,bt:31.28,st:0.15,F:1,exST:0.02,exF:'F',exT:6.87,tilt:0.0,wt:48.0,rec:[[4,.18,5],[6,.08,3],[3,.04,1],[1,.18,1],[2,.17,1]]},
 {reg:'5437',g:'B2',nat:1.61,loc:null,mot:29.65,bt:28.65,st:0.23,F:1,exST:0.05,exF:null,exT:6.71,tilt:-0.5,wt:51.4,rec:[[6,.17,5],[6,.19,6],[6,.23,5],[6,.21,'失']]}]},
{name:'桐生9R 男子',jcd:'01',rno:9,date:'2026-09-23',result:'1-3-2',pop:null,wind:'向かい風',ws:1,wave:1,
 B:[
 {reg:'4311',g:'A1',nat:6.34,loc:6.81,mot:34.41,bt:39.01,st:0.15,F:1,exST:0.02,exF:null,exT:6.80,tilt:-0.5,wt:54.2,rec:[[1,.22,1],[5,.28,4],[4,.18,5],[3,.18,5],[6,.19,4]]},
 {reg:'4228',g:'A2',nat:6.50,loc:5.75,mot:27.89,bt:32.80,st:0.17,F:1,exST:0.02,exF:'F',exT:6.84,tilt:-0.5,wt:54.3,rec:[[2,.21,6],[5,.17,5],[6,.22,6],[3,.12,3],[1,.20,2]]},
 {reg:'5179',g:'B1',nat:4.55,loc:2.63,mot:35.79,bt:30.05,st:0.20,F:0,exST:0.02,exF:'F',exT:6.81,tilt:0.0,wt:52.5,rec:[[5,.21,4],[6,.09,6],[2,.23,5],[4,.13,4],[1,.10,5]]},
 {reg:'4351',g:'A1',nat:6.94,loc:7.18,mot:27.84,bt:31.09,st:0.13,F:1,exST:0.07,exF:'F',exT:6.83,tilt:-0.5,wt:52.0,rec:[[6,.08,3],[3,.16,4],[2,.12,1],[1,.18,3],[2,.17,1]]},
 {reg:'5427',g:'B1',nat:3.04,loc:2.35,mot:36.79,bt:34.36,st:0.22,F:0,exST:0.05,exF:'F',exT:6.74,tilt:-0.5,wt:52.0,rec:[[6,.15,4],[5,.21,5],[4,.14,3],[5,.18,3],[6,.03,6]]},
 {reg:'3538',g:'B2',nat:3.92,loc:5.48,mot:41.54,bt:34.55,st:0.21,F:0,exST:0.11,exF:null,exT:6.94,tilt:-0.5,wt:52.0,rec:[[1,.18,5],[4,.07,5],[2,.21,5],[5,.14,5],[3,.15,5]]}]},
{name:'桐生12R 特選',jcd:'01',rno:12,date:'2026-09-23',result:'1-5-4',pop:33,wind:'向かい風',ws:2,wave:1,
 B:[
 {reg:'4627',g:'A2',nat:6.29,loc:5.27,mot:28.18,bt:34.02,st:0.15,F:0,exST:0.02,exF:null,exT:6.77,tilt:-0.5,wt:47.1,rec:[[3,.12,5],[1,.15,1],[5,.11,1],[2,.19,1],[6,.19,5],[3,.21,'失']]},
 {reg:'4478',g:'A1',nat:5.94,loc:6.04,mot:30.93,bt:40.44,st:0.16,F:0,exST:0.06,exF:null,exT:6.71,tilt:-0.5,wt:47.2,rec:[[5,.15,2],[1,.13,1],[2,.13,3],[6,.12,5],[3,.17,1],[1,.13,3]]},
 {reg:'5265',g:'B1',nat:3.82,loc:2.88,mot:31.55,bt:38.54,st:0.15,F:0,exST:0.24,exF:null,exT:6.78,tilt:0.0,wt:45.0,rec:[[5,.12,4],[4,.11,3],[2,.08,3],[1,.21,1],[6,.13,2]]},
 {reg:'4373',g:'A1',nat:6.14,loc:7.40,mot:38.31,bt:37.84,st:0.17,F:1,exST:0.03,exF:null,exT:6.59,tilt:-0.5,wt:46.5,rec:[[2,.18,4],[6,.26,3],[3,.24,3],[1,.24,1],[5,.23,4],[1,.13,1]]},
 {reg:'5335',g:'B1',nat:3.10,loc:2.78,mot:37.31,bt:38.59,st:0.18,F:0,exST:0.01,exF:'F',exT:6.67,tilt:-0.5,wt:47.0,rec:[[5,.05,1],[1,.23,2],[4,.18,5],[2,.19,6],[6,.05,5]]},
 {reg:'4642',g:'A2',nat:6.98,loc:5.40,mot:33.49,bt:33.88,st:0.16,F:0,exST:0.01,exF:null,exT:6.71,tilt:-0.5,wt:46.5,rec:[[1,.22,3],[4,.11,2],[6,.23,5],[5,.21,3],[3,.17,1],[2,.17,1]]}]},
// 徳山1R: 1号艇の展示STが最悪(.24)なのに本番.05で逃げ切った。実績と展示が正面から対立した例。
{name:'徳山1R 一般',jcd:'18',rno:1,date:'2026-09-23',result:'1-2-4',pop:1,wind:null,ws:3,wave:3,temp:27,wtemp:27,
 B:[
 {reg:'4388',g:'A2',nat:6.22,loc:4.96,mot:35.59,bt:29.61,st:0.17,F:0,exST:0.24,exF:null,exT:6.91,tilt:-0.5,wt:52.0,rec:[[5,.32,3],[3,.17,2],[5,.09,4],[5,.16,5]]},
 {reg:'5206',g:'B1',nat:4.62,loc:4.22,mot:29.47,bt:28.90,st:0.15,F:1,exST:0.08,exF:null,exT:6.83,tilt:0.0,wt:52.8,rec:[[6,.15,5],[3,.18,3],[5,.13,5]]},
 {reg:'5124',g:'B1',nat:4.31,loc:4.76,mot:21.11,bt:35.21,st:0.17,F:0,exST:0.02,exF:null,exT:6.87,tilt:-0.5,wt:52.7,rec:[[6,.14,6],[2,.24,6],[2,.19,3]]},
 {reg:'4663',g:'B2',nat:5.73,loc:null,mot:30.97,bt:38.14,st:0.16,F:1,exST:0.07,exF:null,exT:6.87,tilt:-0.5,wt:51.0,adj:1.0,rec:[[5,.21,3],[2,.21,5],[1,.16,5]]},
 {reg:'3401',g:'B1',nat:4.61,loc:4.32,mot:24.75,bt:40.00,st:0.22,F:0,exST:0.15,exF:null,exT:6.91,tilt:-0.5,wt:52.5,parts:'リング2',rec:[[2,.16,5],[6,.20,3],[3,.23,4]]},
 {reg:'4943',g:'B1',nat:4.50,loc:3.44,mot:38.00,bt:36.28,st:0.15,F:0,exST:0.03,exF:null,exT:6.86,tilt:-0.5,wt:52.6,rec:[[2,.07,4],[5,.15,6],[3,.09,2]]}]},
// 徳山2R: 修正後ロジックの初実戦。1号艇の展示ST .28(最悪)を理由に
// 3号艇を頭にした判断が当たった。決まり手は3号艇のまくり差し。
// 6号艇の展示ST .74 は範囲外として不採用（スタート練習をしていない数字）。
{name:'徳山2R 特選',jcd:'18',rno:2,date:'2026-09-23',result:'3-1-2',pop:17,wind:null,ws:1,wave:1,temp:25,wtemp:26,
 B:[
 {reg:'4375',g:'A2',nat:5.75,loc:5.47,mot:22.11,bt:34.27,st:0.17,F:0,exST:0.28,exF:null,exT:6.95,tilt:0.0,wt:52.2,rec:[[3,.15,3],[4,.13,1],[5,.12,3]]},
 {reg:'4583',g:'B1',nat:5.52,loc:3.17,mot:34.82,bt:37.14,st:0.15,F:1,exST:0.13,exF:null,exT:7.00,tilt:0.0,wt:52.0,rec:[[3,.19,2],[6,.37,6],[4,.02,3]]},
 {reg:'4702',g:'A1',nat:5.85,loc:5.92,mot:42.27,bt:41.06,st:0.14,F:0,exST:0.09,exF:null,exT:6.91,tilt:-0.5,wt:52.0,rec:[[1,.11,1],[5,.06,3],[2,.13,3]]},
 {reg:'4163',g:'A2',nat:5.65,loc:4.72,mot:28.93,bt:28.16,st:0.16,F:0,exST:0.12,exF:null,exT:6.83,tilt:0.0,wt:52.0,rec:[[5,.30,3],[2,.27,3],[6,.16,3]]},
 {reg:'4159',g:'A2',nat:6.59,loc:5.36,mot:39.56,bt:28.71,st:0.17,F:0,exST:0.17,exF:null,exT:6.93,tilt:0.0,wt:52.0,rec:[[2,.11,2],[3,.02,2],[6,.06,4]]},
 {reg:'3772',g:'B1',nat:4.87,loc:4.95,mot:37.07,bt:32.04,st:0.16,F:0,exST:0.74,exF:null,exT:7.00,tilt:0.0,wt:53.1,parts:'リング4',rec:[[4,.17,3],[1,.32,4],[2,.10,4]]}]},
];

function runWith(weightPatch, bandPatch, opt){
  opt=opt||{};
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
   beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  const w=dom.window,d=w.document;
  w.Element.prototype.scrollIntoView=function(){};
  const W=w.eval('W'); Object.assign(W, weightPatch||{});
  if(bandPatch) Object.assign(w.eval('BAND'), bandPatch);
  const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
  const out=[];
  for(const R of RACES){
    state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
    R.B.forEach((x,i)=>{ d.getElementById('reg'+(i+1)).value=x.reg; });
    w.syncRegsFromInputs();
    R.B.forEach((x,i)=>{
      const b=w.boatOf(i+1);
      setField(b,'name','選手'+(i+1),'official'); setField(b,'grade',x.g,'official');
      setField(b,'nationalWinRate',x.nat,'official');
      if(x.loc) setField(b,'localWinRate',x.loc,'official');
      setField(b,'motor2Rate',x.mot,'official'); setField(b,'boat2Rate',x.bt,'official');
      setField(b,'averageST',x.st,'official'); setField(b,'exhibitionTime',x.exT,'official');
      b.exhibitionSTFlag=x.exF; setField(b,'exhibitionST',x.exST,'official');
      setField(b,'tilt',x.tilt,'official'); setField(b,'weight',x.wt,'official');
      if(x.adj!=null) setField(b,'adjustmentWeight',x.adj,'official');
      if(x.parts) b.partsChange=x.parts;
      b.flagF=x.F; b.flagL=0;
      b.recentRaces=x.rec.map(r=>({course:r[0],st:r[1],stFlag:null,result:r[2]}));
      b.recentSource='official';
    });
    d.getElementById('venue').value=R.jcd; d.getElementById('raceDate').value=R.date;
    d.getElementById('raceNo').value=String(R.rno||1);
    d.getElementById('wave').value=String(R.wave); d.getElementById('windSpeed').value=String(R.ws);
    if(R.wind) d.getElementById('windDir').value=R.wind;
    if(R.temp!=null) d.getElementById('temp').value=String(R.temp);
    if(R.wtemp!=null) d.getElementById('waterTemp').value=String(R.wtemp);
    const ctx=w.scoreAll();
    const combos=w.buildProbabilities(ctx);
    const rank=combos.findIndex(c=>c.combo===R.result)+1;
    const rec={name:R.name, result:R.result, pop:R.pop, rank};
    if(opt.detail){
      rec.order=[...state.boats].sort((a,b)=>b.score-a.score).map(b=>`${b.lane}(${b.score.toFixed(1)})`);
      rec.head=combos[0].combo.split('-')[0];
      rec.top3=combos.slice(0,3).map(c=>c.combo);
      rec.breakdown=state.boats.map(b=>({lane:b.lane,
        parts:b.scoreBreakdown.map(p=>`${p.label}:${Math.round(p.val)}`)}));
    }
    out.push(rec);
  }
  return out;
}

function summarize(res){
  const r=res.map(x=>x.rank);
  return { ranks:r, avg:r.reduce((a,c)=>a+c,0)/r.length,
           in6:r.filter(x=>x<=6).length, in12:r.filter(x=>x<=12).length,
           in20:r.filter(x=>x<=20).length, n:r.length };
}
const line=s=>`[${s.ranks.map(x=>String(x).padStart(3)).join(' ')}]  平均${s.avg.toFixed(1)}  `+
  `6点${s.in6}/${s.n} 12点${s.in12}/${s.n} 20点${s.in20}/${s.n}`;

if(require.main===module){
  console.log(`検証レース ${RACES.length}件\n`);
  console.log('=== 現在の重み ===');
  const base=runWith({},null,{detail:true});
  base.forEach(x=>console.log(
    `  ${x.name.padEnd(12)} 結果 ${x.result}${x.pop?`(${x.pop}番人気)`:''} は ${String(x.rank).padStart(3)} 番目`+
    `   採点順 ${x.order.join(' ')}`));
  console.log('  '+line(summarize(base))+'\n');

  console.log('=== 実績の重みを下げ、展示の重みを上げた場合 ===');
  const grid=[];
  for(const shift of [0,0.02,0.04,0.06,0.08]){
    const patch={ national:0.11-shift*0.6, local:0.08-shift*0.4,
                  exST:0.07+shift*0.5, exTime:0.08+shift*0.5 };
    const s=summarize(runWith(patch));
    grid.push({shift,...s});
    console.log(`  実績${(0.19-shift).toFixed(2)} / 展示${(0.15+shift).toFixed(2)}   `+line(s));
  }
  const best=grid.reduce((a,c)=>c.avg<a.avg?c:a);
  console.log(`\n  平均が最小なのは shift=${best.shift}（実績${(0.19-best.shift).toFixed(2)} / 展示${(0.15+best.shift).toFixed(2)}）`);
  console.log('  ※ n が少ないうちは平均が1レースで大きく動く。採用は慎重に。\n');

  console.log('=== 勝率バンドの影響（重みは既定のまま） ===');
  [[3.0,8.0],[2.5,7.5],[2.0,7.5],[1.5,7.5],[2.0,8.0]].forEach(bd=>{
    console.log(`  勝率 ${bd[0].toFixed(1)}〜${bd[1].toFixed(1)}  `+line(summarize(runWith({}, {winRate:bd}))));
  });

  console.log('\n=== 当地勝率が無い選手（初出走）の扱い ===');
  console.log('  当地の重み 0.08（既定） '+line(summarize(runWith({}))));
  [0.06,0.04,0.02].forEach(v=>{
    console.log(`  当地の重み ${v.toFixed(2)}          `+
      line(summarize(runWith({local:v, national:0.11+(0.08-v)}))));
  });
}
module.exports={RACES,runWith,summarize};
