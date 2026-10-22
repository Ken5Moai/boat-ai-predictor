/* 荒れ予想（本命が飛んだ場合に限った見方）
   ------------------------------------------------------------------
   穴枠（下限オッズ以上から確率順に選ぶ方式）は実測で回収率を下げた。
     本線6＋穴4で 50倍以上77% / 100倍以上53%（本線10のみは106%）
     100倍以上の穴は28レースで0回しか当たっていない
   なのでここでは「確率を足し直して見せる」だけにして、新しい仮定を足さない。

   ただし2着の条件つき分布には既知の欠陥がある。
   実測では2号艇が1着になった4レースで1号艇が2着に残ったのは0回、
   モデルは平均61%と言っていた。
   件数が足りないのでモデルは直さず、両方の読み方を並べて出す。

   ここで固定するのは次の3つ。
     ・条件つき確率が、足して100%になること（嘘の数字を出さない）
     ・「②外に限る」が本当に外の艇だけになっていること
     ・当てる道具ではないと画面に書いてあること */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window;
w.Element.prototype.scrollIntoView=function(){};

const combos=[];
for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) for(let c=1;c<=6;c++)
  if(a!==b&&a!==c&&b!==c) combos.push(`${a}-${b}-${c}`);
let acc=0;
const LIST=combos.map((combo,i)=>{ const p=Math.pow(0.96,i); acc+=p; return {combo,p}; });
LIST.forEach(x=>x.p/=acc);
LIST.sort((x,y)=>y.p-x.p);
const sum=o=>Object.values(o).reduce((a,b)=>a+b,0);

console.log('\n誰かが1着のときの、2着・3着の分布');
for(let a=1;a<=6;a++){
  const c=w.conditionalOnWinner(LIST,a);
  ok(Math.abs(sum(c.p2)-1)<1e-9 && Math.abs(sum(c.p3)-1)<1e-9,
     `${a}号艇が1着のとき、2着も3着も足して100%`);
  ok(c.p2[a]===undefined && c.p3[a]===undefined,
     `${a}号艇が1着のとき、同じ艇が2着3着に出てこない`);
  ok(c.list.length===20, `${a}号艇が1着の組は20通り（${c.list.length}）`);
  ok(c.list.every((x,i)=>i===0||c.list[i-1].p>=x.p), `${a}号艇の組が確率の高い順`);
}
{
  let t=0; for(let a=1;a<=6;a++) t+=w.conditionalOnWinner(LIST,a).win;
  ok(Math.abs(t-1)<1e-9, '6艇ぶんの1着確率を足すと100%');
}

console.log('\n本命が飛んだ場合に限った見方');
const U=w.upsetView(LIST,1);
ok(U.lanes.length===5, '本命を除いた5艇が出る');
ok(U.lanes.every(x=>x.lane!==1), '本命そのものは入らない');
ok(Math.abs(U.lanes.reduce((t,x)=>t+x.cond,0)-1)<1e-9,
   '飛んだ場合に限った確率が、足して100%');
ok(Math.abs(U.favP+U.restP-1)<1e-9, '本命の勝率と飛ぶ確率を足すと100%');
ok(U.lanes.every((x,i)=>i===0||U.lanes[i-1].raw>=x.raw), '勝ちやすい順に並ぶ');
ok(U.lanes.every(x=>x.cond>=x.raw), '条件つきにすると確率は必ず上がる（割り直しだから）');

console.log('\n「2着を外に限る」が正しいこと');
for(const a of [2,3,4]){
  const c=w.conditionalOnWinner(LIST,a);
  const o=w.outerSecond(c,a);
  ok(o.list.every(x=>Number(String(x.combo)[2])>a),
     `${a}号艇が1着のとき、2着が${a}より外の艇だけになっている`);
  ok(o.list.every(x=>Number(String(x.combo)[0])===a), `1着は${a}号艇のまま`);
  ok(Math.abs(o.tot-o.list.reduce((t,x)=>t+x.p,0))<1e-12, '合計が中身の足し算と一致');
  ok(o.share>=0 && o.share<=1, '割合が0〜1に収まる');
}
{
  const c=w.conditionalOnWinner(LIST,6);
  ok(w.outerSecond(c,6).list.length===0, '6号艇が1着なら「外」は存在しないので0件');
}

console.log('\n正直に扱えること');
ok(/この枠を本線に足すと、31レースで的中が1つも増えませんでした/.test(HTML),
   '本線に足しても的中が増えなかった実測を画面に出している');
ok(/的中数が17のまま変わっていません/.test(HTML), '的中数が変わらないことを明記している');
ok(/投資だけが増えています/.test(HTML), '投資だけ増えると書いてある');
ok(/100倍以上53%/.test(HTML) && /本線10のみは106%/.test(HTML),
   '穴枠が回収率を下げた実測を画面に出している');
ok(/平均41\.3番目/.test(HTML), '高配当ほどモデルが遠いことを書いてある');
ok(/②の読み方はまだ検証できていません/.test(HTML), '②が未検証だと明記している');
ok(/n=4ずつなので採用していません/.test(HTML), '件数が足りないことを書いてある');
ok(/上の「買い目」とは別枠です/.test(HTML), '通常の買い目とは別枠だと書いてある');
ok(/両方買うと点数も金額も増えます/.test(HTML), '両方買うと増えると注意している');
ok(/upsetView\(combos/.test(HTML) && /outerSecond\(x, x\.lane\)/.test(HTML),
   'レポートで実際に使っている');
ok(/U\.restP < 0\.08/.test(HTML), '本命が堅すぎるレースでは出さない');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
