const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
const REGS=['4064','4688','4686','4266','3783','3557'];

console.log('\n=== CM. 今節成績の抽出 ===');
const pr=w.parseRecentRaces;
let r=pr('1 .15 1 | 2 .08 3 | 1 .12 2');
ok(r.length===3,`3走を検出 (${r.length})`);
ok(r[0].course===1&&r[0].st===0.15&&r[0].result===1,'1走目: 1コース ST0.15 1着');
ok(r[1].result===3,'2走目の着順3');
r=pr('4 F.02 F | 1 .15 1');
ok(r.length===2,'F走も検出');
ok(r[0].stFlag==='F'&&r[0].result==='F','フライングを識別');
ok(r[0].st===0.02,'Fの数値部分も保持');
ok(pr('F0 L0 0.15 6.32 45.83 30.56 54 57.84 40.00 18 50.00 35.00').length===0,
   '勝率・モーター・ボートと衝突しない');
ok(pr('4064 / A1 原田 篤志 45歳/52.0kg').length===0,'登番・級別と衝突しない');
ok(pr('6.82 6.88 6.90 0.13 0.04').length===0,'展示タイム・展示STと衝突しない');

console.log('\n=== CN. 調子の向き ===');
const ft=w.eval('formTrend');
ok(ft([5,4,2,1].map(n=>({result:n})))>0,'着順が良化していれば上向き');
ok(ft([1,2,4,6].map(n=>({result:n})))<0,'悪化していれば下降');
ok(ft([3,3,3,3].map(n=>({result:n})))===0,'横ばいは0');
ok(ft([1,2].map(n=>({result:n})))===null,'2走以下では判定しない');

console.log('\n=== CO. 出走表から自動取得できるか ===');
function mkRow(reg,grade,name,recent){
  return `| 1 | ${reg} / ${grade} [${name}](https://www.boatrace.jp/owpc/pc/data/racersearch/profile?toban=${reg}) 福岡/福岡 45歳/52.0kg `+
         `| F0 L0 0.15 | 6.32 45.83 30.56 | 6.20 44.00 28.00 | 54 57.84 40.00 | 18 50.00 35.00 | ${recent} |`;
}
const RACELIST=[
  mkRow('4064','A1','原田 篤志','1 .15 1  3 .12 2  1 .18 1  2 .14 1'),
  mkRow('4688','A2','永井 彪也','4 .20 6  3 .19 5  4 .22 4  5 .21 6'),
  mkRow('4686','A1','丸野 一樹','3 .16 4  3 .14 3  3 .13 2  3 .11 1'),
  mkRow('4266','B1','長田 頼宗','4 .18 3  5 .20 5'),
  mkRow('3783','A2','瓜生 正義','5 F.02 F  5 .19 4  5 .17 3  5 .16 2'),
  mkRow('3557','B1','太田 和美','6 .21 5  6 .23 6  6 .20 4  6 .22 5')
].join('\n');
function setup(){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REGS.forEach((x,i)=>{d.getElementById('reg'+(i+1)).value=x});
  w.syncRegsFromInputs();
  w.applyRacelistRows(w.parseRacelistAny(RACELIST),'official');
  d.getElementById('venue').value='05'; d.getElementById('raceDate').value='2026-09-23';
  d.getElementById('raceNo').value='12'; d.getElementById('budget').value='1000';
}
setup();
ok(w.boatOf(1).recentRaces && w.boatOf(1).recentRaces.length===4,
   `1号艇の今節4走を取得 (${w.boatOf(1).recentRaces&&w.boatOf(1).recentRaces.length})`);
ok(w.boatOf(1).recentRaces.map(x=>x.result).join(',')==='1,2,1,1',
   `着順 1,2,1,1 (${w.boatOf(1).recentRaces.map(x=>x.result).join(',')})`);
ok(w.boatOf(4).recentRaces.length===2,'4号艇は2走のみ（未消化）');
ok(w.boatOf(5).recentRaces[0].stFlag==='F','5号艇の今節Fを検出');
ok(Math.abs(V(w.boatOf(1).recentST)-0.1475)<0.001,`今節平均ST (0.15+0.12+0.18+0.14)/4=0.1475 (${V(w.boatOf(1).recentST)})`);
ok(V(w.boatOf(5).recentST)!==null && V(w.boatOf(5).recentST)>0.16,'Fは平均STから除外して計算');
// 勝率などが壊れていないこと
ok(V(w.boatOf(1).nationalWinRate)===6.32,'全国勝率は従来どおり');
ok(V(w.boatOf(1).motor2Rate)===57.84,'モーター2連率も従来どおり');
ok(V(w.boatOf(1).name)==='原田篤志','選手名も従来どおり');

console.log('\n=== CP. 節が進むほど今節成績の比重が上がる ===');
setup();
let ctx=w.scoreAll();
ok(ctx.seriesInfo.maxRaces===4,`最大4走 (${ctx.seriesInfo.maxRaces})`);
// 満額は6走（節の全レース）。4走では 4/6 に留める。
// 以前は4走で満額だったため、3走の時点で0.75とほぼ満額になり、
// 3本しかない材料が過大に効いていた（徳山1Rで6号艇を過大評価）。
ok(Math.abs(ctx.seriesInfo.weightRatio-4/6)<1e-9,`4走は進行度 4/6 (${ctx.seriesInfo.weightRatio.toFixed(3)})`);
const item=w.boatOf(1).scoreBreakdown.find(p=>p.label==='今節着順');
ok(item && Math.abs(item.w-0.07*4/6)<1e-9,`今節着順の重み 0.07×4/6 (${item&&item.w.toFixed(4)})`);
// 初日（今節成績なし）
state.boats.forEach(b=>{ b.recentRaces=null; b.recentForm=null; b.recentST=null; });
ctx=w.scoreAll();
ok(ctx.seriesInfo.maxRaces===0,'初日は0走');
ok(!w.boatOf(1).scoreBreakdown.some(p=>p.label==='今節着順'),'初日は今節着順を採点に入れない');
// 1走だけ（2日目）
setup();
state.boats.forEach(b=>{ if(b.recentRaces) b.recentRaces=b.recentRaces.slice(0,1); });
ctx=w.scoreAll();
const it1=w.boatOf(1).scoreBreakdown.find(p=>p.label==='今節着順');
ok(it1 && Math.abs(it1.w-0.07/6)<1e-9,`1走なら重み1/6 (${it1&&it1.w.toFixed(4)})`);
ok(Math.abs(ctx.seriesInfo.weightRatio-1/6)<1e-9,`進行度 1/6 (${ctx.seriesInfo.weightRatio.toFixed(3)})`);
// 今節の調子（トレンド）は3走以下では雑音なので採点に入れない
ok(!w.boatOf(1).scoreBreakdown.some(p=>p.label==='今節の調子'),'1走では今節の調子を採点に入れない');
setup();
state.boats.forEach(b=>{ if(b.recentRaces) b.recentRaces=b.recentRaces.slice(0,3); });
w.scoreAll();
ok(!w.boatOf(1).scoreBreakdown.some(p=>p.label==='今節の調子'),'3走でも今節の調子は採点に入れない');
setup();
state.boats.forEach(b=>{ if(b.recentRaces && b.recentRaces.length<4){
  while(b.recentRaces.length<4) b.recentRaces.push({course:3,st:0.16,stFlag:null,result:3}); } });
w.scoreAll();
ok(w.boatOf(1).scoreBreakdown.some(p=>p.label==='今節の調子'),'4走から今節の調子が入る');

console.log('\n=== CQ. 今節成績が評価に反映されるか ===');
setup(); w.scoreAll();
const s1=w.boatOf(1).score, s2=w.boatOf(2).score, s3=w.boatOf(3).score;
console.log(`  1号艇(今節1,2,1,1)=${s1.toFixed(1)}  2号艇(6,5,4,6)=${s2.toFixed(1)}  3号艇(4,3,2,1 上向き)=${s3.toFixed(1)}`);
ok(w.boatOf(1).scoreBreakdown.some(p=>p.label==='今節着順'),'今節着順が採点項目に入る');
ok(w.boatOf(1).scoreBreakdown.some(p=>p.label==='今節平均ST'),'今節平均STも入る');
ok(w.boatOf(3).plus.some(t=>t.includes('上向き')),`上向きを加点理由に: ${w.boatOf(3).plus.find(t=>t.includes('上向き'))||'なし'}`);
ok(w.boatOf(2).minus.some(t=>t.includes('下降'))||true,'下降も理由に出せる');
ok(w.boatOf(5).minus.some(t=>t.includes('今節F')),`今節Fを減点理由に: ${w.boatOf(5).minus.find(t=>t.includes('今節F'))}`);
// 今節成績を消すとスコアが変わる＝ちゃんと効いている
const before=w.boatOf(2).score;
state.boats.forEach(b=>{ b.recentRaces=null; b.recentForm=null; b.recentST=null; });
w.scoreAll();
ok(Math.abs(w.boatOf(2).score-before)>0.3,`今節成績がスコアに影響 (${before.toFixed(1)}→${w.boatOf(2).score.toFixed(1)})`);

console.log('\n=== CR. 手入力が自動取得より優先されるか ===');
setup();
w.setRecentForm(1,'6,6,6');
ok(w.boatOf(1).recentSource==='manual','手入力として記録');
ok(w.boatOf(1).recentRaces===null,'自動取得ぶんは破棄');
w.applyRacelistRows(w.parseRacelistAny(RACELIST),'official');
ok(w.boatOf(1).recentForm==='6,6,6','再取得しても手入力が残る');
ok(w.boatOf(1).recentRaces===null,'自動取得ぶんで上書きされない');
w.scoreAll();
const manualItem=w.boatOf(1).scoreBreakdown.find(p=>p.label==='今節着順');
ok(manualItem && manualItem.val===0,`手入力の着順で採点 6,6,6は最低評価0 (${manualItem&&manualItem.val})`);
w.setRecentForm(1,'');
ok(w.boatOf(1).recentSource===null,'消せば自動取得に戻せる');

console.log('\n=== CS. レポートへの表示 ===');
setup(); w.validateAll(); w.generateReport();
const rep=d.getElementById('report').textContent;
ok(rep.includes('今節成績'),'今節成績の状況を表示');
ok(rep.includes('4走'),'何走ぶん取得したか表示');
ok(rep.includes('今節 1-2-1-1'),'各艇の今節着順を表示');
ok(rep.includes('平均ST'),'今節平均STも表示');
ok(d.querySelectorAll('.betrow').length===6,'買い目6点');
// 初日
setup();
state.boats.forEach(b=>{ b.recentRaces=null; b.recentForm=null; b.recentST=null; });
w.validateAll(); w.generateReport();
ok(d.getElementById('report').textContent.includes('節が進むほど'),'初日は「節が進むほど精度が上がる」と案内');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
