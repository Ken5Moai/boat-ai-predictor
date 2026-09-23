/* 期待値ごとの回収率が記録から集計できるか */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
const store={};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
 {runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

console.log('=== A. 期待値の帯ごとに回収率を出す ===');
const mk=(id,picks,combo,payout)=>({
  id, date:'2026-09-23', jcd:'18', rno:'1', picks,
  result: combo ? { combo, first:+combo[0], second:+combo[2], third:+combo[4], payout } : null
});
const list=[
  // 期待値1.97 の組が当たった（徳山2Rの形）
  mk('a',[{combo:'3-1-2',amount:100,p:0.046,ev:1.97},{combo:'1-3-2',amount:100,p:0.05,ev:0.60}],'3-1-2',4240),
  // 期待値0.35 の組が当たった（徳山1Rの形）。当たっても回収率は低い
  mk('b',[{combo:'1-2-4',amount:100,p:0.044,ev:0.35},{combo:'1-2-3',amount:100,p:0.06,ev:0.50}],'1-2-4',790),
  // 外れ
  mk('c',[{combo:'1-2-3',amount:100,p:0.07,ev:1.25},{combo:'2-1-3',amount:100,p:0.04,ev:0.80}],'4-5-6',3000),
];
const st=w.recordStats(list);
ok(st.evKnown===6,`買った6点ぶんを集計 (${st.evKnown})`);
const hi=st.byEV['1.50以上'], mid=st.byEV['1.20〜1.50'], low=st.byEV['1.00未満'];
ok(hi && hi.n===1 && hi.hit===1, '期待値1.50以上は1点・1的中');
ok(hi && Math.round(hi.back)===4240, `払戻4,240円 (${Math.round(hi&&hi.back)})`);
ok(mid && mid.n===1 && mid.hit===0, '期待値1.20〜1.50は1点・不的中');
ok(low && low.n===4 && low.hit===1, `期待値1.00未満は4点・1的中 (${low&&low.n}点 ${low&&low.hit}的中)`);
ok(low && Math.round(low.back)===790, '1.00未満の払戻は790円');
ok(Math.round(hi.back/hi.bet*100)===4240, `1.50以上の回収率 ${Math.round(hi.back/hi.bet*100)}%`);
ok(Math.round(low.back/low.bet*100)===198, `1.00未満の回収率 ${Math.round(low.back/low.bet*100)}%`);

console.log('\n=== B. 期待値が無い記録は帯に入れない ===');
const st2=w.recordStats([mk('d',[{combo:'1-2-3',amount:100,p:0.07}],'1-2-3',1500)]);
ok(st2.evKnown===0,'オッズを入れずに買った分は期待値の集計に入れない');
ok(Object.keys(st2.byEV).length===0,'帯が作られない');
ok(st2.tri===1,'的中数そのものは従来どおり数える');

console.log('\n=== C. 記録画面に表が出るか ===');
{
  w.localStorage.setItem('boatai_records_v1', JSON.stringify(list));
  w.renderRecords();
  const t = d.getElementById('recordList').textContent;
  ok(t.includes('期待値ごとの回収率'),'期待値ごとの回収率の表が出る');
  ok(t.includes('1.50以上'),'帯の見出しが出る');
  ok(t.includes('4240%')||t.includes('4,240'),'回収率か払戻が表示される');
  ok(t.includes('30点を超えたあたり'),'件数が少ないうちは注意書きが出る');
  // 期待値の記録が無ければ表そのものを出さない
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([
    mk('d',[{combo:'1-2-3',amount:100,p:0.07}],'1-2-3',1500)]));
  w.renderRecords();
  const t2 = d.getElementById('recordList').textContent;
  ok(!t2.includes('期待値ごとの回収率'),'期待値の記録が無ければ表を出さない');
}

console.log('\n=== D. 2つの損益分岐を説明しているか ===');
{
  const REG=['4064','4688','4686','4266','3783','3557'];
  const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REG.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r; });
  w.syncRegsFromInputs();
  state.boats.forEach((b,i)=>{
    setField(b,'grade','A2','official'); setField(b,'nationalWinRate',5+i*0.2,'official');
    setField(b,'localWinRate',5,'official'); setField(b,'motor2Rate',30+i,'official');
  });
  d.getElementById('venue').value='18'; d.getElementById('raceDate').value='2026-09-23';
  d.getElementById('raceNo').value='1';
  w.validateAll(); w.generateReport();
  const t=d.getElementById('report').textContent;
  ok(t.includes('損益分岐は2つある'),'2つの損益分岐を説明する見出しがある');
  ok(t.includes('1 ÷ その組の確率'),'その組の分岐を示す');
  ok(t.includes('点数 × 100円'),'レース全体の分岐を示す');
  ok(t.includes('決めるのは①'),'どちらで判断するか明示する');
  ok(t.includes('オッズが安い組だけ金額を上げる'),'やってはいけないことを明示する');
  // 金額配分は確率に比例している（確率1位がいちばん厚い）
  const rows=[...d.querySelectorAll('.betrow')];
  const amt=rows.map(e=>Number(e.querySelector('.betamt').textContent.replace(/[^0-9]/g,'')));
  ok(amt[0]>=amt[amt.length-1],`確率が高い組ほど厚い (${amt[0]}円 ≧ ${amt[amt.length-1]}円)`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
