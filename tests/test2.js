const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('Load failed')};
  w.alert=()=>{};w.confirm=()=>false;}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat');

const R=[
 {lane:1,reg:'4064',g:'A1',nm:'原田 篤志',br:'福岡/福岡',st:'0.15',nat:['6.32','45.83','30.56'],loc:['6.20','44.00','28.00'],mot:['54','57.84','40.00'],boa:['18','50.00','35.00']},
 {lane:2,reg:'4688',g:'A2',nm:'永井 彪也',br:'東京/東京',st:'0.16',nat:['5.88','38.10','25.00'],loc:['5.40','35.00','22.00'],mot:['31','51.19','33.00'],boa:['22','41.00','29.00']},
 {lane:3,reg:'4686',g:'A1',nm:'丸野 一樹',br:'滋賀/滋賀',st:'0.14',nat:['7.05','52.00','36.00'],loc:['6.90','50.00','34.00'],mot:['7','70.00','48.00'],boa:['9','55.00','38.00']},
 {lane:4,reg:'4266',g:'B1',nm:'長田 頼宗',br:'東京/東京',st:'0.18',nat:['4.90','28.00','18.00'],loc:['4.70','27.00','17.00'],mot:['48','47.62','30.00'],boa:['33','39.00','26.00']},
 {lane:5,reg:'3783',g:'A2',nm:'瓜生 正義',br:'福岡/福岡',st:'0.17',nat:['6.10','42.00','29.00'],loc:['6.00','41.00','28.00'],mot:['12','50.48','32.00'],boa:['41','44.00','31.00']},
 {lane:6,reg:'3557',g:'B1',nm:'太田 和美',br:'大阪/大阪',st:'0.20',nat:['4.55','24.00','15.00'],loc:['4.40','23.00','14.00'],mot:['60','49.04','31.00'],boa:['5','38.00','25.00']}];

// 形式1: iPhone Safari で全選択コピーした素のテキスト（改行区切り）
const safariText = `ボートレース住之江\n11R 一般\n\n`+R.map(r=>
`${r.lane}\n${r.reg} / ${r.g}\n${r.nm}\n${r.br}\n45歳/52.0kg\nF0\nL0\n${r.st}\n`+
`${r.nat.join('\n')}\n${r.loc.join('\n')}\n${r.mot.join('\n')}\n${r.boa.join('\n')}\n1\n3\n2\n`).join('\n');

// 形式2: r.jina.ai が返す Markdown テーブル（パイプ+スペース区切り）
const jinaMd = `Title: ボートレース住之江\n\n| 枠 | 写真 | 選手 | F/L/ST | 全国 | 当地 | モーター | ボート |\n|---|---|---|---|---|---|---|---|\n`+
R.map(r=>`| ${r.lane} |  | ${r.reg} / ${r.g} ${r.nm} ${r.br} 45歳/52.0kg | F0 L0 ${r.st} | ${r.nat.join(' ')} | ${r.loc.join(' ')} | ${r.mot.join(' ')} | ${r.boa.join(' ')} |`).join('\n');

// 形式3: <br>が消えて小数どうしが連結したケース
const concatMd = R.map(r=>`| ${r.lane} | ${r.reg} / ${r.g}${r.nm}${r.br}45歳/52.0kg | F0L0${r.st} | ${r.nat.join('')} | ${r.loc.join('')} | ${r.mot[0]} ${r.mot.slice(1).join('')} | ${r.boa[0]} ${r.boa.slice(1).join('')} |`).join('\n');

// 形式4: モーター番号まで完全に連結した最悪ケース（曖昧なので採用してはいけない）
const evilMd = R.map(r=>`| ${r.lane} | ${r.reg} / ${r.g}${r.nm} | F0L0${r.st}${r.nat.join('')}${r.loc.join('')}${r.mot.join('')}${r.boa.join('')} |`).join('\n');

function reset(){ state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  R.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r.reg;}); w.syncRegsFromInputs(); }

function checkAll(label){
  let good=0;
  R.forEach((r,i)=>{ const b=w.boatOf(i+1);
    if(V(b.nationalWinRate)===Number(r.nat[0]) && V(b.localWinRate)===Number(r.loc[0]) &&
       V(b.motor2Rate)===Number(r.mot[1]) && V(b.grade)===r.g) good++; });
  ok(good===6,`${label}: 6艇すべて 全国/当地/モーター/級別が正確 (${good}/6)`);
}

console.log('\n=== U. iPhone Safari のコピペテキスト（最重要ルート） ===');
reset();
const rowsA=w.parseRacelistText(safariText).filter(r=>r.shapeOK);
ok(rowsA.length===6,`6艇を解析 (got ${rowsA.length})`);
w.applyRacelistRows(rowsA,'verified'); checkAll('Safariコピペ');
ok(V(w.boatOf(1).name)==='原田篤志',`選手名も取得 (${V(w.boatOf(1).name)})`);
ok(V(w.boatOf(1).averageST)===0.15,'平均STも取得');
ok(V(w.boatOf(3).motorNumber)===7,'1桁のモーター番号も正確');

console.log('\n=== V. r.jina.ai の Markdown 出力 ===');
reset();
const rowsB=w.parseRacelistAny(jinaMd);
ok(rowsB.length===6,`6艇を解析 (got ${rowsB.length})`);
w.applyRacelistRows(rowsB,'verified'); checkAll('jina Markdown');

console.log('\n=== W. 小数が連結した崩れたテキスト ===');
ok(w.splitConcatNumbers('6.3245.8330.56')==='6.32 45.83 30.56',
   `連結数値を分割: "6.3245.8330.56" → "${w.splitConcatNumbers('6.3245.8330.56')}"`);
ok(w.splitConcatNumbers('6.32 45.83 30.56')==='6.32 45.83 30.56','正常なテキストは変化させない');
reset();
const rowsC=w.parseRacelistAny(concatMd);
ok(rowsC.length===6,`6艇を解析 (got ${rowsC.length})`);
w.applyRacelistRows(rowsC,'verified'); checkAll('連結テキスト');

console.log('\n=== X. 曖昧すぎる入力は採用しない（間違えるくらいなら空欄） ===');
reset();
const rowsD=w.parseRacelistText(evilMd);
const badShape=rowsD.filter(r=>!r.shapeOK).length;
const applied=w.applyRacelistRows(rowsD.filter(r=>r.shapeOK),'verified');
let wrong=0;
R.forEach((r,i)=>{ const b=w.boatOf(i+1);
  const nat=V(b.nationalWinRate), mot=V(b.motor2Rate);
  if(nat!==null && nat!==Number(r.nat[0])) wrong++;
  if(mot!==null && mot!==Number(r.mot[1])) wrong++; });
ok(wrong===0,`区切り不能な入力から誤った数値を1件も採用しない (誤採用${wrong}件 / 拒否${badShape}艇)`);

console.log('\n=== Y. 艇番→登録番号の読み取り（入力補助） ===');
const pairs=w.parseLaneRegPairs(safariText);
ok(pairs.length===6,`6組を検出 (got ${pairs.length})`);
ok(pairs.every(p=>R[p.lane-1].reg===p.reg),
   `艇番と登番の対応が正しい: ${pairs.map(p=>p.lane+'→'+p.reg).join(' ')}`);
const pairsMd=w.parseLaneRegPairs(jinaMd);
ok(pairsMd.length===6&&pairsMd.every(p=>R[p.lane-1].reg===p.reg),'Markdown形式でも正しく対応');

console.log('\n=== Z. 貼り付けUIの自動判別 ===');
reset();
d.getElementById('pasteBox').value=safariText;
w.parsePasted('auto');
ok(d.getElementById('pasteNotice').textContent.includes('出走表'),'出走表として自動判別');
checkAll('自動判別');
reset();
d.getElementById('pasteBox').value=`スタート展示\n1 .07\n2 .04\n3 F.06\n4 .12\n5 .27\n6 .09\n水面気象情報 気温 24.0℃ 風速 5m 波高 3cm 水温 21.0℃`;
w.parsePasted('auto');
ok(d.getElementById('pasteNotice').textContent.includes('直前情報'),'直前情報として自動判別');
ok(V(w.boatOf(3).exhibitionST)===0.06&&w.boatOf(3).exhibitionSTFlag==='F','貼り付けからF.06を正しく取得');
ok(V(state.conditions.windSpeed)===5,'風速も取得');
reset();
d.getElementById('pasteBox').value='これはただの文章です。レース情報は含まれていません。';
w.parsePasted('auto');
ok(d.getElementById('pasteNotice').textContent.includes('判断できませんでした'),'無関係な内容は明確に拒否');

console.log('\n=== AA. 通信経路の設定 ===');
const PX=w.eval('PROXIES');
ok(PX.length>=7,`取得経路が${PX.length}本ある`);
ok(PX[0].name==='jina','v15で実績のある経路を最優先にしている');
ok(PX.some(p=>p.kind==='json'),'JSON形式で返す経路にも対応');
ok(!PX.some(p=>p.name==='isomorphic'),'任意URLに使えない壊れた経路を除去');
ok(typeof w.runConnectionTest==='function','通信テスト機能がある');
ok(d.getElementById('btnConnTest')!==null,'通信テストボタンが画面にある');
ok(d.getElementById('pasteDetails')!==null,'貼り付け欄が画面にある');

(async()=>{
  console.log('\n=== AB. 全経路が死んだ時の案内 ===');
  reset();
  d.getElementById('raceDate').value='2026-09-22';
  d.getElementById('venue').value='12'; d.getElementById('raceNo').value='11';
  await w.fetchRacelist();
  const t=d.getElementById('raceNotice').textContent;
  ok(t.includes('コピー')||t.includes('貼り付け'),'代替手段（貼り付け）を案内する');
  ok(t.includes('消していません'),'入力を保持する旨を案内');
  ok(d.getElementById('pasteDetails').open===true,'貼り付け欄を自動で開く');
  ok(V(w.boatOf(1)?w.boatOf(1).registrationNumber?{value:w.boatOf(1).registrationNumber}:null:null)==='4064'
     ||w.boatOf(1).registrationNumber==='4064','登録番号は消えない');
  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exit(fail?1:0);
})();
