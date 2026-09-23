const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{};w.confirm=()=>true}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');

function makeRace(date,rno,count,budget){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  ['4311','4228','5179','4351','5427','3538'].forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  const nat=[6.34,6.50,4.55,6.94,3.04,3.92], mot=[34.41,27.89,35.79,27.84,36.79,41.54];
  state.boats.forEach((b,i)=>{
    setField(b,'name','選手'+(i+1),'official'); setField(b,'grade',i<2?'A1':'B1','official');
    setField(b,'nationalWinRate',nat[i],'official'); setField(b,'localWinRate',5.0,'official');
    setField(b,'motor2Rate',mot[i],'official');
  });
  d.getElementById('raceDate').value=date; d.getElementById('venue').value='01';
  d.getElementById('raceNo').value=String(rno); d.getElementById('budget').value=String(budget||1200);
  if(count) d.getElementById('betCount').value=String(count);
  w.validateAll(); w.generateReport();
}

console.log('\n=== DB. 買い目の点数を選べるか ===');
w.localStorage.removeItem('boatai_records_v1');
makeRace('2026-09-23',9,6);
ok(d.querySelectorAll('.betrow').length===6,`6点設定で6点 (${d.querySelectorAll('.betrow').length})`);
makeRace('2026-09-23',9,10);
ok(d.querySelectorAll('.betrow').length===10,`10点設定で10点 (${d.querySelectorAll('.betrow').length})`);
let amounts=[...d.querySelectorAll('.betamt')].map(e=>Number(e.textContent.replace(/[^0-9]/g,'')));
ok(amounts.reduce((a,b)=>a+b,0)<=1200,`10点でも予算内 (${amounts.reduce((a,b)=>a+b,0)}円)`);
ok(amounts.every(v=>v>=100),'全点100円以上');
makeRace('2026-09-23',9,4);
ok(d.querySelectorAll('.betrow').length===4,`4点設定で4点 (${d.querySelectorAll('.betrow').length})`);
makeRace('2026-09-23',9,12,500);
ok(d.querySelectorAll('.betrow').length===5,`予算500円・12点設定なら5点に自動調整 (${d.querySelectorAll('.betrow').length})`);

console.log('\n=== DC. 120通りの評価順が記録されるか ===');
w.localStorage.removeItem('boatai_records_v1');
makeRace('2026-09-23',9,6);
const rec=w.loadRecords()[0];
ok(!!rec.ranking,'評価順が保存される');
const list=rec.ranking.split(',');
ok(list.length===120,`120通りすべて (${list.length})`);
ok(new Set(list).size===120,'重複なし');
ok(list.every(c=>/^[1-6]-[1-6]-[1-6]$/.test(c)),'形式が正しい');
ok(list[0]===rec.picks[0].combo,'1番目が本線と一致');

console.log('\n=== DD. 結果が何番目だったかを算出 ===');
const rk=w.resultRankOf;
w.setResult(rec.id, list[0].replace(/-/g,''), '1000');
ok(rk(w.loadRecords()[0])===1,`本線的中なら1番目 (${rk(w.loadRecords()[0])})`);
w.setResult(rec.id, list[23].replace(/-/g,''), '4100');
ok(rk(w.loadRecords()[0])===24,`24番目の組み合わせなら24 (${rk(w.loadRecords()[0])})`);
w.setResult(rec.id, list[99].replace(/-/g,''), '');
ok(rk(w.loadRecords()[0])===100,`100番目なら100 (${rk(w.loadRecords()[0])})`);
ok(rk({result:null})===null,'結果未入力なら null');
ok(rk({result:{combo:'1-2-3'}})===null,'評価順が無い古い記録でも落ちない');

console.log('\n=== DE. 「何点買っていれば当たったか」の集計 ===');
w.localStorage.removeItem('boatai_records_v1');
// 結果順位が 3, 9, 24, 40 の4レースを作る
const ranks=[3,9,24,40];
ranks.forEach((target,i)=>{
  makeRace('2026-09-2'+i, 9, 6);
  const r=w.loadRecords()[0];
  const combo=r.ranking.split(',')[target-1];
  w.setResult(r.id, combo.replace(/-/g,''), '2000');
});
const st=w.recordStats(w.loadRecords());
console.log('  結果順位:', st.ranks.sort((a,b)=>a-b).join(', '));
ok(st.ranks.length===4,`4件ぶん記録 (${st.ranks.length})`);
ok(st.coverage[6]===1,`6点なら1件的中 (${st.coverage[6]})`);
ok(st.coverage[10]===2,`10点なら2件的中 (${st.coverage[10]})`);
ok(st.coverage[30]===3,`30点なら3件的中 (${st.coverage[30]})`);
ok(Math.abs(st.avgRank-19)<0.01,`平均順位 19 (${st.avgRank})`);
ok(st.medRank===24,`中央値 24 (${st.medRank})`);

console.log('\n=== DF. 画面表示 ===');
w.renderRecords();
const box=d.getElementById('recordList').textContent;
ok(box.includes('何番目に評価されていたか'),'診断の見出しを表示');
ok(box.includes('評価は合っており'),'読み方の説明がある');
ok(box.includes('平均'),'平均順位を表示');
ok(box.includes('番目の評価'),'個別記録にも順位を表示');
ok(box.includes('8点'),'点数ごとの的中率を表示');

console.log('\n=== DG. 既存の記録が壊れないか ===');
w.localStorage.setItem('boatai_records_v1', JSON.stringify([
  {id:'old',savedAt:'2026-09-01',date:'2026-09-01',jcd:'01',venueName:'桐生',rno:'1',
   order:[1,2,3,4,5,6],picks:[{combo:'1-2-3',amount:200,p:0.05}],rank:'B',
   result:{first:1,second:2,third:3,combo:'1-2-3',payout:500}}   // ranking なし
]));
const st2=w.recordStats(w.loadRecords());
ok(st2.done===1,'古い記録も集計できる');
ok(st2.tri===1,'的中判定は従来どおり');
ok(st2.ranks.length===0,'評価順が無い分は順位集計に入れない');
w.renderRecords();
ok(d.getElementById('recordList').textContent.includes('桐生'),'表示も崩れない');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
