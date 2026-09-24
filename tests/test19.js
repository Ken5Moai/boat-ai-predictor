/* レース結果の自動取得 */
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

/* 実際の結果ページに近い形（三国5R 6-4-2 ¥8,750） */
const page = `<html><body>
<h1>レース結果</h1>
<table><tr><th>着</th><th>枠</th><th>ボートレーサー</th></tr>
<tr><td>1</td><td>6</td><td>茅原 悠紀</td></tr>
<tr><td>2</td><td>4</td><td>原村 拓也</td></tr>
<tr><td>3</td><td>2</td><td>大久保信一郎</td></tr></table>
<table><tr><th>勝式</th><th>組番</th><th>払戻金</th><th>人気</th></tr>
<tr><td>3連単</td><td>6-4-2</td><td>¥8,750</td><td>33</td></tr>
<tr><td>3連複</td><td>2=4=6</td><td>¥2,230</td><td>10</td></tr>
<tr><td>2連単</td><td>6-4</td><td>¥1,270</td><td>7</td></tr>
<tr><td>2連複</td><td>4=6</td><td>¥1,300</td><td>7</td></tr>
<tr><td>単勝</td><td>6</td><td>¥140</td></tr></table>
<div>決まり手 まくり</div>
</body></html>`;

console.log('=== A. 結果を読む ===');
{
  const r=w.parseRaceResult(page);
  ok(r.ok,'読める');
  ok(r.combo==='6-4-2',`3連単の組番 ${r.combo}`);
  ok(r.first===6&&r.second===4&&r.third===2,'着順は組番から取る（表と食い違わない）');
  ok(r.payout===8750,`払戻 ${r.payout}円（カンマを外す）`);
  ok(r.pays.sanfuku===2230,`3連複 ${r.pays.sanfuku}円`);
  ok(r.pays.ni===1270,`2連単 ${r.pays.ni}円`);
  ok(r.pays.nifuku===1300,`2連複 ${r.pays.nifuku}円`);
  ok(r.pays.tan===140,`単勝 ${r.pays.tan}円`);
  ok(r.kimarite==='まくり',`決まり手 ${r.kimarite}`);
}

console.log('\n=== B. 他の式別が組番と矛盾していたら採らない ===');
{
  const bad=page.replace('<td>2=4=6</td>','<td>1=3=5</td>').replace('<td>6-4</td>','<td>1-2</td>');
  const r=w.parseRaceResult(bad);
  ok(r.ok,'3連単が読めていれば結果自体は採用する');
  ok(r.pays.sanfuku===undefined,'3連複が組番と合わなければ採らない');
  ok(r.pays.ni===undefined,'2連単が組番と合わなければ採らない');
}

console.log('\n=== C. 読めないものは読めたと言わない ===');
{
  ok(!w.parseRaceResult('<html><body>まもなく発走です</body></html>').ok,'結果が無いページ');
  const dup=page.replace('<td>6-4-2</td>','<td>6-6-2</td>');
  const r1=w.parseRaceResult(dup);
  ok(!r1.ok && r1.why.includes('重複'),`組番の重複を弾く: ${r1.why}`);
  const cheap=page.replace('¥8,750','¥50');
  const r2=w.parseRaceResult(cheap);
  ok(!r2.ok, '払戻が100円未満なら弾く');
  const huge=page.replace('¥8,750','¥9,999,999');
  ok(!w.parseRaceResult(huge).ok, '払戻が大きすぎれば弾く');
}

console.log('\n=== D. 別の書き方でも読める ===');
{
  const md = `レース結果\n\n| 勝式 | 組番 | 払戻金 |\n| 3連単 | 1-2-3 | 510円 |\n| 3連複 | 1=2=3 | 350円 |\n| 単勝 | 1 | 140円 |\n決まり手 逃げ`;
  const r=w.parseRaceResult(md);
  ok(r.ok && r.combo==='1-2-3' && r.payout===510, `Markdownでも読める（${r.combo} ¥${r.payout}）`);
  ok(r.kimarite==='逃げ', '決まり手も取れる');
}

console.log('\n=== E. 予想の記録に市場の見立ても残る ===');
{
  const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
  const REG=['4004','4112','5143','4894','5009','4418'];
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REG.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r; });
  w.syncRegsFromInputs();
  state.boats.forEach((b,i)=>{
    setField(b,'grade','A2','official'); setField(b,'nationalWinRate',5+i*0.3,'official');
    setField(b,'localWinRate',5,'official'); setField(b,'motor2Rate',33,'official'); });
  d.getElementById('venue').value='10'; d.getElementById('raceDate').value='2026-09-24';
  d.getElementById('raceNo').value='5';
  w.localStorage.setItem('boatai_records_v1','[]');
  /* オッズ未入力なら market は入らない */
  state.oddsMap={}; w.validateAll(); w.generateReport();
  let rec=w.loadRecords()[0];
  ok(rec.market===null,'オッズが無ければ市場の見立ては残さない');
  ok(rec.modelWin && Object.keys(rec.modelWin).length===6,'モデルの1着確率は6艇ぶん残す');
  /* 120通り揃えば market が入る */
  const O={}; w.allTrifecta().forEach(k=>{ O[k]= k[0]==='1' ? 20 : 200; });
  state.oddsMap=O; w.generateReport();
  rec=w.loadRecords()[0];
  ok(rec.market && Object.keys(rec.market).length===6,'オッズが揃えば市場の1着確率を残す');
  const sum=Object.values(rec.market).reduce((a,c)=>a+c,0);
  ok(Math.abs(sum-0.75*Object.keys(O).reduce((a,k)=>a+1/O[k],0))<1e-3,'市場の確率は 0.75÷オッズ の合計');
  state.oddsMap={};
}

console.log('\n=== F. 検証の進み具合が見える ===');
{
  const mk=(id,rno,modelWin,market,first)=>({
    id, date:'2026-09-24', jcd:'10', rno, venueName:'三国',
    picks:[{combo:'1-2-3',amount:100,p:0.1}],
    modelWin, market,
    result:{combo:`${first}-2-3`, first, second:2, third:3, payout:1000}
  });
  /* モデルが1号艇を市場より下げ、実際に1号艇が勝たなかった → モデルが正しい */
  const a=mk('a',1,{1:.48,2:.14,3:.13,4:.10,5:.09,6:.06},{1:.58,2:.11,3:.13,4:.08,5:.06,6:.04},2);
  /* モデルが6号艇を市場より高く見て、6号艇が勝った → モデルが正しい */
  const b=mk('b',3,{1:.20,2:.14,3:.13,4:.10,5:.09,6:.34},{1:.30,2:.11,3:.13,4:.08,5:.06,6:.32},6);
  /* モデルが1号艇を下げたが1号艇が勝った → 市場が正しい */
  const c=mk('c',5,{1:.40,2:.20,3:.13,4:.10,5:.09,6:.08},{1:.55,2:.15,3:.13,4:.08,5:.05,6:.04},1);
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([a,b,c]));
  w.renderRecords();
  const t=d.getElementById('recordList').textContent;
  ok(t.includes('検証の進み具合'),'検証の進み具合が出る');
  ok(t.includes('モデルと市場を比べられるレース'),'件数の見出しが出る');
  ok(/判定まであと/.test(t.replace(/\s+/g,'')),'残り件数を出す');
  ok(t.includes('三国1R')&&t.includes('三国5R'),'レースが並ぶ');
  /* 正誤の判定 */
  const rows=[...d.getElementById('recordList').querySelectorAll('tr')].map(r=>r.textContent.replace(/\s+/g,' '));
  const r1=rows.find(x=>x.includes('三国1R')), r3=rows.find(x=>x.includes('三国3R')), r5=rows.find(x=>x.includes('三国5R'));
  ok(r1&&r1.includes('モデル'),`1R は モデルが正しい: ${r1}`);
  ok(r3&&r3.includes('モデル'),`3R は モデルが正しい: ${r3}`);
  ok(r5&&r5.includes('市場'),`5R は 市場が正しい: ${r5}`);
  /* 市場の記録が無いレースは数えない */
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([{...a, market:null}]));
  w.renderRecords();
  const t2=d.getElementById('recordList').textContent;
  ok(t2.includes('まだ1件もありません'),'市場の記録が無ければ数えない');
  w.localStorage.setItem('boatai_records_v1','[]');
}

console.log('\n=== G. 検証用に短く書き出せる ===');
{
  const rec={ id:'2026-09-24_10_6', date:'2026-09-24', jcd:'10', rno:6, venueName:'三国',
    picks:[{combo:'1-2-3',amount:100,p:0.1}],
    modelWin:{1:.188,2:.256,3:.169,4:.183,5:.069,6:.136},
    market:{1:.512,2:.097,3:.074,4:.187,5:.078,6:.054},
    ranking: new Array(120).fill('1-2-3').join(','),
    result:{combo:'2-4-1', first:2, second:4, third:1, payout:12340} };
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([rec]));
  w.exportVerification();
  const t=d.getElementById('recordIO').value;
  ok(t.split('\n').length===1, '1レース1行で書き出す');
  ok(t.includes('三国6R'),'レースが分かる');
  ok(t.includes('model 18.8 25.6 16.9 18.3 6.9 13.6'),`モデルの1着確率が並ぶ: ${t.slice(0,60)}`);
  ok(t.includes('market 51.2 9.7 7.4 18.7 7.8 5.4'),'市場の1着確率が並ぶ');
  ok(t.includes('2-4-1 ¥12340'),'結果と払戻が入る');
  ok(!t.includes(rec.ranking),'120通りの評価順は入れない（長くなるため）');
  ok(t.length < 200, `短い（${t.length}文字）`);
  /* 結果がまだなら「結果まち」と出す */
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([{...rec, result:null}]));
  w.exportVerification();
  ok(d.getElementById('recordIO').value.includes('結果まち'),'結果がまだなら結果まちと出す');
  /* オッズが無い記録は市場を「-」で出す */
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([{...rec, market:null}]));
  w.exportVerification();
  ok(d.getElementById('recordIO').value.includes('market - - - - - -'),'オッズが無ければ市場は空で出す');
  /* 検証に使える記録が無ければ、その旨を出す */
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([{id:'x', date:'2026-09-24', rno:1, picks:[]}]));
  w.exportVerification();
  ok(d.getElementById('recordIONotice').textContent.includes('検証に使える記録がありません'),'使える記録が無ければそう言う');
  w.localStorage.setItem('boatai_records_v1','[]');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
