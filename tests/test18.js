/* 単勝（1着だけを買う）の期待値 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
 {runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
const REG=['3641','5090','4675','5329','4016','5453'];
function setup(){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REG.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r; });
  w.syncRegsFromInputs();
  [[ 'A1',6.09],['B1',5.16],['A2',5.69],['B1',4.54],['B1',5.50],['B2',2.03]].forEach(([g,n],i)=>{
    const b=w.boatOf(i+1);
    setField(b,'grade',g,'official'); setField(b,'nationalWinRate',n,'official');
    setField(b,'localWinRate',5,'official'); setField(b,'motor2Rate',32,'official');
  });
  d.getElementById('venue').value='10'; d.getElementById('raceDate').value='2026-09-24';
  d.getElementById('raceNo').value='3'; d.getElementById('budget').value='1200';
  state.oddsMap={}; state.winOddsMap={};
  w.validateAll();
}

console.log('=== A. 損益分岐と期待値 ===');
setup(); w.buildProbabilities(w.scoreAll());
{
  const l=w.winEVList();
  ok(l.length===6,'6艇ぶん出る');
  const b1=l[0];
  ok(Math.abs(b1.be - 1/b1.p) < 1e-9, `1号艇の損益分岐は確率の逆数 ${b1.be.toFixed(1)}倍（確率${(b1.p*100).toFixed(1)}%）`);
  ok(b1.ev===null && b1.odds===null,'オッズ未入力なら期待値は出さない');
  w.setWinOdds(1, (b1.be*1.5).toFixed(1));
  const l2=w.winEVList();
  ok(Math.abs(l2[0].ev - l2[0].p*l2[0].odds) < 1e-9,
     `期待値は 確率×オッズ (${(l2[0].p*100).toFixed(1)}% × ${l2[0].odds}倍 = ${l2[0].ev.toFixed(2)})`);
  ok(l2[0].ev > 1.4, `分岐を1.5倍上回るオッズなら期待値も1.4超 (${l2[0].ev.toFixed(2)})`);
  /* 単勝の控除率は20%。市場の推定確率は 0.80÷オッズ */
  ok(Math.abs(l2[0].market - 0.80/l2[0].odds) < 1e-9,
     `市場の推定確率は 0.80÷オッズ (${(l2[0].market*100).toFixed(1)}%)`);
  w.setWinOdds(1,'');
  ok(w.winEVList()[0].ev===null,'空にすると消える');
  w.setWinOdds(1,'0.8');
  ok(w.winEVList()[0].ev===null,'1.0以下のオッズは受け付けない');
}

console.log('\n=== B. 単勝は結論に出さない ===');
/* 実測8レースの回収率が 1点78% / 2点73% / 3点60% と一度も100%を超えず、
   1着の予想も「常に1号艇」と同じ8/11だったため、単勝は薦めない。
   入力欄は損益分岐を見る材料として残す。 */
setup(); w.buildProbabilities(w.scoreAll());
{
  const be = w.winEVList()[0].be;
  w.setWinOdds(1, (be*3).toFixed(1));   /* 期待値3.0の単勝を用意する */
  w.generateReport();
  const t = d.getElementById('report').textContent;
  ok(w.winEVList()[0].ev > 2.5, `期待値2.5超の単勝がある (${w.winEVList()[0].ev.toFixed(2)})`);
  ok(!/単勝[^。]*を買う/.test(t), 'それでも結論に単勝を出さない');
  ok(t.includes('3連単') || t.includes('見送り'), '結論は3連単か見送りのまま');
}

console.log('\n=== C. 単勝が薦められない理由を画面に書いてある ===');
{
  const box = d.getElementById('winOddsRow').parentElement.textContent;
  ok(box.includes('単勝は薦めません'), '薦めないと明記する');
  ok(box.includes('8/11'), '1着の予想が「常に1号艇」と同成績だと示す');
  ok(box.includes('100%を超えていません'), '実測の回収率を示す');
  ok(d.getElementById('winOddsRow').querySelectorAll('input').length===6, '入力欄は6つ残す');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
