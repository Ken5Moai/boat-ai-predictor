const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
const REGS=['4064','4688','4686','4266','3783','3557'];
const NAMES=['原田 篤志','永井 彪也','丸野 一樹','長田 頼宗','瓜生 正義','太田 和美'];

// r.jina.ai が返す Markdown 形式の出走表を再現
const JINA = `Title: ボートレース多摩川\n\n| 枠 | 選手 | F/L/ST | 全国 | 当地 | モーター | ボート |\n|---|---|---|---|---|---|---|\n`+
REGS.map((r,i)=>`| ${i+1} | ${r} / ${['A1','A2','A1','B1','A2','B1'][i]} [${NAMES[i]}](https://www.boatrace.jp/owpc/pc/data/racersearch/profile?toban=${r}) 福岡/福岡 45歳/52.0kg | F0 L0 0.1${i+4} | ${(6.32-i*0.2).toFixed(2)} 45.83 30.56 | ${(6.20-i*0.2).toFixed(2)} 44.00 28.00 | ${50+i} ${(46.08+i).toFixed(2)} 40.00 | ${10+i} 50.00 35.00 |`).join('\n');

function reset(){ state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REGS.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r}); w.syncRegsFromInputs(); }

console.log('\n=== AW. r.jina.ai の Markdown から選手名を取得（今回の不具合） ===');
reset();
const rows=w.parseRacelistAny(JINA);
ok(rows.length===6,`6艇を解析 (${rows.length})`);
w.applyRacelistRows(rows,'official');
const got=state.boats.map(b=>V(b.name));
console.log('  取得した選手名:',JSON.stringify(got));
ok(got.filter(Boolean).length===6,`6艇すべての選手名を取得 (${got.filter(Boolean).length}/6)`);
ok(got[0]==='原田篤志'&&got[4]==='瓜生正義','リンク記法から正しい名前を抽出');
ok(V(w.boatOf(1).nationalWinRate)===6.32,'勝率も従来どおり取得');
ok(V(w.boatOf(1).motor2Rate)===46.08,'モーター2連率も取得');

console.log('\n=== AX. 選手名が無くても予想できる（採点に使わないため） ===');
reset();
w.applyRacelistRows(rows,'official');
state.boats.forEach(b=>{ b.name=null; });   // 名前だけ消す
d.getElementById('raceDate').value='2026-09-22';
d.getElementById('venue').value='05'; d.getElementById('raceNo').value='12';
d.getElementById('budget').value='1000';
let v=w.validateAll();
ok(v.ready===true,'選手名が6艇とも無くても「必要なデータは揃った」と判定');
ok(d.getElementById('btnGen').disabled===false,'予想ボタンが有効');
ok(d.getElementById('quality').textContent.includes('このまま予想できます'),'名前が無くても進めると案内');
ok(d.getElementById('quality').textContent.includes('1号艇'),'どの艇の名前が無いかを明示');
w.generateReport();
const rep=d.getElementById('report').textContent;
ok(rep.length>500,`レポート生成 (${rep.length}文字)`);
ok(!rep.includes('undefined')&&!rep.includes('null'),'レポートに undefined / null が出ない');
ok(/[1-6]号艇/.test(rep),'名前の代わりに艇番で表示');
ok(d.querySelectorAll('.betrow').length===6,'買い目6点');

console.log('\n=== AY. 級別・勝率が欠けている場合は従来どおり止める ===');
reset();
w.applyRacelistRows(rows,'official');
w.manualEdit(3,'motor2Rate','');
v=w.validateAll();
ok(v.ready===false,'モーター2連率が欠けたら予想不可');
ok(v.missing.some(m=>m.includes('3号艇')&&m.includes('モーター')),`不足を明示: ${v.missing[0]}`);
w.manualEdit(3,'motor2Rate','48.00');
ok(w.validateAll().ready===true,'補えば再び予想可能');

console.log('\n=== AZ. 選手名があるとOCR照合の精度が上がる ===');
reset();
w.applyRacelistRows(rows,'official');
const exRows=w.extractExhibitionRows(['丸野一樹 .04 6.89\n瓜生正義 F.06 6.82\n太田和美 .33 6.85']);
const asg=w.assignExhibitionRows(exRows);
ok(asg.report.byName===3,`選手名で3艇を照合 (${asg.report.byName})`);
ok(asg.assigned.get(3)&&asg.assigned.get(3).time===6.89,'3号艇に正しく割当');
ok(asg.assigned.get(5)&&asg.assigned.get(5).stFlag==='F','5号艇のF表記も保持');

console.log('\n=== BA. HTMLで返ってきた場合も名前が取れる ===');
reset();
const HTML='<table>'+REGS.map((r,i)=>`<tbody><tr>
<td class="is-boatColor${i+1}">${i+1}</td>
<td><div>${r} / A1</div><div><a href="/owpc/pc/data/racersearch/profile?toban=${r}">${NAMES[i]}</a></div><div>福岡/福岡<br>45歳/52.0kg</div></td>
<td>F0<br>L0<br>0.15</td><td>6.32<br>45.83<br>30.56</td><td>6.20<br>44.00<br>28.00</td>
<td>54<br>57.84<br>40.00</td><td>18<br>50.00<br>35.00</td></tr></tbody>`).join('')+'</table>';
const hrows=w.parseRacelistDOM(HTML);
ok(hrows.length===6,`HTML解析で6艇 (${hrows.length})`);
w.applyRacelistRows(hrows,'official');
const hnames=state.boats.map(b=>V(b.name));
ok(hnames.filter(Boolean).length===6,`HTMLからも6艇の名前を取得 (${hnames.filter(Boolean).length}/6)`);
ok(hnames[0]==='原田篤志',`リンクから正しく取得 (${hnames[0]})`);
ok(V(w.boatOf(1).nationalWinRate)===6.32,'勝率も正しい');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
