/* 「1号艇が飛びやすい形か」の判定が、本当に画面に出るか
   ------------------------------------------------------------------
   test34 は index.html の文字列を見ているだけで、描画はしていない。
   文字列があっても、条件分岐の書き間違いで出ないことはある。
   ここでは実際に generateReport() を呼んで、出てくる文字を見る。

   確かめるのは3つ。
     ① 条件に当てはまるレースで「該当」と出ること
     ② 当てはまらないレースで「非該当」と出ること
     ③ 当てはまらないレースでは参考リストを出さないこと
   数字が正しいかは測れない。出る／出ないだけを固定する。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const BT=fs.readFileSync(path.join(ROOT,'backtest.js'),'utf8');
const RACES=eval('['+BT.match(/const RACES=\[([\s\S]*?)\n\];\n/)[1]+']');

function report(R){
  const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
   beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  const w=dom.window,d=w.document; w.Element.prototype.scrollIntoView=function(){};
  const newBoat=w.eval('newBoat'),setField=w.eval('setField'),state=w.eval('state');
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  R.B.forEach((x,i)=>{ d.getElementById('reg'+(i+1)).value=x.reg; });
  w.syncRegsFromInputs();
  R.B.forEach((x,i)=>{ const b=w.boatOf(i+1);
    setField(b,'name','選手'+(i+1),'official'); setField(b,'grade',x.g,'official');
    setField(b,'nationalWinRate',x.nat,'official');
    if(x.loc!=null) setField(b,'localWinRate',x.loc,'official');
    setField(b,'motor2Rate',x.mot,'official'); setField(b,'boat2Rate',x.bt,'official');
    if(x.st!=null) setField(b,'averageST',x.st,'official');
    setField(b,'exhibitionTime',x.exT,'official');
    b.exhibitionSTFlag=x.exF; setField(b,'exhibitionST',x.exST,'official');
    setField(b,'tilt',x.tilt,'official'); setField(b,'weight',x.wt,'official');
    b.flagF=x.F; b.flagL=0;
  });
  const ctx=w.eval('scoreAll')();
  const combos=w.eval('buildProbabilities')(ctx);
  const p1=combos.filter(c=>String(c.combo)[0]==='1').reduce((t,c)=>t+c.p,0);
  d.getElementById('btnGen').disabled=false;
  w.generateReport();
  const el=d.getElementById('report');
  return {text:(el?el.innerHTML:d.body.innerHTML).replace(/<[^>]+>/g,' ').replace(/\s+/g,' '), p1};
}

/* 片方ずつ、条件に当てはまるレースと当てはまらないレースを探す。
   決め打ちのレース名にすると、そのレースを消したときに静かに壊れる。 */
const scored = RACES.map(R=>({R, p1:null}));
let hit=null, miss=null;
for(const R of RACES){
  const r=report(R);
  if(!/1号艇が飛びやすい形か/.test(r.text)) continue;   /* 本命が堅すぎると出ない */
  if(r.p1 < 0.45 && !hit)  hit={R, ...r};
  if(r.p1 >= 0.45 && !miss) miss={R, ...r};
  if(hit && miss) break;
}

console.log('=== 条件に当てはまるレース ===');
ok(!!hit, '1号艇1着確率45%未満のレースが見つかる');
if(hit){
  console.log(`  （${hit.R.name}  モデルの1号艇1着確率 ${(hit.p1*100).toFixed(0)}%）`);
  ok(/該当。この形の28レースでは1号艇の1着率が43%でした/.test(hit.text),
     '「該当」と、その実測（43%）が出ている');
  ok(/参考：1号艇を1着から外した上位10点/.test(hit.text), '参考リストが出ている');
  ok(/買い目には入れていません/.test(hit.text), '買い目には入れないと出ている');
  ok(/高配当が取れるかは別で/.test(hit.text), '高配当は別だと出ている');
}

console.log('\n=== 条件に当てはまらないレース ===');
ok(!!miss, '1号艇1着確率45%以上のレースが見つかる');
if(miss){
  console.log(`  （${miss.R.name}  モデルの1号艇1着確率 ${(miss.p1*100).toFixed(0)}%）`);
  ok(/非該当。この形の29レースでは1号艇の1着率が76%でした/.test(miss.text),
     '「非該当」と、その実測（76%）が出ている');
  ok(!/参考：1号艇を1着から外した上位10点/.test(miss.text),
     '参考リストは出ていない（条件に当てはまらないので出してはいけない）');
}

console.log('\n=== 今日の若松12R（この判定では拾えなかった実例）===');
{
  const R=RACES.find(r=>r.name==='若松12R 一般(10/24)');
  ok(!!R, '若松12R(10/24) が RACES にある');
  if(R){
    const r=report(R);
    /* 正解は 2-4-5 ¥95,310。1号艇は飛んだのに、この判定は「堅い形」と言う。
       判定が万能でないことを、テストの形で残しておく。
       ここが将来「該当」に変わったら、モデルか条件が変わったということ。 */
    ok(r.p1 >= 0.45, `モデルの1号艇1着確率は ${(r.p1*100).toFixed(0)}% で45%以上（＝非該当）`);
    ok(/2つとも非該当。1号艇は堅い形です/.test(r.text),
       '「堅い形」と出る。実際には1号艇が飛んで¥95,310だった。判定は万能ではない');
  }
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
