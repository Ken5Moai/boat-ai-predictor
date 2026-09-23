const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{};}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat');
const REGS=['4064','4688','4686','4266','3783','3557'];
function reset(){ state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REGS.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r;}); w.syncRegsFromInputs(); }

// スマホ版出走表のスクショOCR想定（見出し語あり・丸囲み数字混入）
const MOBILE_OCR = `出走表 住之江 12R
1 4064 / A1 原田 篤志
福岡/福岡 45歳 52.0kg
全国 6.32 当地 6.20
モーター 54 57.84  ボート 18 50.00
F0 L0 平均ST 0.15
2 4688 / A2 永井 彪也
東京/東京 31歳 51.5kg
全国 5.88 当地 5.40
モーター ③① 51.19  ボート 22 41.00
F1 L0 平均ST 0.16
3 4686 / A1 丸野 一樹
滋賀/滋賀 33歳 52.0kg
全国 7.05 当地 ⑥.⑨0
モーター 7 70.00  ボート 9 55.00
F0 L0 平均ST 0.14
4 4266 / B1 長田 頼宗
東京/東京 40歳 53.0kg
全国 4.90 当地 4.70
モーター 48 47.62  ボート 33 39.00
F0 L0 平均ST 0.18
5 3783 / A2 瓜生 正義
福岡/福岡 45歳 52.0kg
全国 6.10 当地 6.00
モーター 12 50.48  ボート 41 44.00
F0 L1 平均ST 0.17
6 3557 / B1 太田 和美
大阪/大阪 50歳 51.0kg
全国 4.55 当地 4.40
モーター 60 49.04  ボート 5 38.00
F0 L0 平均ST 0.20`;

console.log('\n=== AJ. 出走表スクショOCR（登録番号を軸に読む） ===');
reset();
const recs=w.extractRacelistFromOCR([MOBILE_OCR]);
ok(recs.length===6&&recs.every(r=>r.found),`6艇すべて登番で発見 (${recs.filter(r=>r.found).length}/6)`);
const res=w.applyRacelistOCR(recs);
const EXP=[[6.32,6.20,57.84,'A1','原田篤志'],[5.88,5.40,51.19,'A2','永井彪也'],
           [7.05,6.90,70.00,'A1','丸野一樹'],[4.90,4.70,47.62,'B1','長田頼宗'],
           [6.10,6.00,50.48,'A2','瓜生正義'],[4.55,4.40,49.04,'B1','太田和美']];
let allOK=0;
EXP.forEach((e,i)=>{ const b=w.boatOf(i+1);
  if(V(b.nationalWinRate)===e[0]&&V(b.localWinRate)===e[1]&&V(b.motor2Rate)===e[2]
     &&V(b.grade)===e[3]&&V(b.name)===e[4]) allOK++; });
ok(allOK===6,`6艇すべて 全国/当地/モーター/級別/選手名が正確 (${allOK}/6)`);
ok(V(w.boatOf(3).localWinRate)===6.90,`丸囲み「⑥.⑨0」→ 6.90 を復元 (got ${V(w.boatOf(3).localWinRate)})`);
ok(V(w.boatOf(2).motor2Rate)===51.19,`丸囲み「③①」のモーター番号でも2連率は正確 (got ${V(w.boatOf(2).motor2Rate)})`);
ok(V(w.boatOf(2).motorNumber)===31,'丸囲みのモーター番号31も復元');
ok(V(w.boatOf(1).averageST)===0.15,'平均STも取得');
ok(V(w.boatOf(3).motorNumber)===7,'1桁のモーター番号7も正確');
ok(w.boatOf(2).flagF===1,'2号艇のF1持ちを取得');
ok(w.boatOf(5).flagL===1,'5号艇のL1持ちを取得');
ok(V(w.boatOf(1).boat2Rate)===50.00,'ボート2連率も取得');

console.log('\n=== AK. 入力順がバラバラでも登番で正しい艇へ ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
const shuffled=['3557','4686','3783','4064','4266','4688'];
shuffled.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r;});
w.syncRegsFromInputs();
w.applyRacelistOCR(w.extractRacelistFromOCR([MOBILE_OCR]));
ok(V(w.boatOf(1).name)==='太田和美'&&V(w.boatOf(1).nationalWinRate)===4.55,
   `1号艇に登番3557のデータ (${V(w.boatOf(1).name)} 全国${V(w.boatOf(1).nationalWinRate)})`);
ok(V(w.boatOf(4).name)==='原田篤志'&&V(w.boatOf(4).motor2Rate)===57.84,
   `4号艇に登番4064のデータ (${V(w.boatOf(4).name)} M${V(w.boatOf(4).motor2Rate)})`);

console.log('\n=== AL. 一部しか写っていないスクショ（詰めない） ===');
reset();
const partial=MOBILE_OCR.split('\n').slice(0,12).join('\n');  // 1〜2号艇ぶんだけ
const r2=w.applyRacelistOCR(w.extractRacelistFromOCR([partial]));
ok(V(w.boatOf(1).nationalWinRate)===6.32,'写っている1号艇は取得');
ok(V(w.boatOf(2).nationalWinRate)===5.88,'写っている2号艇も取得');
[3,4,5,6].forEach(l=>ok(V(w.boatOf(l).nationalWinRate)===null,`${l}号艇は空欄のまま（繰り上げない）`));
ok(r2.missing.length===4,`不足している4艇（3〜6号艇）をすべて明示 (${r2.missing.length}件)`);
ok(r2.missing.some(m=>m.includes('3号艇')),'名前だけ読めた3号艇も「不足」として報告');

console.log('\n=== AM. 複数枚のスクショを合成 ===');
reset();
const p1=MOBILE_OCR.split('\n').slice(0,12).join('\n');
const p2=MOBILE_OCR.split('\n').slice(12).join('\n');
w.applyRacelistOCR(w.extractRacelistFromOCR([p1,p2]));
let all=0; EXP.forEach((e,i)=>{ if(V(w.boatOf(i+1).nationalWinRate)===e[0]) all++; });
ok(all===6,`2枚に分けても6艇そろう (${all}/6)`);

console.log('\n=== AN. 誤読への耐性（異常値・曖昧は採用しない） ===');
reset();
const broken=MOBILE_OCR.replace('全国 6.32','全国 0.32').replace('モーター 54 57.84','モーター 54 578.4');
w.applyRacelistOCR(w.extractRacelistFromOCR([broken]));
ok(V(w.boatOf(1).nationalWinRate)===null,
   `[過去バグ2] 誤読された全国勝率0.32は採用しない (got ${V(w.boatOf(1).nationalWinRate)})`);
ok(V(w.boatOf(1).motor2Rate)===null||V(w.boatOf(1).motor2Rate)<=100,
   `範囲外のモーター2連率578.4は採用しない (got ${V(w.boatOf(1).motor2Rate)})`);
ok(V(w.boatOf(2).nationalWinRate)===5.88,'他の艇は影響を受けない');

console.log('\n=== AO. 公式取得・手入力がOCRを上書きできる ===');
reset();
w.applyRacelistOCR(w.extractRacelistFromOCR([MOBILE_OCR]));
ok(w.boatOf(1).nationalWinRate.confidence==='ocr-medium','OCR由来として記録される');
w.eval('setField')(w.boatOf(1),'nationalWinRate',6.55,'official');
ok(V(w.boatOf(1).nationalWinRate)===6.55,'公式取得がOCRを上書きできる');
w.manualEdit(1,'nationalWinRate','6.77');
ok(V(w.boatOf(1).nationalWinRate)===6.77,'手入力が最優先');

console.log('\n=== AP. スクショだけで予想まで到達できるか（E2E） ===');
reset();
d.getElementById('raceDate').value='2026-09-21';
d.getElementById('venue').value='12'; d.getElementById('raceNo').value='12';
d.getElementById('budget').value='1000';
w.applyRacelistOCR(w.extractRacelistFromOCR([MOBILE_OCR]));
const v=w.validateAll();
ok(v.ready===true,'スクショ1枚で必須データが揃う（通信ゼロ）');
ok(d.getElementById('btnGen').disabled===false,'予想生成ボタンが有効になる');
w.generateReport();
const rep=d.getElementById('report').textContent;
ok(rep.length>500,`レポート生成 (${rep.length}文字)`);
ok(d.querySelectorAll('.betrow').length===6,'買い目6点');
const tot=[...d.querySelectorAll('.betamt')].map(e=>Number(e.textContent.replace(/[^0-9]/g,''))).reduce((a,b)=>a+b,0);
ok(tot<=1000&&tot>=900,`購入合計 ${tot}円`);
ok(rep.includes('住之江'),'競艇場名が正しい');

console.log('\n=== AQ. UIがスマホ単独で完結する構成か ===');
ok(d.getElementById('fRacelist')!==null,'出走表スクショの入力欄がある');
ok(d.getElementById('fRacelist').hasAttribute('multiple'),'複数枚を選べる');
ok(d.getElementById('fEx').hasAttribute('multiple'),'展示スクショも複数枚選べる');
ok(d.getElementById('p3').textContent.includes('通信不要'),'通信不要の方法が明示されている');
ok(typeof w.runRacelistOCR==='function','スクショ読み取り機能がある');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
