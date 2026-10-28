/* モデルに渡す項目名が、モデルが実際に読む名前と合っているか
   ------------------------------------------------------------------
   2026-10-23に実際にやった失敗。
   若松11Rの予想を出すとき、使い捨てのスクリプトを書いてモデルを呼んだ。
   そこで項目名を2つ取り違えていた。

     正しい              書いてしまった
     averageST           avgST
     b.flagF（素の値）    setField(b,'flyingCount',...)

   setField は key を検査しない。知らない名前を渡すと、黙って新しい
   キーを作るだけで、採点には一切使われない。エラーも警告も出ない。
   その結果、平均STとF数が届かないまま採点され、
     買い目は19点中17点しか合わず、
     正解の組の確率は 12.22% ではなく 7.92% と出た。
   順位の並びがそれらしく出てしまうので、見ただけでは気づけない。

   このテストは「黙って落ちる」のを防ぐ。
     ① newBoat() が持っていない名前を setField に渡していないか
     ② 取り違えた名前（avgST / flyingCount）は本当に効かないことを示す
     ③ 正しい名前（averageST / flagF）は本当に採点を動かすことを示す */
const fs=require('fs'),path=require('path');
const {JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
const BT=fs.readFileSync(path.join(DIR,'backtest.js'),'utf8');

function win(){
  const d=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
    beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  d.window.Element.prototype.scrollIntoView=function(){};
  return d.window;
}
const w = win();
const newBoat = w.eval('newBoat');
const known = new Set(Object.keys(newBoat(1)));

console.log('\n=== backtest.js が setField に渡す名前は、newBoat が持っているか ===');
const used = [...BT.matchAll(/setField\(\s*b\s*,\s*'([A-Za-z0-9_]+)'/g)].map(m=>m[1]);
ok(used.length >= 8, `setField の呼び出しを ${used.length}件 見つけた`);
for(const k of [...new Set(used)]){
  ok(known.has(k), `'${k}' は newBoat が持っている項目`);
}

console.log('\n=== 素のプロパティで入れているものも、モデルが読んでいるか ===');
for(const k of ['flagF','flagL','exhibitionSTFlag','entryCourse','recentRaces','recentSource','partsChange']){
  const inBT = new RegExp('b\\.'+k+'\\s*=').test(BT);
  const inHTML = new RegExp('\\b'+k+'\\b').test(HTML);
  if(inBT) ok(inHTML, `b.${k} は index.html にも出てくる`);
}

console.log('\n=== 取り違えた名前は効かない／正しい名前は効く ===');
/* 6艇を最低限そろえて採点し、スコアが動くかどうかで確かめる */
function scoreWith(apply){
  const w2 = win();
  const st = w2.eval('state'), newB = w2.eval('newBoat'), sf = w2.eval('setField');
  const d2 = w2.document;
  st.boats.forEach((b,i)=>Object.assign(b, newB(i+1)));
  ['4036','4803','4771','5177','4394','4572'].forEach((r,i)=>{ d2.getElementById('reg'+(i+1)).value=r; });
  w2.syncRegsFromInputs();
  const base=[[6.32,6.33,35.91,28.26],[3.92,2.50,30.88,47.78],[6.83,7.13,38.24,34.15],
              [4.68,4.96,38.50,31.76],[6.13,5.49,30.77,22.89],[5.03,6.86,35.48,37.21]];
  base.forEach((v,i)=>{
    const b=w2.boatOf(i+1);
    sf(b,'name','選手'+(i+1),'official'); sf(b,'grade','A1','official');
    sf(b,'nationalWinRate',v[0],'official'); sf(b,'localWinRate',v[1],'official');
    sf(b,'motor2Rate',v[2],'official');      sf(b,'boat2Rate',v[3],'official');
    sf(b,'exhibitionTime',6.9,'official');   sf(b,'exhibitionST',0.10,'official');
    sf(b,'weight',52,'official');
    apply(b, sf);
  });
  d2.getElementById('venue').value='20'; d2.getElementById('raceNo').value='11';
  w2.scoreAll();
  return st.boats.map(b=>Math.round(b.score*100)/100);
}
const none  = scoreWith(()=>{});
const right = scoreWith((b,sf)=>{ sf(b,'averageST', b.lane===1?0.10:0.25, 'official'); });
const wrong = scoreWith((b,sf)=>{ sf(b,'avgST',     b.lane===1?0.10:0.25, 'official'); });
ok(JSON.stringify(right)!==JSON.stringify(none),
   `正しい名前 averageST は採点を動かす（${none[0]} → ${right[0]}）`);
ok(JSON.stringify(wrong)===JSON.stringify(none),
   `取り違えた avgST は何も起きない（黙って落ちる）  ${wrong[0]} = ${none[0]}`);

const fRight = scoreWith((b)=>{ b.flagF = b.lane===1 ? 2 : 0; });
const fWrong = scoreWith((b,sf)=>{ sf(b,'flyingCount', b.lane===1?2:0, 'official'); });
ok(JSON.stringify(fRight)!==JSON.stringify(none),
   `正しい入れ方 b.flagF は採点を動かす（${none[0]} → ${fRight[0]}）`);
ok(JSON.stringify(fWrong)===JSON.stringify(none),
   `取り違えた flyingCount は何も起きない  ${fWrong[0]} = ${none[0]}`);

console.log('\n=== 買い目を出す道は1本か ===');
ok(BT.includes('至極の一点'),
   'buy目は backtest.js の結果まち節（runWith を通る唯一の道）から出る');
ok(BT.includes('使い捨てのスクリプトでモデルを呼ばないこと'),
   '使い捨てスクリプトを禁じる注意書きが残っている');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
