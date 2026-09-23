const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
let calls=[];
function makeDom(handler){
  return new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
   beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.alert=()=>{};
     w.fetch=async(u)=>{ calls.push(String(u)); return handler(String(u)); }; }});
}
const resp=(b,st=200)=>({ok:st>=200&&st<300,status:st,text:async()=>b});
const PAD='あ'.repeat(600);

let dom=makeDom(()=>{throw new Error('x')}); let w=dom.window;

console.log('\n=== CD. コース別成績をMarkdownから解析（今回の不具合） ===');
const MD_COURSE=`Title: 選手別コース成績

| コース | 進入回数 | 1着率 | 2連対率 | 3連対率 | 平均ST | 平均スタート順位 |
| --- | --- | --- | --- | --- | --- | --- |
| 1コース | 42 | 58.3 | 71.4 | 83.3 | 0.14 | 2.1 |
| 2コース | 18 | 16.7 | 38.9 | 55.6 | 0.15 | 3.0 |
| 3コース | 21 | 14.3 | 33.3 | 52.4 | 0.16 | 3.2 |
| 4コース | 25 | 12.0 | 28.0 | 48.0 | 0.15 | 3.4 |
| 5コース | 19 | 5.3 | 21.1 | 36.8 | 0.17 | 3.6 |
| 6コース | 15 | 0.0 | 13.3 | 26.7 | 0.18 | 4.1 |
`;
let cs=w.parseCourseTable(MD_COURSE);
ok(Object.keys(cs).length===6,`6コースぶん解析 (${Object.keys(cs).length})`);
ok(cs[1] && cs[1].firstRate===58.3,`1コース1着率 58.3 (${cs[1]&&cs[1].firstRate})`);
ok(cs[1] && cs[1].trioRate===83.3,`1コース3連対率 83.3 (${cs[1]&&cs[1].trioRate})`);
ok(cs[1] && cs[1].avgST===0.14,`1コース平均ST 0.14 (${cs[1]&&cs[1].avgST})`);
ok(cs[6] && cs[6].firstRate===0,'6コース1着率0%も正しく取る（0は有効な値）');
ok(cs[6] && cs[6].avgST===0.18,'6コース平均STも取得');

console.log('\n=== CE. 素のテキスト形式でも解析できる ===');
const TXT_COURSE=`コース別成績
コース 進入回数 1着率 2連対率 3連対率 平均ST
1コース 42 58.3 71.4 83.3 0.14
2コース 18 16.7 38.9 55.6 0.15
3コース 21 14.3 33.3 52.4 0.16
4コース 25 12.0 28.0 48.0 0.15
5コース 19 5.3 21.1 36.8 0.17
6コース 15 0.0 13.3 26.7 0.18`;
cs=w.parseCourseTable(TXT_COURSE);
ok(Object.keys(cs).length===6,`素のテキストでも6コース (${Object.keys(cs).length})`);
ok(cs[3] && cs[3].firstRate===14.3,'3コース1着率も正確');

console.log('\n=== CF. HTMLでも従来どおり解析できる ===');
const HTML_COURSE='<table><tr><th>コース</th><th>1着率</th><th>3連対率</th><th>平均ST</th></tr>'+
 [1,2,3,4,5,6].map(c=>`<tr><td>${c}コース</td><td>${60-c*9}</td><td>${85-c*10}</td><td>0.1${c+2}</td></tr>`).join('')+'</table>';
cs=w.parseCourseTable(HTML_COURSE);
ok(Object.keys(cs).length===6,`HTMLでも6コース (${Object.keys(cs).length})`);
ok(cs[1].firstRate===51,'HTMLの値も正確');

console.log('\n=== CG. 関係ないページは拾わない ===');
ok(Object.keys(w.parseCourseTable('ただの文章です。数字も 12 34 あります。')).length===0,'無関係な文章から拾わない');
ok(Object.keys(w.parseCourseTable(MD_COURSE.replace(/1着率|2連対率|3連対率|平均ST/g,'X'))).length===0,
   '見出しが無ければ拾わない（位置で推測しない）');

console.log('\n=== CH. 応答が短い場合は他の経路を試さない ===');
calls=[];
dom=makeDom(u=>{ if(u.includes('r.jina.ai')) return resp('短い'); throw new Error('Load failed'); });
w=dom.window;
(async()=>{
  let caught=null;
  try{ await w.fetchViaProxy('https://x.jp/a'); }catch(e){ caught=e; }
  ok(caught && caught.name==='ContentMismatch',`短い応答はURLの問題として扱う (${caught&&caught.name})`);
  const first=calls.length; calls=[];
  try{ await w.fetchViaProxy('https://x.jp/b'); }catch(e){}
  const second=calls.length;
  console.log(`  1回目 ${first}回 → 2回目 ${second}回`);
  ok(second<=2,`2回目は死んだ経路を試し直さない (${second}回 / 以前は毎回8回)`);

  console.log('\n=== CI. コース別: 続けて失敗したデータ元は諦める ===');
  calls=[];
  dom=makeDom(u=>{ if(u.includes('r.jina.ai')) return resp('コース別の表がないページ'+PAD); throw new Error('Load failed'); });
  w=dom.window;
  const d=w.document, state=w.eval('state'), newBoat=w.eval('newBoat');
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  ['5196','5275','5257','5278','4938','5112'].forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  await w.fetchCourseStats();
  console.log(`  通信回数: ${calls.length}回（6艇×2データ元×8経路なら最大96回）`);
  ok(calls.length<=14,`データ元を早めに諦めて待ち時間を抑える (${calls.length}回)`);
  ok(d.getElementById('courseNotice').textContent.includes('他のデータだけで予想を続行'),'続行できると案内');

  console.log('\n=== CJ. コース別が取れれば6艇に反映される ===');
  calls=[];
  dom=makeDom(u=>{ if(u.includes('r.jina.ai')) return resp(MD_COURSE+PAD); throw new Error('Load failed'); });
  w=dom.window;
  const d2=w.document, st2=w.eval('state'), nb2=w.eval('newBoat');
  st2.boats.forEach((b,i)=>Object.assign(b,nb2(i+1)));
  ['5196','5275','5257','5278','4938','5112'].forEach((r,i)=>{d2.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  await w.fetchCourseStats();
  const got=st2.boats.filter(b=>b.courseStats[1]).length;
  ok(got===6,`6艇すべてにコース別成績を反映 (${got}/6)`);
  ok(w.boatOf(1).courseStats[1].firstRate===58.3,'1号艇の1コース1着率');
  ok(d2.getElementById('courseNotice').textContent.includes('6/6艇'),'成功を通知');

  console.log('\n=== CK. 出走表OCRは見出しが読めない時に推測しない ===');
  const state3=w.eval('state'), nb3=w.eval('newBoat');
  state3.boats.forEach((b,i)=>Object.assign(b,nb3(i+1)));
  ['5196','5275','5257','5278','4938','5112'].forEach((r,i)=>{d2.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  // 実機のOCR出力（見出しが壊れ、数値が行方向に混ざっている）
  const REAL_OCR=`ホートレーサー 全国. 当地」 モーター ポート
5196/41  F2 | 509 000  30  36
Lo | 3093 000 31.22 4079
015 | 4433 | 000 4762 56.58
5275/A1  Fi | 650 653 59 4s
Lo | 4957 | 40.00 3039 32.31`;
  const recs=w.extractRacelistFromOCR([REAL_OCR]);
  const r1=recs.find(x=>x.reg==='5196');
  ok(r1 && r1.unreadable===true,'見出しを読めない艇は「読めない」と印を付ける');
  const res=w.applyRacelistOCR(recs);
  ok(w.eval('V')(w.boatOf(1).motor2Rate)===null,
     `誤ったモーター2連率(56.58)を入れない (${w.eval('V')(w.boatOf(1).motor2Rate)})`);
  ok(w.eval('V')(w.boatOf(1).nationalWinRate)===null,'推測値を入れない');
  ok(res.missing.some(m=>m.includes('推測を避けた')),`理由を明示: ${res.missing.find(m=>m.includes('推測'))}`);

  console.log('\n=== CL. 見出しが読めれば従来どおり取得する ===');
  state3.boats.forEach((b,i)=>Object.assign(b,nb3(i+1)));
  ['5196','5275','5257','5278','4938','5112'].forEach((r,i)=>{d2.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  const GOOD_OCR=`1 5196 / A1 鰐部 太空海
全国 5.09 当地 5.20
モーター 30 31.22  ボート 36 40.79`;
  w.applyRacelistOCR(w.extractRacelistFromOCR([GOOD_OCR]));
  ok(w.eval('V')(w.boatOf(1).nationalWinRate)===5.09,`見出しがあれば取得 (${w.eval('V')(w.boatOf(1).nationalWinRate)})`);
  ok(w.eval('V')(w.boatOf(1).motor2Rate)===31.22,'モーター2連率も正確');

  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exit(fail?1:0);
})();
