const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const html=fs.readFileSync(HTML_PATH,'utf8');
const dom=new JSDOM(html,{runScripts:'dangerously',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;

console.log('\n=== AR. 画面から呼ばれる関数がすべて存在するか（配線チェック） ===');
const handlers=new Set();
d.querySelectorAll('[onclick],[oninput],[onchange]').forEach(el=>{
  ['onclick','oninput','onchange'].forEach(a=>{
    const v=el.getAttribute(a); if(!v) return;
    (v.match(/([A-Za-z_$][\w$]*)\s*\(/g)||[]).forEach(x=>handlers.add(x.replace(/\s*\($/,'')));
  });
});
// 動的に生成されるカード内のハンドラも含める
const dyn=['manualEdit','setRecentForm','regChanged','setOdds','parsePasted','openPasteHelp'];
dyn.forEach(h=>handlers.add(h));
console.log('  検査対象:',[...handlers].sort().join(', '));
let missing=[];
handlers.forEach(h=>{ if(typeof w[h]!=='function' && typeof w.eval('typeof '+h)!=='function'){
  try{ if(w.eval('typeof '+h)!=='function') missing.push(h); }catch(e){ missing.push(h); }
}});
ok(missing.length===0, missing.length? `未定義の関数: ${missing.join(', ')}` : `${handlers.size}個の関数がすべて定義済み`);

console.log('\n=== AS. 内部から呼ばれる関数の存在チェック ===');
const internals=['normalizeOcrDigits','extractExhibitionRows','assignExhibitionRows','parseWeatherOCR',
 'extractRacelistFromOCR','applyRacelistOCR','ocrImage','ocrImageMulti','readImageFile','readFile',
 'parseRacelistDOM','parseRacelistText','parseRacelistAny','parseBeforeInfoDOM','applyBeforeInfo',
 'parseLaneRegPairs','splitConcatNumbers','isAmbiguousNumberRun','pickRacerName','isValidRacerName',
 'htmlToText','isHTML','fetchViaProxy','fetchOneProxy','activeProxies','runConnectionTest',
 'scoreBoat','scoreAll','buildProbabilities','allocate','buildScenarios','validateAll',
 'renderBoats','renderConditions','renderVenueInfo','boatOf','boatByReg','newBoat','setField'];
const miss2=internals.filter(f=>{ try{ return w.eval('typeof '+f)!=='function' }catch(e){ return true }});
ok(miss2.length===0, miss2.length? `未定義: ${miss2.join(', ')}` : `${internals.length}個の内部関数がすべて定義済み`);

console.log('\n=== AT. 参照しているDOM要素がすべて存在するか ===');
const ids=new Set();
(html.match(/\$\('([a-zA-Z0-9_]+)'\)/g)||[]).forEach(m=>ids.add(m.slice(3,-2)));
(html.match(/getElementById\('([a-zA-Z0-9_]+)'\)/g)||[]).forEach(m=>ids.add(m.slice(16,-2)));
// 動的生成される要素は除外
const dynamicIds=['reg1','reg2','reg3','reg4','reg5','reg6','forceGen'];
const missIds=[...ids].filter(id=>!dynamicIds.includes(id) && !/^(ev|fld_|rf_)/.test(id) && !d.getElementById(id));
ok(missIds.length===0, missIds.length? `存在しないID: ${missIds.join(', ')}` : `${ids.size}個のIDを検査し全て存在`);

console.log('\n=== AU. 各ボタンを実際に押しても例外が出ないか ===');
const errors=[];
w.addEventListener('error',e=>errors.push(e.message));
const btns=[...d.querySelectorAll('button')];
ok(btns.length>0,`ボタン${btns.length}個を検出`);
let thrown=[];
btns.forEach(b=>{
  const code=b.getAttribute('onclick')||'';
  if(!code) return;
  if(/resetAll|openOfficial|openBrRacers/.test(code)) return;   // 画面遷移系は除外
  try{ w.eval(code); }
  catch(e){ if(!/not a function|is not defined/.test(e.message)) return; thrown.push(code+' → '+e.message); }
});
ok(thrown.length===0, thrown.length? `例外: ${thrown.join(' / ')}` : '全ボタンが未定義エラーを出さない');

console.log('\n=== AV. OCR関連が実際に動作するか（スタブ実行） ===');
const state=w.eval('state'),newBoat=w.eval('newBoat');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
['4064','4688','4686','4266','3783','3557'].forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
w.syncRegsFromInputs();
const rows=w.extractExhibitionRows(['1 .07 6.80\n2 .04 6.81\n3 F.06 6.82\n4 .12 6.83\n5 .27 6.84\n6 .09 6.85']);
ok(rows.length===6,`展示6行を検出 (${rows.length})`);
const asg=w.assignExhibitionRows(rows);
ok(asg.assigned.size===6,`6艇へ割当 (${asg.assigned.size})`);
const got=w.parseWeatherOCR('気温 24.0℃ 水温 21.0℃ 風速 5m 波高 3cm 追い風');
ok(got.length>=4,`水面気象を${got.length}項目取得`);
ok(d.getElementById('windDir').value==='追い風','風向も設定される');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
