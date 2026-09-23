/* 配当の目安パネルと「当地記録なし」の扱い */
const fs=require('fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync('/home/user/boat-ai-predictor/index.html','utf8'),
 {runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

console.log('=== A. 損益分岐の配当を正しく出す ===');
const H=w.payoutHintHTML;
{
  const h=H([100,100,100,100,100,100,100,100,100,100,100,100]);
  ok(h.includes('1,200円'),'12点×100円なら分岐は1,200円');
  ok(h.includes('12点・合計1,200円'),'点数と合計を明示');
  ok(h.includes('当たっても損'),'当たっても損になる場合があると伝える');
  /* 開発時の実測 [790 890 1020 1400 4100 4240] のうち1,200円以上は3件 */
  ok(/的中した6レースのうち\s*<b>3件<\/b>/.test(h.replace(/\s+/g,' ')),
     `12点なら実測6件中3件しか超えない: ${(h.match(/的中した[\s\S]{0,60}/)||[''])[0].replace(/\s+/g,' ')}`);
  ok(h.includes('1,400円'),'配当の中央値を出す');
}
{
  const h=H([200,200,200,200,200,200]);
  ok(h.includes('1,200円'),'6点×200円でも分岐は1,200円');
}
{
  const h=H([300,300,300,300]);   /* 分岐400円 → 実測6件すべてが上回る */
  ok(h.includes('400円'),'4点×300円なら分岐は400円');
  ok(/的中した6レースのうち\s*<b>6件<\/b>/.test(h.replace(/\s+/g,' ')),
     '4点まで絞れば実測6件すべてが分岐を超える');
}
{
  /* 金額が不均等なら分岐も点ごとに変わる */
  const h=H([600,200,200,200]);
  ok(h.includes('〜'),'金額が不均等なら分岐を範囲で出す');
  ok(h.includes('200〜600円'),`分岐は 200〜600円 の範囲で出る`);
}
ok(H([])==='','買い目が無ければ何も出さない');
ok(H(null)==='','金額が未定なら何も出さない');
ok(!/高い配当|安い配当|中くらいの配当/.test(H([100,100,100,100])),
   '配当の規模は予想しない（7レースで外れたため）');

console.log('\n=== A2. 点数ごとの比較表 ===');
{
  const combos=[...Array(30)].map((_,i)=>({combo:`1-2-${i}`,p:0.03}));
  const t=w.pointsTableHTML(combos);
  ok(t.includes('4点')&&t.includes('12点')&&t.includes('20点'),'4〜20点を並べる');
  ok(t.includes('1,200円'),'12点の投資額と分岐を出す');
  ok(w.pointsTableHTML([])==='','買い目が無ければ表も出さない');
}

console.log('\n=== B. 当地記録なしは必須扱いにしない ===');
const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
const REG=['4529','3577','4173','4079','5460','4883'];
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
REG.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r; });
w.syncRegsFromInputs();
state.boats.forEach(b=>{
  setField(b,'grade','A2','official');
  setField(b,'nationalWinRate',5.0,'official');
  setField(b,'localWinRate',5.0,'official');
  setField(b,'motor2Rate',35,'official');
});
ok(w.validateAll().ready===true,'6艇そろえば生成可能');
/* 5号艇だけ当地記録なしにする */
w.boatOf(5).localWinRate=null; w.boatOf(5).localNone=true;
let v=w.validateAll();
ok(v.ready===true,'当地記録なしの艇がいても生成可能');
ok(v.forced!==true,'強制生成モードにならない');
/* 本当に欠けている場合は止まる */
w.boatOf(5).localNone=false;
v=w.validateAll();
ok(v.ready===false,'記録なしでもなければ従来どおり不足として止まる');
ok(v.missing.some(m=>m.includes('5号艇')&&m.includes('当地')),`不足に5号艇の当地が出る: ${v.missing[0]}`);
/* 登番を変えたら記録なしも消える */
w.boatOf(5).localNone=true;
d.getElementById('reg5').value='4064'; w.syncRegsFromInputs();
ok(w.boatOf(5).localNone===false,'登番を変えたら「記録なし」も初期化される');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
