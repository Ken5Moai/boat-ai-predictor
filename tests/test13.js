const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};
   w.alert=()=>{}; w.confirm=()=>true;}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');

function makeRace(date,jcd,rno){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  ['4373','4720','4443','5213','5195','5437'].forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  const nat=[6.14,3.33,5.51,5.24,5.28,1.61], mot=[38.31,29.89,49.04,37.58,34.31,29.65];
  state.boats.forEach((b,i)=>{
    setField(b,'name','選手'+(i+1),'official'); setField(b,'grade',i===0?'A1':'B1','official');
    setField(b,'nationalWinRate',nat[i],'official'); setField(b,'localWinRate',5.0,'official');
    setField(b,'motor2Rate',mot[i],'official');
  });
  d.getElementById('raceDate').value=date; d.getElementById('venue').value=jcd;
  d.getElementById('raceNo').value=String(rno); d.getElementById('budget').value='1000';
  w.validateAll(); w.generateReport();
}

console.log('\n=== CT. 予想が自動で記録されるか ===');
w.localStorage.removeItem('boatai_records_v1');
makeRace('2026-09-23','01',8);
let recs=w.loadRecords();
ok(recs.length===1,`1件保存 (${recs.length})`);
const r0=recs[0];
ok(r0.venueName==='桐生'&&r0.rno==='8',`レース情報を保存: ${r0.venueName} ${r0.rno}R`);
ok(r0.picks.length===6,`買い目6点を保存 (${r0.picks.length})`);
ok(r0.picks[0].amount>0,'金額も保存');
ok(Array.isArray(r0.order)&&r0.order.length===6,'評価順位も保存');
ok(r0.result===null,'結果は未入力');
ok(typeof r0.rank==='string','信頼度も保存');
ok(typeof r0.seriesRaces==='number','今節の走数も保存');

console.log('\n=== CU. 同じレースを作り直しても増えない ===');
makeRace('2026-09-23','01',8);
ok(w.loadRecords().length===1,`重複しない (${w.loadRecords().length}件)`);
makeRace('2026-09-23','01',9);
ok(w.loadRecords().length===2,`別レースは追加される (${w.loadRecords().length}件)`);

console.log('\n=== CV. 着順の入力 ===');
const pr=w.parseResultOrder;
ok(JSON.stringify(pr('154'))==='{"first":1,"second":5,"third":4}','154 を 1着5着4着に変換');
ok(JSON.stringify(pr('1-5-4'))==='{"first":1,"second":5,"third":4}','1-5-4 の形式も読める');
ok(pr('15')===null,'3つ未満は不可');
ok(pr('155')===null,'重複は不可');
ok(pr('789')===null,'1〜6以外は不可');

console.log('\n=== CW. 的中判定 ===');
w.localStorage.removeItem('boatai_records_v1');
const mk=(id,picks,order,rank)=>({id,savedAt:'2026-09-23',date:'2026-09-23',jcd:'01',venueName:'桐生',rno:'8',
  order,picks:picks.map(c=>({combo:c,amount:200,p:0.05})),rank,result:null});
let list=[
  mk('a',['1-3-4','1-3-2','3-1-4','1-4-3','1-2-3','4-1-3'],[1,3,4,2,5,6],'B'),
  mk('b',['1-5-4','1-4-5','1-3-4','4-1-5','5-1-4','1-4-3'],[1,4,5,3,2,6],'A'),
  mk('c',['2-1-3','2-3-1','1-2-3','3-2-1','2-1-4','1-3-2'],[2,1,3,4,5,6],'C')
];
w.saveRecords(list);
w.setResult('a','154','1400');   // 不的中（3連複も外れ: a は1-4-5系を持たない…実は1-4-3など）
w.setResult('b','154','1400');   // 3連単的中
w.setResult('c','154','1400');   // 頭も外れ
const st=w.recordStats(w.loadRecords());
console.log('  集計:',JSON.stringify(st.byRank));
ok(st.done===3,`3件が結果入力済み (${st.done})`);
ok(st.tri===1,`3連単的中は1件 (${st.tri})`);
ok(st.head===2,`1着的中は2件（aとb） (${st.head})`);
ok(st.trio>=1,`3連複的中も判定 (${st.trio})`);
ok(st.bet===3*6*200,`購入額 ${st.bet}円`);
ok(st.back===1400*2,`払戻 ${st.back}円（200円買いなので2倍）`);
ok(st.byRank['A'].tri===1&&st.byRank['C'].tri===0,'信頼度別に集計できる');

console.log('\n=== CX. 画面表示 ===');
w.renderRecords();
const box=d.getElementById('recordList').textContent;
ok(box.includes('3連単'),'的中率を表示');
ok(box.includes('回収率'),'回収率を表示');
ok(box.includes('信頼度'),'信頼度別の表を表示');
ok(box.includes('桐生'),'レース名を表示');
ok(box.includes('1-5-4'),'結果を表示');
ok(d.querySelectorAll('#recordList input').length>=2,'着順と払戻の入力欄がある');
w.renderRecords('99');
ok(d.getElementById('recordList').textContent.includes('読めません'),'不正な入力を案内');

console.log('\n=== CY. 結果の修正・削除 ===');
w.setResult('b','145','800');
let b=w.loadRecords().find(x=>x.id==='b');
ok(b.result.combo==='1-4-5',`結果を修正できる (${b.result.combo})`);
ok(b.result.payout===800,'払戻も修正できる');
w.setResult('b','','');
b=w.loadRecords().find(x=>x.id==='b');
ok(b.result===null,'空にすれば未入力に戻せる');
w.deleteRecord('c');
ok(w.loadRecords().length===2,`削除できる (${w.loadRecords().length}件)`);

console.log('\n=== CZ. 書き出しと読み込み ===');
w.exportRecords();
const dump=d.getElementById('recordIO').value;
ok(dump.length>10,'書き出せる');
w.localStorage.removeItem('boatai_records_v1');
ok(w.loadRecords().length===0,'いったん消す');
d.getElementById('recordIO').value=dump;
w.importRecords();
ok(w.loadRecords().length===2,`復元できる (${w.loadRecords().length}件)`);
// 既存を消さない
d.getElementById('recordIO').value=JSON.stringify([mk('z',['1-2-3'],[1,2,3],'A')]);
w.importRecords();
ok(w.loadRecords().length===3,'読み込みで既存の記録を消さない');
d.getElementById('recordIO').value='これはJSONではない';
w.importRecords();
ok(d.getElementById('recordIONotice').textContent.includes('読み取れません'),'壊れた入力を拒否');
ok(w.loadRecords().length===3,'拒否しても既存は無事');

console.log('\n=== DA. 結果を見る前に保存されているか（最重要） ===');
w.localStorage.removeItem('boatai_records_v1');
makeRace('2026-09-24','12',5);
const saved=w.loadRecords()[0];
ok(saved.result===null,'生成時点では結果が空');
ok(saved.savedAt && new Date(saved.savedAt).getTime()>0,'保存時刻が残る');
ok(saved.picks.every(p=>p.combo&&p.amount),'買い目と金額が確定した状態で保存');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
