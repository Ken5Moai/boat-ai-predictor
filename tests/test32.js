/* 締切前のオッズを、どこまで信じてよいか
   ------------------------------------------------------------------
   「締切時オッズを見てから買え」と書いたが、これは実行できない助言だった。
   締切時オッズは締切後にしか出ないので、見た時点でもう買えない。

   実測（当たった組6件）の、締切前オッズと確定払戻のズレ
     22分前 +63.7% / 18分前 -4.1% / 14分前 -46.4%
     11分前 -15.2% / 11分前 +26.7% /  4分前  +1.8%
   5分以上前は中央値26.7%・最大63.7%、向きも一方向ではない。
   5分未満は1件しかないので「直前なら安全」とも言えない。

   できるのは2つだけ。
     ・締切直前に取り直したオッズで、大きく割っている組だけ外す
     ・取り直せないなら、オッズで外す判断をしない
   ここで固定するのは「古いオッズで外す判断をさせない」こと。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};

const setLead=v=>{ d.getElementById('oddsLeadMin').value=String(v); return w.oddsTrust(); };

console.log('\n入力欄がある');
ok(d.getElementById('oddsLeadMin')!==null, '「締切まで何分のオッズか」の欄がある');
ok(d.getElementById('oddsLeadMin').value==='3', '既定は3分前');

console.log('\n古いオッズでは外す判断をさせない');
for(const m of [5,11,14,18,22,60]){
  const t=setLead(m);
  ok(t.ok===false, `${m}分前 → 外す判断をさせない`);
}
ok(/外さないでください/.test(setLead(14).why), 'その旨が文章に出る');
ok(/26\.7%/.test(setLead(14).why) && /63\.7%/.test(setLead(14).why),
   '実測のズレ（中央値26.7%・最大63.7%）を根拠として出す');

console.log('\n締切直前なら使ってよいが、言い切らない');
for(const m of [0,1,3,4]){
  const t=setLead(m);
  ok(t.ok===true, `${m}分前 → 使ってよい範囲`);
}
ok(/1件/.test(setLead(3).why),
   '5分未満の実測が1件しかないことを、あわせて伝える');
ok(/きわどい組は残す/.test(setLead(3).why), '直前でも、きわどい組は残すよう促す');

console.log('\n画面の表示');
ok(/このオッズで組を外さないでください/.test(HTML), '古いときは買い目カードにも警告を出す');
ok(/締切時オッズを見てから買う」はできません/.test(HTML),
   '「締切時オッズを見てから買う」ができないと明記している');
ok(/そう書いていたのは間違いでした/.test(HTML), '以前の助言が誤りだったと書いてある');
ok(/① 締切の直前/.test(HTML) && /② 取り直せないなら/.test(HTML),
   '実行できる2つの形を示している');
ok(/当たった組」だけを見た数字/.test(HTML),
   '実測が「当たった組だけ」の偏った標本だと断ってある');

console.log('\n既定の買い方は変えていない');
ok(d.getElementById('useEV').checked===false, '期待値方式は既定で切ったまま');
ok(/renderOddsBox\(\)\{\n  updateOddsLeadNote\(\);/.test(HTML),
   'オッズ欄を描くたびに判定を出し直す');
setLead(14); w.renderOddsBox();
ok(/外す判断をしないでください/.test(d.getElementById('oddsLeadNote').innerHTML),
   '古いときに注意書きが出る');
setLead(2); w.renderOddsBox();
ok(/外す判断をしてもよい/.test(d.getElementById('oddsLeadNote').innerHTML),
   '直前なら使ってよいと出る');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
