const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('Load failed')};
  w.alert=m=>{lastAlert=m};w.confirm=()=>false;}});
let lastAlert='';
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');

// ▼ 実機ログからそのまま持ってきた本物のOCR出力
const REAL_OCR = `20:57 \\                 HER |
> vit.   0
優勝戦 ⑱00m
圓      :三
出走表    レース・結果一覧
ee EER
直前情報     展示情報    展示リプレイ
展示情報
枠   選手名      並び順    ST 屋示
關        タイム
①                   F.06 6.88
着 … - ow
丸野一樹            .0④ ⑥.⑧⑨
              .03 6.90
5     瓜生正義                   F0⑥ 6.82
太田和美              .③③ ⑥.⑧②
。 ホーム   ““ ー 投票     通知`;

console.log('\n=== AC. 丸囲み数字の正規化（実機の誤読原因） ===');
const nz=w.normalizeOcrDigits;
ok(nz('⑥.⑧⑨')==='6.89',`「⑥.⑧⑨」→「${nz('⑥.⑧⑨')}」`);
ok(nz('.0④')==='.04',`「.0④」→「${nz('.0④')}」`);
ok(nz('.③③')==='.33',`「.③③」→「${nz('.③③')}」`);
ok(nz('F0⑥')==='F06',`「F0⑥」→「${nz('F0⑥')}」`);
ok(nz('⑱00m')==='1800m',`「⑱00m」→「${nz('⑱00m')}」`);
ok(nz('①')==='1','丸囲み1');
ok(nz('⓪')==='0','丸囲み0');
ok(nz('６.８９')==='6.89','全角数字も変換');
ok(nz('6.89')==='6.89','通常の数字は変化しない');

console.log('\n=== AD. 実機OCR出力からの抽出 ===');
const rows=w.extractExhibitionRows(REAL_OCR);
console.log('  検出行:', JSON.stringify(rows.map(r=>({L:r.lane,n:r.name,st:r.st,f:r.stFlag,t:r.time}))));
const times=rows.map(r=>r.time).filter(x=>x!==null).sort();
const sts=rows.map(r=>r.st).filter(x=>x!==null).sort();
ok(times.length>=5,`展示タイムを${times.length}件検出（v16.0では3件）: ${times.join(', ')}`);
ok(times.includes(6.89),'⑥.⑧⑨ から 6.89 を復元');
ok(times.includes(6.82),'⑥.⑧② から 6.82 を復元');
ok(times.includes(6.88)&&times.includes(6.90),'6.88 と 6.90 も検出');
ok(sts.includes(0.04),'.0④ から 0.04 を復元');
ok(sts.includes(0.33),'.③③ から 0.33 を復元');
ok(sts.includes(0.06),'F.06 / F0⑥ から 0.06 を復元');
const flagged=rows.filter(r=>r.stFlag==='F');
ok(flagged.length===2,`Fフライング表記を2件とも識別 (got ${flagged.length})`);
ok(flagged.every(r=>r.st===0.06),'Fの数値部分も正しく 0.06');
ok(rows.some(r=>r.name==='丸野一樹'),'選手名「丸野一樹」を行から取得');
ok(rows.some(r=>r.name==='瓜生正義'),'選手名「瓜生正義」を行から取得');
ok(rows.some(r=>r.name==='太田和美'),'選手名「太田和美」を行から取得');
ok(!rows.some(r=>r.name==='展示情報'||r.name==='選手名'),'見出し文字を選手名として拾わない');

console.log('\n=== AE. 選手名で艇へ割り当て（位置に依存しない） ===');
function setup(){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  const regs=['4064','4688','4686','4266','3783','3557'];
  const names=['原田篤志','永井彪也','丸野一樹','長田頼宗','瓜生正義','太田和美'];
  regs.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r;});
  w.syncRegsFromInputs();
  names.forEach((n,i)=>setField(w.boatOf(i+1),'name',n,'official'));
}
setup();
const {assigned,report}=w.assignExhibitionRows(rows);
console.log('  割当:',[...assigned.entries()].map(([l,r])=>`${l}号艇=ST${r.st} T${r.time}`).join(' / '));
console.log('  内訳:',JSON.stringify(report));
ok(assigned.get(3)&&assigned.get(3).time===6.89,'3号艇(丸野一樹)に 6.89 を割当');
ok(assigned.get(3)&&assigned.get(3).st===0.04,'3号艇の展示ST 0.04');
ok(assigned.get(5)&&assigned.get(5).time===6.82,'5号艇(瓜生正義)に 6.82 を割当');
ok(assigned.get(5)&&assigned.get(5).stFlag==='F','5号艇はF持ちとして記録');
ok(assigned.get(6)&&assigned.get(6).st===0.33,'6号艇(太田和美)に 0.33 を割当');
ok(assigned.get(1)&&assigned.get(1).time===6.88,'1号艇は枠番①から 6.88 を割当');
ok(report.byName>=3,`選手名による割当が${report.byName}件（名前優先なので瓜生正義も名前で割当）`);
ok(!assigned.has(2)&&!assigned.has(4),'読めなかった2・4号艇は空のまま（詰めない）');

console.log('\n=== AF. 選手名が未取得でも壊れない ===');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
['4064','4688','4686','4266','3783','3557'].forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r;});
w.syncRegsFromInputs();
const a2=w.assignExhibitionRows(rows);
ok(a2.assigned.get(1)&&a2.assigned.get(1).time===6.88,'枠番が読めた1号艇は割当できる');
ok(a2.report.byName===0,'選手名未取得なら名前照合は0件');
ok(a2.report.byOrder===0,'並び順での割当は行わない（6行に満たないため）');
ok(a2.report.leftover.length>0,`残りは候補として提示 (${a2.report.leftover.length}件)`);

console.log('\n=== AG. 6行そろい順序も整合する場合のみ並び順を使う ===');
const clean=[1,2,3,4,5,6].map(l=>({lane:null,name:null,st:0.10+l/100,stFlag:null,time:6.80+l/100}));
const a3=w.assignExhibitionRows(clean);
ok(a3.report.byOrder===6,'6行そろえば並び順で6艇に割当');
ok(a3.assigned.get(1).time.toFixed(2)==='6.81'&&a3.assigned.get(6).time.toFixed(2)==='6.86','並び順どおりに対応');
const mixed=[{lane:3,name:null,st:0.05,stFlag:null,time:6.80},
             {lane:null,name:null,st:0.06,stFlag:null,time:6.81},
             {lane:null,name:null,st:0.07,stFlag:null,time:6.82},
             {lane:null,name:null,st:0.08,stFlag:null,time:6.83},
             {lane:null,name:null,st:0.09,stFlag:null,time:6.84},
             {lane:null,name:null,st:0.10,stFlag:null,time:6.85}];
const a4=w.assignExhibitionRows(mixed);
ok(a4.report.byOrder===0,'先頭行が3号艇＝並び順と枠番が食い違う時は位置で埋めない');
ok(a4.assigned.get(3).time===6.80,'枠番が読めた行だけ割当');

console.log('\n=== AH. 同時実行の防止（ログで多重実行が起きていた） ===');
(async()=>{
  setup();
  d.getElementById('raceDate').value='2026-09-21';
  d.getElementById('venue').value='05'; d.getElementById('raceNo').value='12';
  ok(state.busy===false,'初期状態はロックされていない');
  const p1=w.fetchRacelist();
  lastAlert='';
  const r2=await w.fetchBeforeInfo();
  ok(r2===false&&lastAlert.includes('実行中'),'取得中は別の取得を拒否して案内する');
  await p1;
  ok(state.busy===false,'完了後にロックが解放される');

  lastAlert='';
  d.getElementById('venue').value='';
  await w.fetchRacelist();
  ok(state.busy===false,'レース未指定で中断してもロックが残らない');
  d.getElementById('venue').value='05';
  for(let i=1;i<=6;i++) d.getElementById('reg'+i).value='';
  w.syncRegsFromInputs();
  await w.lookupAllRacers();
  ok(state.busy===false,'登番未入力で中断してもロックが残らない');
  await w.fetchCourseStats();
  ok(state.busy===false,'コース別で中断してもロックが残らない');

  console.log('\n=== AI. 専用プロキシ設定 ===');
  const act=w.eval('activeProxies');
  ok(act().length===8,'未設定なら共有プロキシ8本');
  d.getElementById('urlCustomProxy').value='https://my.workers.dev/?url={url}';
  ok(act().length===9&&act()[0].name==='専用','設定すると最優先に追加される');
  ok(act()[0].build('https://x.jp/a').includes(encodeURIComponent('https://x.jp/a')),
     '{url} が取得先に置換される');
  d.getElementById('urlCustomProxy').value='https://my.workers.dev/';
  ok(act()[0].build('https://x.jp/a')==='https://my.workers.dev/?url='+encodeURIComponent('https://x.jp/a'),
     '{url} 無しでも ?url= を自動で付ける');
  d.getElementById('urlCustomProxy').value='';

  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exit(fail?1:0);
})();
