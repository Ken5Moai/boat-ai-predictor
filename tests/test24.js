/* 資金管理 ― 減り方を自分で決めるための仕掛け
   ------------------------------------------------------------------
   29レース測っても、市場に勝てる根拠は見つかっていない。
   控除率25%があるので期待値はマイナスから始まる。
   つまりこの作りで本当に効くのは「いくら賭けるか」だけ。

   だから、ここだけは壊れてはいけない：
     ・1レースの金額は上限÷レース数で決まり、手で増やせない
     ・使った額は日付つきで残り、日が変わればリセットされる
     ・上限に届いたら結論カードが「今日はもう買いません」に変わる
   「負けたあとに賭け金を上げる」を仕組みで塞ぐのが目的。 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

function makeDom(){
  const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
   {runScripts:'dangerously',url:'https://ken5moai.github.io/',
    beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.alert=()=>{};
      w.confirm=()=>true; w.fetch=async()=>{throw new Error('x')}; }});
  dom.window.Element.prototype.scrollIntoView=function(){};
  return dom;
}
const dom=makeDom(), w=dom.window, d=dom.window.document;
const set=(cap,races)=>{ d.getElementById('dayCap').value=String(cap);
  d.getElementById('dayRaces').value=String(races); w.onBankChange(); };

console.log('\n1レースの金額は上限とレース数から決まる');
set(5000,5); ok(w.perRace()===1000, '5,000円 ÷ 5レース = 1,000円');
set(3000,4); ok(w.perRace()===700,  '3,000円 ÷ 4レース = 700円（100円単位に切り下げ）');
set(300,5);  ok(w.perRace()===100,  '端数でも最低100円は下回らない');
set(5000,5);
ok(d.getElementById('budget').value==='1000', '購入額の欄に反映される');
ok(d.getElementById('budget').hasAttribute('readonly'), '購入額は手で書き換えられない');

console.log('\n使った額が積み上がる');
w.resetDay(); set(3000,3);
ok(w.bankState().used===0, '最初は0円');
w.markBought();
ok(w.bankState().used===1000 && w.bankState().races===1, '1レース買うと1,000円・1レース');
w.markBought(); w.markBought();
ok(w.bankState().used===3000 && w.bankState().races===3, '3レースで3,000円');

console.log('\n上限に届いたら止まる');
ok(w.bankState().done===true, '残りが1レースぶんに満たなければ「今日は終わり」');
ok(/今日はここまで/.test(d.getElementById('bankBox').textContent), '画面にそう出る');
const used=w.bankState().used;
w.markBought();
ok(w.bankState().used===used, '打ち止め後は「買った」を押しても増えない');

console.log('\n上限を上げれば続けられてしまうが、そこは警告する');
ok(/上限を上げるのが、いちばんよくある負け方/.test(d.getElementById('bankBox').textContent),
   '上限を上げることの危うさを名指しする');

console.log('\n日付が変わればリセットされる');
w.resetDay();
ok(w.bankState().used===0, 'やり直せる');
{
  /* 保存されている日付を昨日にして、読み直す */
  const raw=JSON.parse(dom.window.localStorage.getItem('boat-bank-v1'));
  raw.used=9999; raw.races=9; raw.day='2000-01-01';
  dom.window.localStorage.setItem('boat-bank-v1', JSON.stringify(raw));
  ok(w.loadBank().used===0, '日付が違えば使用額は0から');
}

console.log('\n結論カードが打ち止めを最優先で言う');
{
  const dom2=makeDom(), w2=dom2.window, d2=dom2.window.document;
  d2.getElementById('dayCap').value='1000'; d2.getElementById('dayRaces').value='1';
  w2.onBankChange(); w2.markBought();
  ok(w2.bankState().done===true, '1レース買って打ち止めの状態を作る');
  /* 予想を出せる状態にして、結論が打ち止め表示になることを見る */
  const st=w2.eval('state'), newBoat=w2.eval('newBoat'), setField=w2.eval('setField');
  st.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  ['4396','3859','3710','3284','5078','4750'].forEach((r,i)=>{ d2.getElementById('reg'+(i+1)).value=r; });
  w2.syncRegsFromInputs();
  for(let i=0;i<6;i++){ const b=w2.boatOf(i+1);
    setField(b,'name','選手'+(i+1),'official'); setField(b,'grade','B1','official');
    setField(b,'nationalWinRate',5.0,'official'); setField(b,'localWinRate',5.0,'official');
    setField(b,'motor2Rate',30,'official'); setField(b,'boat2Rate',30,'official');
    setField(b,'averageST',0.17,'official'); setField(b,'exhibitionTime',6.85,'official');
    setField(b,'exhibitionST',0.10,'official'); }
  d2.getElementById('venue').value='19'; d2.getElementById('raceNo').value='1';
  d2.getElementById('raceDate').value='2026-09-24';
  w2.validateAll();
  w2.generateReport();
  const html=d2.getElementById('report').textContent;
  ok(/今日はもう買いません/.test(html), '結論が「今日はもう買いません」になる');
  ok(/上限を上げないでください/.test(html), '上限を上げるなと言う');
  ok(/見るだけにして/.test(html), '予想自体は見られると伝える');
}

console.log('\n期待値方式は既定で使わない');
{
  const dom3=makeDom(), w3=dom3.window, d3=dom3.window.document;
  ok(d3.getElementById('useEV').checked===false, '既定でチェックが外れている');
  const cands=[{combo:'1-2-3',p:0.20},{combo:'6-5-4',p:0.001}];
  w3.eval('state').oddsMap={'1-2-3':5.0,'6-5-4':3000};
  ok(w3.choosePoints(cands.map(c=>({...c})),12).mode==='prob', '確率の高い順で選ぶ');
  ok(/2\/19|回収率59%/.test(d3.body.innerHTML), 'なぜ使わないかを実測値で書いてある');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
