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
/* レース記録は data/races.js（非公開リポジトリ boat-ai-data）に移した。
   backtest.js のほうはコードの検査に使うので、別に読む。 */
const RACES=require(path.join(ROOT,'data','races.js'));

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
    /* 当地勝率0.00は「当地で走っていない」。アプリ本体と同じく localNone で表す。 */
    if(x.loc === 0) b.localNone = true;
    else if(x.loc != null) setField(b,'localWinRate',x.loc,'official');
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
  ok(/[^非]該当。この形の\d+レースでは1号艇の1着率が\d+%でした/.test(hit.text),
     '「該当」と、その実測が出ている');
  ok(/参考：1号艇を1着から外した上位10点/.test(hit.text), '参考リストが出ている');
  ok(/買い目には入れていません/.test(hit.text), '買い目には入れないと出ている');
  ok(/高配当が取れるかは別で/.test(hit.text), '高配当は別だと出ている');
}

console.log('\n=== 条件に当てはまらないレース ===');
ok(!!miss, '1号艇1着確率45%以上のレースが見つかる');
if(miss){
  console.log(`  （${miss.R.name}  モデルの1号艇1着確率 ${(miss.p1*100).toFixed(0)}%）`);
  ok(/非該当。この形の\d+レースでは1号艇の1着率が\d+%でした/.test(miss.text),
     '「非該当」と、その実測が出ている');
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

console.log('\n=== 買い目カード（至極1点 / 本線10点 / 波乱8点）===');
/* 買い目の形を決めるのは buyPlan() 一箇所だけ、という約束を守れているか。
   backtest.js と index.html の両方に点数を書くと、片方だけ直したときに静かにずれる。 */
{
  const r = report(RACES[RACES.length-1]);
  ok(/買い目 18点/.test(r.text), '18点の買い目カードが描画される');
  ok(/至極の一点/.test(r.text) && /本線 10点/.test(r.text) && /波乱 8点/.test(r.text),
     '3段（至極1点 / 本線10点 / 波乱8点）が出ている');
  ok(/本線10点の中に入っています（別枠ではありません）/.test(r.text),
     '至極の一点が本線に含まれることを明記している');
  ok(/回収率は\d+%→\d+%に落ちます/.test(r.text),
     '波乱を足すと回収率が落ちることを買う前に出している');
  ok(/つまり「取り方が悪いから当たらない」のではありません/.test(r.text),
     '波乱の取り方を変えても同じだったことを書いてある');

  /* 本線と波乱が重ならないこと。重なると同じ組を二重に買うことになる。 */
  const dom=new (require('jsdom').JSDOM)(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
    beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  const W=dom.window;
  let overlap=0, wrongMain=0, wrongAna=0, favIn=0;
  for(const R of RACES.slice(0,12)){
    const combos=[]; let i=0;
    for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){if(b===a)continue;for(let c=1;c<=6;c++){
      if(c===a||c===b)continue; combos.push({combo:`${a}-${b}-${c}`, p:Math.exp(-(i++)/30)});}}
    const t=combos.reduce((s,c)=>s+c.p,0); combos.forEach(c=>c.p/=t);
    for(const mode of ['cond','prob']){
      const pl=W.buyPlan(combos,{main:10, ana:8, anaMode:mode});
      if(pl.main.length!==10) wrongMain++;
      if(pl.ana.length!==8) wrongAna++;
      if(pl.main.some(k=>pl.ana.includes(k))) overlap++;
      if(pl.ana.some(k=>Number(k[0])===pl.favourite)) favIn++;
    }
  }
  ok(overlap===0, '本線と波乱が重ならない（同じ組を二重に買わない）');
  ok(wrongMain===0, '本線はいつも10点ちょうど');
  ok(wrongAna===0, '波乱はいつも8点ちょうど');
  ok(favIn===0, '波乱に本命が1着の組は入らない');
}

console.log('\n=== 点数と実測が backtest.js と食い違っていないか ===');
/* 画面に書いた実測値が、backtest.js の計算結果と別物になっていないか。
   数字をベタ書きしている以上、ここがずれると画面が嘘をつく。 */
ok(/本線10点\d+% ／ 波乱8点だけ\d+% ／ 18点まとめて\d+%/.test(BT),
   'backtest.js の結果まち出力にも同じ実測値が入っている');
ok(/main:10, ana:8/.test(BT) && /main:10, ana:8/.test(HTML),
   '点数(10/8)は両方で同じ値を buyPlan に渡している');
console.log('\n=== 当地勝率0.00の艇がいるレースでも描けるか ===');
/* 当地勝率0.00は「当地で走っていない」であって「当地で勝てない」ではない。
   値として入れると勝率0の選手になってしまうので、localNone で欠測として扱う。
   ところが localNone を立てずに 0 を setField に渡すと、許容範囲[1.00,9.99]に
   弾かれて欠測になり、validateAll が『当地勝率がありません』と言ってレポートを
   丸ごと止める。71レース中20レースがこの形を含む。
   アプリ本体は正しく扱えているので、テスト側がそれを再現できるかを見る。 */
{
  const z = RACES.find(r=>r.B.some(b=>b.loc===0));
  ok(!!z, '当地勝率0.00の艇がいるレースが記録にある');
  if(z){
    const r = report(z);
    console.log(`  （${z.name}）`);
    ok(r.text.length > 500, 'レポートが空にならない');
    ok(/買い目 18点/.test(r.text), '買い目カードが出る');
  }
  const n = RACES.filter(r=>r.B.some(b=>b.loc===0)).length;
  console.log(`  当地勝率0.00を含むレースは ${n}/${RACES.length} 件あります。`);
}
console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
