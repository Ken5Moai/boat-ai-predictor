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

console.log('\n=== B. 結論は単勝を優先する ===');
setup(); w.generateReport();
{
  let t=d.getElementById('report').textContent;
  ok(t.includes('3連単'),'単勝オッズが無ければ3連単の結論を出す');
  ok(t.includes('単勝オッズを6つ入れると'),'単勝を入れるよう案内する');
  /* 1号艇に、分岐を大きく超える単勝オッズを付ける */
  const be=w.winEVList()[0].be;
  w.setWinOdds(1,(be*1.4).toFixed(1));
  w.generateReport();
  t=d.getElementById('report').textContent;
  ok(t.includes('単勝 1号艇 を買う'),`結論が単勝になる: ${(t.match(/単勝[^（]*（各[\d,]+円）/)||[''])[0]}`);
  ok(t.includes('3連単は買いません'),'3連単を買わないと明言する');
  ok(t.includes('8/11'),'なぜ単勝なのかを数字で示す');
  /* 分岐に届かない単勝なら、単勝は薦めない */
  w.setWinOdds(1,(be*0.5).toFixed(1));
  w.generateReport();
  t=d.getElementById('report').textContent;
  ok(!t.includes('単勝 1号艇 を買う'),'期待値が足りない単勝は薦めない');
}

console.log('\n=== C. 複数の艇が条件を満たす場合 ===');
setup(); w.buildProbabilities(w.scoreAll());
{
  const l=w.winEVList();
  w.setWinOdds(1,(l[0].be*1.3).toFixed(1));
  w.setWinOdds(3,(l[2].be*1.2).toFixed(1));
  w.generateReport();
  const t=d.getElementById('report').textContent;
  ok(/単勝 1号艇・3号艇 を買う/.test(t),'期待値の高い順に並べて両方出す');
  ok(/各600円/.test(t),`予算1,200円を2艇で割る: ${(t.match(/各[\d,]+円/)||[''])[0]}`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
