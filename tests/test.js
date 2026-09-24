const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'), {JSDOM}=require('jsdom');
const html=fs.readFileSync(HTML_PATH,'utf8');

let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const dom=new JSDOM(html,{runScripts:'dangerously',pretendToBeVisual:true,
  beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.fetch=async()=>{throw new Error('offline')}; w.alert=()=>{}; w.confirm=()=>false; w.scrollTo=()=>{}; }});
const w=dom.window, d=w.document;
// const宣言はwindowプロパティにならないため global eval で取得
const V=w.eval('V'), has=w.eval('has'), state=w.eval('state'),
      newBoat=w.eval('newBoat'), TOTAL_WEIGHT=w.eval('TOTAL_WEIGHT'),
      CONF=w.eval('CONF'), VENUES=w.eval('VENUES');
w.Element.prototype.scrollIntoView=function(){};

// ---- synthetic racelist mimicking boatrace.jp structure ----
const ROWS=[
 {lane:1,reg:'4064',g:'A1',name:'原田 篤志',br:'福岡/福岡',f:0,l:0,st:'0.15',nat:['6.32','45.83','30.56'],loc:['6.20','44.00','28.00'],mot:['54','57.84','40.00'],boa:['18','50.00','35.00']},
 {lane:2,reg:'4688',g:'A2',name:'永井 彪也',br:'東京/東京',f:1,l:0,st:'0.16',nat:['5.88','38.10','25.00'],loc:['5.40','35.00','22.00'],mot:['31','51.19','33.00'],boa:['22','41.00','29.00']},
 {lane:3,reg:'4686',g:'A1',name:'丸野 一樹',br:'滋賀/滋賀',f:0,l:0,st:'0.14',nat:['7.05','52.00','36.00'],loc:['6.90','50.00','34.00'],mot:['7','70.00','48.00'],boa:['9','55.00','38.00']},
 {lane:4,reg:'4266',g:'B1',name:'長田 頼宗',br:'東京/東京',f:0,l:0,st:'0.18',nat:['4.90','28.00','18.00'],loc:['0.00','0.00','0.00'],mot:['48','47.62','30.00'],boa:['33','39.00','26.00']},
 {lane:5,reg:'3783',g:'A2',name:'瓜生 正義',br:'福岡/福岡',f:0,l:1,st:'0.17',nat:['6.10','42.00','29.00'],loc:['6.00','41.00','28.00'],mot:['12','50.48','32.00'],boa:['41','44.00','31.00']},
 {lane:6,reg:'3557',g:'B1',name:'太田 和美',br:'大阪/大阪',f:0,l:0,st:'0.20',nat:['4.55','24.00','15.00'],loc:['4.40','23.00','14.00'],mot:['60','49.04','31.00'],boa:['5','38.00','25.00']}
];
const tri=a=>a.join('<br>');
function mkRacelist(rows){
  return `<html><body><table class="is-w748">`+rows.map(r=>`
  <tbody class="is-fs12"><tr>
  <td class="is-fs14 is-fBold is-boatColor${r.lane}" rowspan="4">${r.lane}</td>
  <td rowspan="4"><img src="x.jpg"></td>
  <td class="is-lineH2" rowspan="4">
    <div class="is-fs11">${r.reg} / ${r.g}</div>
    <div class="is-fs18 is-fBold"><a href="#">${r.name}</a></div>
    <div class="is-fs11">${r.br}<br>45歳/52.0kg</div></td>
  <td class="is-lineH2" rowspan="4">F${r.f}<br>L${r.l}<br>${r.st}</td>
  <td class="is-lineH2" rowspan="4">${tri(r.nat)}</td>
  <td class="is-lineH2" rowspan="4">${tri(r.loc)}</td>
  <td class="is-lineH2" rowspan="4">${tri(r.mot)}</td>
  <td class="is-lineH2" rowspan="4">${tri(r.boa)}</td>
  <td class="is-fs12">1</td><td class="is-fs12">3</td><td class="is-fs12">2</td>
  </tr></tbody>`).join('')+`</table></body></html>`;
}

console.log('\n=== A. 出走表 DOM解析（形状ベース） ===');
const parsed=w.parseRacelistDOM(mkRacelist(ROWS));
ok(parsed.length===6,`6艇すべて検出 (got ${parsed.length})`);
const p1=parsed.find(x=>x.reg==='4064');
ok(!!p1,'登番4064 を検出');
ok(p1&&p1.lane===1,'艇番=1 をクラス名から正しく取得');
ok(p1&&p1.name==='原田篤志',`選手名='原田篤志' (got ${p1&&p1.name})`);
ok(p1&&p1.grade==='A1','級別=A1');
ok(p1&&p1.national&&p1.national.win===6.32,`[過去バグ2] 全国勝率=6.32 で 0.32 にならない (got ${p1&&p1.national&&p1.national.win})`);
ok(p1&&p1.local&&p1.local.win===6.20,`[過去バグ4] 当地勝率=6.20 で列ズレなし (got ${p1&&p1.local&&p1.local.win})`);
ok(p1&&p1.motor&&p1.motor.r2===57.84,`[過去バグ3] モーター2連率=57.84 (got ${p1&&p1.motor&&p1.motor.r2})`);
ok(p1&&p1.motor&&p1.motor.no===54,'モーター番号=54（2連率と取り違えない）');
ok(p1&&p1.boat&&p1.boat.r2===50.00,'ボート2連率=50.00');
ok(p1&&p1.avgST===0.15,`平均ST=0.15 (got ${p1&&p1.avgST})`);
const p3=parsed.find(x=>x.reg==='4686');
ok(p3&&p3.motor.no===7&&p3.motor.r2===70.00,'[境界] モーター番号が1桁(7)でも勝率と誤認しない');
const motRates=parsed.map(x=>x.motor.r2);
ok(JSON.stringify(motRates)===JSON.stringify([57.84,51.19,70.00,47.62,50.48,49.04]),
   `[過去バグ3] モーター2連率6件が全て正しい: ${motRates.join(',')}`);

console.log('\n=== B. 登録番号キーでの紐付け（艇番ズレ防止） ===');
// ユーザーが順番をバラバラに入力したケース
const order=[3557,4064,4686,3783,4266,4688];
order.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=String(r); });
w.syncRegsFromInputs();
const res=w.applyRacelistRows(parsed,'official');
ok(res.applied===6,'6艇に適用');
const b1=w.boatOf(1);
ok(b1.registrationNumber==='3557'&&V(b1.name)==='太田和美',
   `[過去バグ1] 入力順がバラバラでも登番3557→1号艇=太田和美 (got ${V(b1.name)})`);
ok(V(w.boatOf(2).nationalWinRate)===6.32,'登番4064のデータが2号艇へ（位置ではなく登番で紐付け）');
ok(res.laneMismatch.length===5,`公式と食い違う5艇を警告（4686だけ偶然一致） (got ${res.laneMismatch.length})`);

console.log('\n=== C. 正しい順で入力した場合 ===');
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
const res2=w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
ok(res2.laneMismatch.length===0,'艇番ズレ警告なし');
for(let i=1;i<=6;i++){
  const b=w.boatOf(i);
  ok(b.registrationNumber===ROWS[i-1].reg && V(b.nationalWinRate)===Number(ROWS[i-1].nat[0]),
     `${i}号艇 登番${b.registrationNumber} 全国勝率${V(b.nationalWinRate)} が一致`);
}
console.log('\n=== D. 未取得は0で埋めない ===');
const b4=w.boatOf(4);
ok(V(b4.localWinRate)===null,`[過去バグ8] 当地勝率0.00は異常値として不採用→null (got ${V(b4.localWinRate)})`);
ok(b4.localWinRate===null,'0を代入していない');
ok(V(b4.nationalWinRate)===4.90,'同じ艇の他の値は正常に保持');

console.log('\n=== E. 5艇しか取れない場合（詰め上げ禁止） ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
const partial=w.parseRacelistDOM(mkRacelist(ROWS.filter(r=>r.lane!==3)));
const res3=w.applyRacelistRows(partial,'official');
ok(res3.applied===5,'5艇ぶんだけ適用');
ok(V(w.boatOf(3).name)===null,'[過去バグ7] 3号艇は空のまま（4号艇を繰り上げない）');
ok(V(w.boatOf(4).name)==='長田頼宗','4号艇は4号艇のまま');
ok(V(w.boatOf(4).nationalWinRate)===4.90,'4号艇の勝率もズレていない');

console.log('\n=== F. 展示ST F/L 表記（過去バグ6） ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
const beforeHTML=`<html><body>
<table>${ROWS.map(r=>`<tbody><tr>
<td>${r.lane}</td><td>${r.reg}</td><td>${r.name}</td>
<td>52.0kg</td><td>調整 0.0</td><td>6.8${r.lane}</td><td>0.0</td></tr></tbody>`).join('')}</table>
<div>スタート展示
1 .07
2 .04
3 F.06
4 .12
5 .27
6 .09
</div>
<div>水面気象情報 気温 24.0℃ 風速 5m 水温 21.0℃ 波高 3cm</div>
</body></html>`;
const bi=w.parseBeforeInfoDOM(beforeHTML);
ok(bi.stPairs.length===6,`展示ST 6艇ぶん取得 (got ${bi.stPairs.length})`);
const st3=bi.stPairs.find(p=>p.lane===3);
ok(st3&&st3.flag==='F',`[過去バグ6] 3号艇の F.06 をフライングと認識 (flag=${st3&&st3.flag})`);
ok(st3&&st3.st===0.06,'F.06 の数値部分は 0.06');
const st5=bi.stPairs.find(p=>p.lane===5);
ok(st5&&st5.flag===null&&st5.st===0.27,'通常の .27 はフラグなし');
w.applyBeforeInfo(bi,'official');
ok(w.boatOf(3).exhibitionSTFlag==='F','3号艇にFフラグが保存される');
ok(w.boatOf(1).exhibitionSTFlag===null,'1号艇にはフラグなし');
ok(V(w.boatOf(2).exhibitionTime)===6.82,`[過去バグ5] 展示タイム6.82が展示STと入れ替わらない (got ${V(w.boatOf(2).exhibitionTime)})`);
ok(V(w.boatOf(2).exhibitionST)===0.04,`2号艇 展示ST=0.04 (got ${V(w.boatOf(2).exhibitionST)})`);
ok(V(state.conditions.windSpeed)===5,'風速5mを取得');
ok(V(state.conditions.temp)===24,'気温24℃を取得');

console.log('\n=== G. 展示STが5艇ぶんしか取れない場合 ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
const partialST=w.parseBeforeInfoDOM(beforeHTML.replace('6 .09',''));
ok(partialST.stPairs.length===5,'5件だけ検出');
w.applyBeforeInfo(partialST,'official');
ok(state.boats.every(b=>V(b.exhibitionST)===null),
   '[過去バグ7/1] 6艇揃わないので展示STを一切採用しない（ズレるくらいなら入れない）');

console.log('\n=== H. 選手名バリデーション（過去バグ10） ===');
const isValid=w.eval('isValidRacerName');
ok(isValid('原田篤志')===true,'正常な名前は通る');
ok(isValid('登録番号')===false,'[過去バグ10] 「登録番号」は選手名として拒否');
ok(isValid('選手名')===false,'「選手名」を拒否');
ok(isValid('全国勝率')===false,'「全国勝率」を拒否');
ok(isValid('4064')===false,'数字のみを拒否');
ok(isValid('A1')===false,'級別を拒否');
ok(isValid('')===false,'空文字を拒否');
ok(isValid('福岡/福岡')===false,'支部表記を拒否');

console.log('\n=== I. 異常値ガード ===');
const isSane=w.eval('isSane'), setField=w.eval('setField');
ok(isSane('nationalWinRate',0.16)===false,'[過去バグ2] 全国勝率0.16は異常値');
ok(isSane('nationalWinRate',6.32)===true,'全国勝率6.32は正常');
ok(isSane('exhibitionTime',6.82)===true,'展示タイム6.82は正常');
ok(isSane('exhibitionTime',0.06)===false,'[過去バグ5] 展示タイム欄に0.06は異常');
ok(isSane('averageST',0.15)===true,'平均ST0.15は正常');
ok(isSane('averageST',6.32)===false,'平均ST欄に6.32は異常');
ok(isSane('motor2Rate',57.84)===true,'モーター2連率57.84は正常');
ok(isSane('motor2Rate',157)===false,'モーター2連率157%は異常');
const tb=newBoat(1);
setField(tb,'nationalWinRate',0.16,'official');
ok(tb.nationalWinRate===null,'異常値0.16はセットされずnullのまま');
setField(tb,'nationalWinRate',6.32,'official');
ok(V(tb.nationalWinRate)===6.32,'正常値はセットされる');
setField(tb,'nationalWinRate',5.00,'ocr-medium');
ok(V(tb.nationalWinRate)===6.32,'低信頼(OCR)は公式データを上書きしない');
setField(tb,'nationalWinRate',7.11,'manual');
ok(V(tb.nationalWinRate)===7.11,'手入力は公式を上書きできる（人の修正が最優先）');

console.log('\n=== J. 場名の取得元（過去バグ9） ===');
ok(d.getElementById('venue').tagName==='SELECT','場名は選択式（選手情報の「福岡」等から推測しない）');
const opts=[...d.getElementById('venue').options].map(o=>o.textContent);
ok(opts.length===25,`24場+選択 = 25項目 (got ${opts.length})`);
ok(VENUES['22'].name==='福岡'&&VENUES['24'].water==='海水','競艇場マスタが正しい');

console.log('\n=== K. 採点：重みの再正規化（未取得を0点にしない） ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
d.getElementById('venue').value='12';
const ctx1=w.scoreAll();
const scores1=state.boats.map(b=>b.score);
ok(scores1.every(s=>s>0&&s<=100),`全艇のスコアが0<s<=100: ${scores1.join(', ')}`);
ok(state.boats.every(b=>Math.abs(b.scoreBreakdown.reduce((a,p)=>a+p.w,0)-b.weightCovered)<1e-9),
   '重み合計と weightCovered が一致');
// 展示データを足すと項目数が増え、weightCovered が上がる
const before=state.boats[0].weightCovered;
w.setOdds; // noop
state.boats.forEach((b,i)=>{ w.eval('setField')(b,'exhibitionTime',6.80+i*0.02,'official'); });
w.scoreAll();
ok(state.boats[0].weightCovered>before,
   `展示タイム追加で採点対象の重みが増える (${before.toFixed(2)} → ${state.boats[0].weightCovered.toFixed(2)})`);
// 欠損だらけの艇でも0点にならない
const lonely=newBoat(3);
lonely.grade={value:'A1',source:'official',confidence:'official'};
w.eval('scoreBoat')(lonely,{venue:VENUES['12'],windSpeed:null,windDir:null,wave:null,tide:null,bestExTime:null});
ok(lonely.score>40,`データが級別と枠だけでも妥当なスコア (got ${lonely.score})`);
ok(lonely.scoreBreakdown.length===2,'採点項目は取得できた2項目のみ');

console.log('\n=== L. コース別成績が「今の艇番」に効く ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
const baseScore1=(w.scoreAll(),w.boatOf(1).score);
// 1号艇にイン成績が悪いデータを与える
w.boatOf(1).courseStats[1]={firstRate:30,trioRate:55,avgST:0.21};
w.scoreAll();
const weakIn=w.boatOf(1).score;
ok(weakIn<baseScore1,`1コース1着率30%(全国平均55%)でイン信頼度が下がる (${baseScore1} → ${weakIn})`);
w.boatOf(1).courseStats[1]={firstRate:72,trioRate:88,avgST:0.12};
w.scoreAll();
const strongIn=w.boatOf(1).score;
// コース関連の重みは合計一定なので、コース別成績は「枠の目安」を置き換える。
// よって未取得時より必ず上がるわけではなく、成績の良し悪しで順序が付くことを見る。
ok(strongIn>weakIn,`1コース1着率72%は30%より高く評価される (${weakIn} → ${strongIn})`);
w.boatOf(1).courseStats[1]={firstRate:50,trioRate:72,avgST:0.16};
w.scoreAll();
const midIn=w.boatOf(1).score;
ok(weakIn<midIn&&midIn<strongIn,`30% < 50% < 72% の順になる (${weakIn} → ${midIn} → ${strongIn})`);
// 未取得でもコースの比重は縮まない（0.34を枠が引き継ぐ）
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
w.scoreAll();
{
  const W=w.eval('W');
  const posW=W.lane+W.courseFirst+W.courseTrio+W.courseST;
  const laneItem=w.boatOf(1).scoreBreakdown.find(p=>/枠|コース\(進入\)/.test(p.label));
  ok(laneItem&&Math.abs(laneItem.w-posW)<1e-9,
     `コース別成績が無いとき枠が合計${posW.toFixed(2)}を引き継ぐ (${laneItem?laneItem.w.toFixed(3):'なし'})`);
  w.boatOf(1).courseStats[1]={firstRate:55,trioRate:75,avgST:0.16};
  w.scoreAll();
  const l2=w.boatOf(1).scoreBreakdown.find(p=>/枠|コース\(進入\)/.test(p.label));
  const cs=w.boatOf(1).scoreBreakdown.filter(p=>/^\dコース/.test(p.label));
  const total=(l2?l2.w:0)+cs.reduce((a,c)=>a+c.w,0);
  ok(Math.abs(total-posW)<1e-9,`取得できた場合も合計は${posW.toFixed(2)}のまま (${total.toFixed(3)})`);
}
// 6号艇は同じ1着率でも「6コース基準」で評価される
w.boatOf(6).courseStats[6]={firstRate:8,trioRate:35,avgST:0.14};
w.scoreAll();
const b6=w.boatOf(6);
const cItem=b6.scoreBreakdown.find(p=>p.label.includes('コース1着率'));
ok(cItem&&cItem.val>50,`6コース1着率8%は全国平均3%より優秀と評価 (評価${Math.round(cItem.val)}点)`);

console.log('\n=== M. 風・F持ちの補正 ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs();
w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
d.getElementById('windDir').value=''; d.getElementById('windSpeed').value='';
w.scoreAll();
const calm1=w.boatOf(1).score, calm4=w.boatOf(4).score;
d.getElementById('windDir').value='追い風'; d.getElementById('windSpeed').value='6';
w.scoreAll();
ok(w.boatOf(1).score<calm1,`追い風6mで1号艇の評価が下がる (${calm1} → ${w.boatOf(1).score})`);
ok(w.boatOf(4).score>calm4,`追い風6mで4号艇の評価が上がる (${calm4} → ${w.boatOf(4).score})`);
ok(w.boatOf(1).minus.some(t=>t.includes('追い風')),'減点理由に追い風が明記される');
ok(w.boatOf(2).minus.some(t=>t.includes('F1持ち')),'F持ちが減点理由に出る（2号艇はF1）');
d.getElementById('windDir').value=''; d.getElementById('windSpeed').value='';

console.log('\n=== N. 3連単 確率モデル ===');
w.scoreAll();
const combos=w.buildProbabilities();
ok(combos.length===120,`3連単120通りすべて算出 (got ${combos.length})`);
const psum=combos.reduce((a,c)=>a+c.p,0);
ok(Math.abs(psum-1)<1e-9,`確率の合計が1.0 (got ${psum.toFixed(10)})`);
ok(combos.every(c=>c.p>0),'すべて正の確率');
ok(combos.every(c=>new Set([c.a,c.b,c.c]).size===3),'同一艇の重複なし');
const sorted=combos.every((c,i)=>i===0||combos[i-1].p>=c.p);
ok(sorted,'確率の高い順に並んでいる');
const wsum=state.boats.reduce((a,b)=>a+b.winProb,0);
ok(Math.abs(wsum-1)<1e-9,'各艇の1着確率の合計も1.0');

console.log('\n=== O. 金額配分 ===');
const allocate=w.eval('allocate');
const top6=combos.slice(0,6);
[1000,2000,600,10000,3000].forEach(bd=>{
  const a=allocate(top6,bd,null);
  const tot=a.reduce((x,y)=>x+y,0);
  ok(tot<=bd && tot>bd-100, `予算${bd}円 → 合計${tot}円（予算内かつ使い切り）`);
  ok(a.every(v=>v>=100 && v%100===0), `予算${bd}円 → 全点100円以上・100円単位`);
});
const a1=allocate(top6,1000,null);
ok(a1[0]>=a1[5],`本線(${a1[0]}円)が押さえ(${a1[5]}円)以上`);
const smallB=allocate(top6.slice(0,3),300,null);
ok(smallB.reduce((x,y)=>x+y,0)===300,'予算300円で3点なら100円ずつ');

console.log('\n=== P. 必須データ不足時の挙動 ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
for(let i=1;i<=6;i++) d.getElementById('reg'+i).value='';
let v=w.validateAll();
ok(v.ready===false,'登録番号未入力では生成不可');
ok(d.getElementById('btnGen').disabled===true,'生成ボタンが無効');
ROWS.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r.reg; });
w.syncRegsFromInputs(); v=w.validateAll();
ok(v.ready===false,'登番だけでは生成不可（選手名・勝率が必要）');
ok(v.missing.length===6,`不足艇を6艇ぶん列挙 (got ${v.missing.length})`);
ok(d.getElementById('forceGen')!==null,'「不足を承知で生成」チェックが表示される');
w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
v=w.validateAll();
// 4号艇の当地は 0.00 ＝「当地記録なし（初出走）」。取得失敗ではないので生成を止めない。
ok(w.boatOf(4).localNone===true,'当地0.00は「記録なし」として記録される');
ok(w.boatOf(4).localWinRate===null,'当地勝率の値そのものは 0 で埋めない');
ok(v.ready===true,'当地記録なしの艇がいても予想は生成できる');
ok(v.missing.length===0,`必須不足なし: ${v.missing.join('／')}`);
w.scoreAll();
ok(!w.boatOf(4).scoreBreakdown.some(p=>p.label==='当地勝率'),
   '当地記録なしの艇は当地勝率を採点項目に入れない（0点にもしない）');
ok(w.boatOf(1).scoreBreakdown.some(p=>p.label==='当地勝率'),'他の艇では当地勝率は採点される');
// 他の必須項目が本当に欠けている場合は、これまでどおり止まる
w.manualEdit(4,'motor2Rate','');
v=w.validateAll();
ok(v.ready===false,'モーター2連率が欠ければ従来どおり生成不可');
ok(v.missing.length===1&&v.missing[0].includes('4号艇'),`不足は4号艇のみ: ${v.missing[0]}`);
w.manualEdit(4,'motor2Rate','47.62');
// 当地を手入力で補うこともできる
w.manualEdit(4,'localWinRate','5.10');
v=w.validateAll();
ok(w.boatOf(4).localNone===false&&w.boatOf(4).localWinRate.value===5.10,'手入力すれば当地勝率を持てる');
ok(v.ready===true,'手入力で補っても生成可能');
ok(d.getElementById('btnGen').disabled===false,'生成ボタンが有効化');
// 0 を手入力したら「記録なし」に戻る
w.manualEdit(4,'localWinRate','0');
ok(w.boatOf(4).localNone===true&&w.boatOf(4).localWinRate===null,'0を手入力すると記録なしに戻る');
ok(w.validateAll().ready===true,'記録なしでも生成可能なまま');
w.manualEdit(4,'localWinRate','5.10'); v=w.validateAll();
ok(v.fill>0&&v.fill<=100,`データ充足率が算出される: ${v.fill}%`);

console.log('\n=== Q. 重複登番の検出 ===');
d.getElementById('reg2').value='4064';
w.syncRegsFromInputs(); v=w.validateAll();
ok(v.ready===false,'登番重複で生成不可');
ok(d.getElementById('quality').textContent.includes('重複'),'重複を明示的に警告');
d.getElementById('reg2').value='4688';
w.syncRegsFromInputs();
w.applyRacelistRows(w.parseRacelistDOM(mkRacelist(ROWS)),'official');
w.manualEdit(4,'localWinRate','5.10');
w.validateAll();

console.log('\n=== R. レポート生成（E2E） ===');
d.getElementById('venue').value='12'; d.getElementById('raceNo').value='11';
d.getElementById('budget').value='1000';
d.getElementById('windDir').value='追い風'; d.getElementById('windSpeed').value='4';
w.generateReport();
const rep=d.getElementById('report').textContent;
ok(rep.length>500,`レポートが生成された (${rep.length}文字)`);
['信頼度','データ充足率','評価順位','展開予想','本命シナリオ','対抗シナリオ','荒れシナリオ','買い目','住之江','予算']
  .forEach(k=>ok(rep.includes(k),`レポートに「${k}」を含む`));
const betEls=[...d.querySelectorAll('.betrow')];
ok(betEls.length===6,`買い目が6点 (got ${betEls.length})`);
const betTotal=betEls.map(e=>Number(e.querySelector('.betamt').textContent.replace(/[^0-9]/g,''))).reduce((a,b)=>a+b,0);
ok(betTotal<=1000&&betTotal>=900,`購入合計 ${betTotal}円 が予算1000円以内`);
const combosShown=betEls.map(e=>e.querySelector('.betno').textContent);
ok(new Set(combosShown).size===6,`買い目に重複なし: ${combosShown.join(' / ')}`);
ok(combosShown.every(c=>/^[1-6]-[1-6]-[1-6]$/.test(c)),'買い目の形式が3連単');
ok(rep.includes('◎')&&rep.includes('○')&&rep.includes('△')&&rep.includes('▲'),'◎○△▲ が表示される');
ok(d.querySelectorAll('.rplus,.rminus').length>0,'加点・減点の根拠が表示される');

console.log('\n=== S. オッズを入れて期待値で買い目を選ぶ ===');
{
  const st=w.eval('state');
  ok(st.lastBets&&st.lastBets.combos.length===6,'買い目がstateに保存される');
  ok(st.lastCombos&&st.lastCombos.length===120,'120通りすべてが候補として保持される');
  // オッズ未入力なら従来どおり確率順
  ok(st.lastPicked.mode==='prob','オッズが無ければ確率順で選ぶ');
  ok(d.getElementById('report').textContent.includes('確率の高い順'),'確率順だと明示される');
  ok(d.getElementById('report').textContent.includes('倍以上で買い'),'各買い目に損益分岐オッズを出す');

  // 損益分岐オッズ＝確率の逆数
  const c0=st.lastCombos[0];
  ok(Math.abs(w.breakEvenOdds(c0.p)-1/c0.p)<1e-9,`損益分岐は確率の逆数 (${(1/c0.p).toFixed(1)}倍)`);

  // 組番でオッズを持つ（並びが変わっても崩れない）
  w.setOdds(c0.combo, '50');
  ok(st.oddsMap[c0.combo]===50,'オッズは組番をキーに保存される');
  w.setOdds(c0.combo, '');
  ok(st.oddsMap[c0.combo]===undefined,'空にすると消える');

  // 期待値が基準を超える組だけ買う
  const top=st.lastCombos.slice(0,10);
  // 3番目と7番目だけ、損益分岐を大きく超えるオッズを付ける
  w.setOdds(top[2].combo, (1/top[2].p*2).toFixed(1));
  w.setOdds(top[6].combo, (1/top[6].p*1.5).toFixed(1));
  // 1番目は損益分岐を下回るオッズ（＝買ってはいけない組）
  /* 期待値での選定は既定オフになった（実測19レースで2/19・回収率59%）。
     この節は期待値経路そのものを試すので、明示的に入にする。 */
  d.getElementById('useEV').checked = true;
  w.setOdds(top[0].combo, (1/top[0].p*0.5).toFixed(1));
  w.generateReport();
  const picked=w.eval('state').lastPicked;
  ok(picked.mode==='ev','オッズを入れると期待値順に切り替わる');
  ok(picked.checked===3,`オッズを入れた3件を評価 (${picked.checked})`);
  ok(picked.points.length===2,`期待値1.10以上の2件だけ買う (${picked.points.length}件)`);
  ok(picked.skipped===1,`基準に届かない1件を外す (${picked.skipped}件)`);
  ok(picked.points[0].combo===top[2].combo,'期待値のいちばん高い組が本線になる');
  ok(!picked.points.some(p=>p.combo===top[0].combo),'確率1位でもオッズが安ければ買わない');
  const rep=d.getElementById('report').textContent;
  ok(rep.includes('期待値1.10以上で選定'),'期待値で選んだと明示される');
  ok(rep.includes('外しています'),'外した件数を伝える');

  // どれも基準に届かなければ「見送り」
  w.clearOdds();
  [0,1,2].forEach(i=>w.setOdds(top[i].combo, (1/top[i].p*0.5).toFixed(1)));
  w.generateReport();
  const p2=w.eval('state').lastPicked;
  ok(p2.points.length===0,'買う価値がある組が無ければ買い目は空');
  ok(d.getElementById('report').textContent.includes('見送りを推めます'),'見送りを明示する');
  ok(d.querySelectorAll('.betrow').length===0,'買い目の行を出さない');

  // 基準は変えられる
  d.getElementById('evMin').value='0.40';
  w.generateReport();
  ok(w.eval('state').lastPicked.points.length===3,'基準を下げれば買える');
  d.getElementById('evMin').value='1.10';
  d.getElementById('useEV').checked = false;

  // 金額配分は従来どおり予算内
  w.clearOdds();
  w.generateReport();
  const tot2=[...d.querySelectorAll('.betrow')]
    .map(e=>Number(e.querySelector('.betamt').textContent.replace(/[^0-9]/g,''))).reduce((a,b)=>a+b,0);
  ok(tot2<=1000,`配分は予算内 (${tot2}円)`);
}

console.log('\n=== T. 通信失敗でも壊れない ===');
(async()=>{
  const snapshot=JSON.stringify(state.boats.map(b=>[b.registrationNumber,V(b.name),V(b.nationalWinRate)]));
  await w.fetchRacelist();
  const after=JSON.stringify(state.boats.map(b=>[b.registrationNumber,V(b.name),V(b.nationalWinRate)]));
  ok(snapshot===after,'出走表取得が失敗してもデータは消えない');
  ok(d.getElementById('raceNotice').textContent.includes('消していません'),'入力を保持する旨を案内');
  await w.fetchBeforeInfo();
  ok(JSON.stringify(state.boats.map(b=>V(b.nationalWinRate)))===JSON.stringify([6.32,5.88,7.05,4.9,6.1,4.55]),
     '直前情報の失敗も出走表データを壊さない');
  await w.fetchCourseStats();
  ok(d.getElementById('courseNotice').textContent.includes('他のデータだけで予想を続行'),
     'コース別取得失敗でも予想継続できると案内');
  w.validateAll();
  ok(d.getElementById('btnGen').disabled===false,'失敗後も予想生成は可能なまま');

  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exit(fail?1:0);
})();
