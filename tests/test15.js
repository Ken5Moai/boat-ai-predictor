/* 配当の目安パネルと「当地記録なし」の扱い */
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

console.log('=== A. 損益分岐の配当を正しく出す ===');
const H=w.payoutHintHTML;
{
  const h=H(19.2,[100,100,100,100,100,100,100,100,100,100,100,100]);
  ok(h.includes('1,200円'),'12点×100円なら分岐は1,200円');
  ok(h.includes('12点・合計1,200円'),'点数と合計を明示');
  ok(h.includes('赤字'),'差が大きいときは赤字リスクを警告');
}
{
  const h=H(2.3,[200,200,200,200,200,200]);
  ok(h.includes('1,200円'),'6点×200円でも分岐は1,200円');
  ok(h.includes('高い配当'),'差が小さいときは高配当と伝える');
  ok(h.includes('広げる価値'),'差が小さいときは点数を広げる助言');
}
{
  const h=H(11.4,[300,300,300,300]);
  ok(h.includes('中くらいの配当'),'中間の差は中配当');
}
{
  /* 金額が不均等なら分岐も点ごとに変わる */
  const h=H(12,[600,200,200,200]);
  /* 総額1,200円。本線600円が当たれば6倍returnなので配当200円で元が取れる。
     押さえ200円が当たると2倍なので600円必要。 */
  ok(h.includes('200〜600円'),`分岐は 200円〜600円 の範囲で出る: ${h.match(/配当が[\s\S]{0,60}/)[0].replace(/\s+/g,' ')}`);
}
ok(H(10,[])==='','買い目が無ければ何も出さない');
ok(H(10,null)==='','金額が未定なら何も出さない');

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
