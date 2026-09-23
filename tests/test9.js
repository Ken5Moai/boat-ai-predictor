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
function setup(){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REGS.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  state.boats.forEach(b=>{ setField(b,'grade','A1','official'); setField(b,'nationalWinRate',6.0,'official');
    setField(b,'localWinRate',6.0,'official'); setField(b,'motor2Rate',50,'official'); });
  d.getElementById('venue').value='05'; d.getElementById('raceDate').value='2026-09-23';
  d.getElementById('raceNo').value='12'; d.getElementById('budget').value='1000';
  d.getElementById('entryOrder').value='';
  w.applyEntryOrder('');
}

console.log('\n=== BP. スクショの並び 1-2-3-5-6-4 を入力 ===');
setup();
w.applyEntryOrder('123564');
ok(w.boatOf(1).entryCourse===1,'1号艇→1コース');
ok(w.boatOf(2).entryCourse===2,'2号艇→2コース');
ok(w.boatOf(3).entryCourse===3,'3号艇→3コース');
ok(w.boatOf(5).entryCourse===4,`5号艇→4コース (${w.boatOf(5).entryCourse})`);
ok(w.boatOf(6).entryCourse===5,`6号艇→5コース (${w.boatOf(6).entryCourse})`);
ok(w.boatOf(4).entryCourse===6,`4号艇→6コース (${w.boatOf(4).entryCourse})`);
const courseOf=w.eval('courseOf');
ok(courseOf(w.boatOf(4))===6,'4号艇は6コースとして扱われる');

console.log('\n=== BQ. 採点が実際のコース基準になるか ===');
setup(); w.scoreAll();
const nari=state.boats.map(b=>b.score);
setup(); w.applyEntryOrder('123564'); w.scoreAll();
const kuzure=state.boats.map(b=>b.score);
console.log('  枠なり    :',nari.map(x=>x.toFixed(1)).join(', '));
console.log('  1-2-3-5-6-4:',kuzure.map(x=>x.toFixed(1)).join(', '));
ok(kuzure[3]<nari[3],`4号艇の評価が下がる ${nari[3].toFixed(1)}→${kuzure[3].toFixed(1)}（6コースへ）`);
ok(kuzure[4]>nari[4],`5号艇の評価が上がる ${nari[4].toFixed(1)}→${kuzure[4].toFixed(1)}（4コースへ）`);
ok(kuzure[5]>nari[5],`6号艇の評価が上がる ${nari[5].toFixed(1)}→${kuzure[5].toFixed(1)}（5コースへ）`);
ok(Math.abs(kuzure[0]-nari[0])<0.1,'1号艇は変わらない（1コースのまま）');
const b4=w.boatOf(4);
ok(b4.scoreBreakdown.some(p=>p.label.includes('6コース')),
   `採点内訳が6コース基準: ${b4.scoreBreakdown.find(p=>p.label.includes('コース'))?.label}`);
ok(b4.minus.some(t=>t.includes('6コースへ下げられた')),`減点理由に明記: ${b4.minus.find(t=>t.includes('コース'))}`);
ok(w.boatOf(5).plus.some(t=>t.includes('4コースを取った')),'前付けは加点理由に明記');

console.log('\n=== BR. コース別成績も実際のコースで参照 ===');
setup();
w.boatOf(4).courseStats[4]={firstRate:20,trioRate:55,avgST:0.13};  // 4コースは得意
w.boatOf(4).courseStats[6]={firstRate:1,trioRate:15,avgST:0.20};   // 6コースは苦手
w.scoreAll();
const withNari=w.boatOf(4).score;
w.applyEntryOrder('123564'); w.scoreAll();
const withKuzure=w.boatOf(4).score;
ok(withKuzure<withNari,`6コース進入なら苦手なコース実績が使われる ${withNari.toFixed(1)}→${withKuzure.toFixed(1)}`);
ok(w.boatOf(4).scoreBreakdown.some(p=>p.label==='6コース1着率'),'6コースの成績を参照している');
ok(!w.boatOf(4).scoreBreakdown.some(p=>p.label==='4コース1着率'),'4コースの成績は使わない');

console.log('\n=== BS. 荒れ想定で買い目が広がるか ===');
setup(); let ctx=w.scoreAll(); let cb=w.buildProbabilities(ctx);
const top6nari=cb.slice(0,6).reduce((a,c)=>a+c.p,0);
setup(); w.applyEntryOrder('123564'); ctx=w.scoreAll(); cb=w.buildProbabilities(ctx);
const top6kuzure=cb.slice(0,6).reduce((a,c)=>a+c.p,0);
ok(top6kuzure<top6nari,
   `進入崩れで上位6点への集中が緩む ${(top6nari*100).toFixed(1)}%→${(top6kuzure*100).toFixed(1)}%`);
ok(Math.abs(cb.reduce((a,c)=>a+c.p,0)-1)<1e-9,'確率の合計は1.0のまま');
ok(ctx.entryInfo.movedCount===3,`動いた艇は3艇 (${ctx.entryInfo.movedCount})`);
ok(ctx.entryInfo.formation.join('')==='123564',`並びを保持: ${ctx.entryInfo.formation.join('-')}`);

console.log('\n=== BT. レポートへの表示 ===');
setup(); w.applyEntryOrder('123564'); w.validateAll(); w.generateReport();
let rep=d.getElementById('report').textContent;
ok(rep.includes('進入が枠なりから崩れています'),'進入崩れを警告');
ok(rep.includes('1 - 2 - 3 - 5 - 6 - 4'),'並びを表示');
ok(rep.includes('4号艇 → 6コース'),'どの艇がどこへ動いたか表示');
ok(rep.includes('コース取りで荒れる'),'荒れる可能性を明示');
ok(rep.includes('進入6C'),'評価順位にも進入コースを表示');
ok(d.querySelectorAll('.betrow').length===6,'買い目6点');
setup(); w.applyEntryOrder('123456'); w.validateAll(); w.generateReport();
rep=d.getElementById('report').textContent;
ok(rep.includes('進入は枠なり'),'枠なりなら枠なりと表示');
ok(!rep.includes('崩れています'),'枠なりでは警告を出さない');
setup(); w.validateAll(); w.generateReport();
rep=d.getElementById('report').textContent;
ok(rep.includes('進入が未取得'),'未取得なら未取得と明示');

console.log('\n=== BU. 信頼度が下がるか ===');
setup();
setField(w.boatOf(1),'nationalWinRate',8.0,'official');  // 1号艇を突出させてA判定を狙う
setField(w.boatOf(1),'motor2Rate',70,'official');
w.validateAll(); w.generateReport();
const rankNari=d.querySelector('.kpi b').textContent.trim();
setup();
setField(w.boatOf(1),'nationalWinRate',8.0,'official');
setField(w.boatOf(1),'motor2Rate',70,'official');
w.applyEntryOrder('123564'); w.validateAll(); w.generateReport();
const rankKuzure=d.querySelector('.kpi b').textContent.trim();
console.log(`  枠なり: ${rankNari} / 進入崩れ: ${rankKuzure}`);
ok('ABC'.indexOf(rankKuzure)>='ABC'.indexOf(rankNari),'進入が崩れたら信頼度は上がらない');

console.log('\n=== BV. 入力の検証 ===');
setup();
w.applyEntryOrder('12356');
ok(state.boats.every(b=>!b.entryCourse),'5個しか入力していなければ採用しない');
ok(d.getElementById('entryNotice').textContent.includes('6つ入力'),'不足を案内');
w.applyEntryOrder('112345');
ok(state.boats.every(b=>!b.entryCourse),'重複があれば採用しない');
w.applyEntryOrder('1-2-3-5-6-4');
ok(w.boatOf(4).entryCourse===6,'区切り文字が入っていても読める');
w.applyEntryOrder('');
ok(state.boats.every(b=>b.entryCourse===null),'空にすれば枠なりに戻る');
ok(w.eval('courseOf')(w.boatOf(4))===4,'進入未設定なら枠番を使う');

console.log('\n=== BW. 直前情報からの自動反映 ===');
setup();
const BEFORE=`スタート展示
1 .13
2 .04
3 .08
5 .03
6 .11
4 .03
水面気象情報 気温 24.0℃ 風速 3m`;
w.applyBeforeInfo(w.parseBeforeInfoDOM(BEFORE),'official');
ok(w.boatOf(4).entryCourse===6,`直前情報から4号艇→6コースを自動取得 (${w.boatOf(4).entryCourse})`);
ok(w.boatOf(5).entryCourse===4,'5号艇→4コースも自動取得');
ok(d.getElementById('entryOrder').value==='123564',`入力欄にも反映: ${d.getElementById('entryOrder').value}`);
ok(V(w.boatOf(4).exhibitionST)===0.03,'展示STも4号艇に正しく対応');
ok(V(w.boatOf(1).exhibitionST)===0.13,'1号艇の展示STも正しい');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
