const fs=require('fs'),{JSDOM}=require('jsdom');
const SP='/tmp/claude-0/-home-user-boat-ai-predictor/95fe63c4-5cf5-5bcd-8923-6bf098464b41/scratchpad';
const HTML=fs.readFileSync(SP+'/index_v16.html','utf8');

// ---- 実際に走った3レース ----
const RACES=[
{name:'桐生8R 女子',jcd:'01',date:'2026-09-23',result:'1-5-4',wind:'向かい風',ws:2,wave:1,
 B:[
 {reg:'4373',g:'A1',nat:6.14,loc:7.40,mot:38.31,bt:37.84,st:0.17,F:1,exST:0.22,exF:null,exT:6.74,tilt:-0.5,wt:46.5,rec:[[2,.18,4],[6,.26,3],[3,.24,3],[1,.24,1],[5,.23,4]]},
 {reg:'4720',g:'B1',nat:3.33,loc:5.70,mot:29.89,bt:37.70,st:0.20,F:1,exST:0.15,exF:null,exT:6.74,tilt:0.0,wt:47.8,rec:[[6,.23,6],[3,.08,4],[5,.26,6],[4,.17,3],[1,.23,6]]},
 {reg:'4443',g:'B1',nat:5.51,loc:null,mot:49.04,bt:40.86,st:0.19,F:0,exST:0.13,exF:null,exT:6.82,tilt:0.0,wt:50.2,rec:[[2,.19,1],[3,.27,5],[1,.14,2],[4,.15,3],[6,.20,5]]},
 {reg:'5213',g:'B1',nat:5.24,loc:5.09,mot:37.58,bt:37.31,st:0.20,F:0,exST:0.03,exF:'F',exT:6.69,tilt:-0.5,wt:46.5,rec:[[4,.11,'失'],[3,.15,2],[2,.25,1],[5,.30,2],[1,.22,2]]},
 {reg:'5195',g:'A2',nat:5.28,loc:4.22,mot:34.31,bt:31.28,st:0.15,F:1,exST:0.02,exF:'F',exT:6.87,tilt:0.0,wt:48.0,rec:[[4,.18,5],[6,.08,3],[3,.04,1],[1,.18,1],[2,.17,1]]},
 {reg:'5437',g:'B2',nat:1.61,loc:null,mot:29.65,bt:28.65,st:0.23,F:1,exST:0.05,exF:null,exT:6.71,tilt:-0.5,wt:51.4,rec:[[6,.17,5],[6,.19,6],[6,.23,5],[6,.21,'失']]}]},
{name:'桐生9R 男子',jcd:'01',date:'2026-09-23',result:'1-3-2',wind:'向かい風',ws:1,wave:1,
 B:[
 {reg:'4311',g:'A1',nat:6.34,loc:6.81,mot:34.41,bt:39.01,st:0.15,F:1,exST:0.02,exF:null,exT:6.80,tilt:-0.5,wt:54.2,rec:[[1,.22,1],[5,.28,4],[4,.18,5],[3,.18,5],[6,.19,4]]},
 {reg:'4228',g:'A2',nat:6.50,loc:5.75,mot:27.89,bt:32.80,st:0.17,F:1,exST:0.02,exF:'F',exT:6.84,tilt:-0.5,wt:54.3,rec:[[2,.21,6],[5,.17,5],[6,.22,6],[3,.12,3],[1,.20,2]]},
 {reg:'5179',g:'B1',nat:4.55,loc:2.63,mot:35.79,bt:30.05,st:0.20,F:0,exST:0.02,exF:'F',exT:6.81,tilt:0.0,wt:52.5,rec:[[5,.21,4],[6,.09,6],[2,.23,5],[4,.13,4],[1,.10,5]]},
 {reg:'4351',g:'A1',nat:6.94,loc:7.18,mot:27.84,bt:31.09,st:0.13,F:1,exST:0.07,exF:'F',exT:6.83,tilt:-0.5,wt:52.0,rec:[[6,.08,3],[3,.16,4],[2,.12,1],[1,.18,3],[2,.17,1]]},
 {reg:'5427',g:'B1',nat:3.04,loc:2.35,mot:36.79,bt:34.36,st:0.22,F:0,exST:0.05,exF:'F',exT:6.74,tilt:-0.5,wt:52.0,rec:[[6,.15,4],[5,.21,5],[4,.14,3],[5,.18,3],[6,.03,6]]},
 {reg:'3538',g:'B2',nat:3.92,loc:5.48,mot:41.54,bt:34.55,st:0.21,F:0,exST:0.11,exF:null,exT:6.94,tilt:-0.5,wt:52.0,rec:[[1,.18,5],[4,.07,5],[2,.21,5],[5,.14,5],[3,.15,5]]}]},
{name:'桐生12R 特選',jcd:'01',date:'2026-09-23',result:'1-5-4',wind:'向かい風',ws:2,wave:1,
 B:[
 {reg:'4627',g:'A2',nat:6.29,loc:5.27,mot:28.18,bt:34.02,st:0.15,F:0,exST:0.02,exF:null,exT:6.77,tilt:-0.5,wt:47.1,rec:[[3,.12,5],[1,.15,1],[5,.11,1],[2,.19,1],[6,.19,5],[3,.21,'失']]},
 {reg:'4478',g:'A1',nat:5.94,loc:6.04,mot:30.93,bt:40.44,st:0.16,F:0,exST:0.06,exF:null,exT:6.71,tilt:-0.5,wt:47.2,rec:[[5,.15,2],[1,.13,1],[2,.13,3],[6,.12,5],[3,.17,1],[1,.13,3]]},
 {reg:'5265',g:'B1',nat:3.82,loc:2.88,mot:31.55,bt:38.54,st:0.15,F:0,exST:0.24,exF:null,exT:6.78,tilt:0.0,wt:45.0,rec:[[5,.12,4],[4,.11,3],[2,.08,3],[1,.21,1],[6,.13,2]]},
 {reg:'4373',g:'A1',nat:6.14,loc:7.40,mot:38.31,bt:37.84,st:0.17,F:1,exST:0.03,exF:null,exT:6.59,tilt:-0.5,wt:46.5,rec:[[2,.18,4],[6,.26,3],[3,.24,3],[1,.24,1],[5,.23,4],[1,.13,1]]},
 {reg:'5335',g:'B1',nat:3.10,loc:2.78,mot:37.31,bt:38.59,st:0.18,F:0,exST:0.01,exF:'F',exT:6.67,tilt:-0.5,wt:47.0,rec:[[5,.05,1],[1,.23,2],[4,.18,5],[2,.19,6],[6,.05,5]]},
 {reg:'4642',g:'A2',nat:6.98,loc:5.40,mot:33.49,bt:33.88,st:0.16,F:0,exST:0.01,exF:null,exT:6.71,tilt:-0.5,wt:46.5,rec:[[1,.22,3],[4,.11,2],[6,.23,5],[5,.21,3],[3,.17,1],[2,.17,1]]}]},
];

function runWith(weightPatch, bandPatch){
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
      b.flagF=x.F; b.flagL=0;
      b.recentRaces=x.rec.map(r=>({course:r[0],st:r[1],stFlag:null,result:r[2]}));
      b.recentSource='official';
    });
    d.getElementById('venue').value=R.jcd; d.getElementById('raceDate').value=R.date;
    d.getElementById('wave').value=String(R.wave); d.getElementById('windSpeed').value=String(R.ws);
    d.getElementById('windDir').value=R.wind;
    const ctx=w.scoreAll();
    const combos=w.buildProbabilities(ctx);
    out.push({name:R.name, rank:combos.findIndex(c=>c.combo===R.result)+1});
  }
  return out;
}

const base={};
console.log('=== 現在の重み ===');
let r=runWith(base);
r.forEach(x=>console.log(`  ${x.name.padEnd(14)} 結果は ${String(x.rank).padStart(3)} 番目`));
console.log(`  平均 ${(r.reduce((a,c)=>a+c.rank,0)/r.length).toFixed(1)} 番目\n`);

console.log('=== 実績の重みを下げ、展示の重みを上げた場合 ===');
console.log('  (全国/当地) → (展示ST/展示タイム)   平均順位   6点  12点');
const grid=[];
for(const shift of [0,0.02,0.04,0.06,0.08]){
  const patch={ national:0.11-shift*0.6, local:0.08-shift*0.4,
                exST:0.07+shift*0.5, exTime:0.08+shift*0.5 };
  const res=runWith(patch);
  const ranks=res.map(x=>x.rank);
  const avg=ranks.reduce((a,c)=>a+c,0)/ranks.length;
  grid.push({shift,ranks,avg,in6:ranks.filter(x=>x<=6).length,in12:ranks.filter(x=>x<=12).length});
  console.log(`  実績${(0.19-shift).toFixed(2)} / 展示${(0.15+shift).toFixed(2)}   `+
    `[${ranks.map(x=>String(x).padStart(3)).join(' ')}]  ${avg.toFixed(1)}   `+
    `${ranks.filter(x=>x<=6).length}/3  ${ranks.filter(x=>x<=12).length}/3`);
}
const best=grid.reduce((a,c)=>c.avg<a.avg?c:a);
console.log(`\n  最も良かったのは shift=${best.shift}（実績${(0.19-best.shift).toFixed(2)} / 展示${(0.15+best.shift).toFixed(2)}）`);

console.log('\n=== 勝率バンドの影響（重みは既定のまま） ===');
[[3.0,8.0],[2.5,7.5],[2.0,7.5],[1.5,7.5],[2.0,8.0]].forEach(bd=>{
  const res=runWith({}, {winRate:bd});
  const ranks=res.map(x=>x.rank);
  const avg=ranks.reduce((a,c)=>a+c,0)/ranks.length;
  console.log(`  勝率 ${bd[0].toFixed(1)}〜${bd[1].toFixed(1)}  [${ranks.map(x=>String(x).padStart(3)).join(' ')}]  平均${avg.toFixed(1)}  6点${ranks.filter(x=>x<=6).length}/3 12点${ranks.filter(x=>x<=12).length}/3`);
});
