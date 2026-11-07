/* 「モデルは市場に勝てているか」の測定が、画面と食い違っていないか
   ------------------------------------------------------------------
   控除率は約25%ある。何も考えずに買えば回収率75%になる。
   それを超えるには「市場より正しい確率」が要る。
   edge.js はそれがあるかを測り、data/edge.js に書き出す。

   ここで見るのは2つ。
     ・画面に出している数字が data/edge.js と一致しているか
     ・結論の向き（勝てていない）が、測定値と矛盾していないか
   edge.js 自体は数分かかるので、ここでは走らせない。
   数字が古くなったら node edge.js --save を走らせる。 */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

ok(fs.existsSync(path.join(ROOT,'edge.js')), 'edge.js（市場に勝てているかを測る道具）がある');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const P=path.join(ROOT,'data','edge.js');
if(!fs.existsSync(P)){
  ok(!/id="edgeN"/.test(HTML),
     'data/edge.js が無いなら、画面にも測定値を出していない');
  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exitCode = fail?1:0;
  return;
}
const E=require(P);
console.log('\n=== 画面の数字が data/edge.js と一致しているか ===');
{
  const want={ edgeAt:E.measuredAt, edgeN:E.races, edgeTest:E.testRaces,
    edgeB:E.blendB, edgeRetM:E.retMarket10, edgeRetB:E.retBlend10,
    edgeBand:E.bestBand, edgeBandPct:E.bestBandPct, edgeLearn:E.learnGain };
  const ids=[...HTML.matchAll(/<span id="(edge[A-Za-z]+)(\d*)">([^<]*)<\/span>/g)]
    .map(m=>({id:m[1]+m[2], key:m[1], val:m[3]}));
  ok(ids.length>=8, `測定値が ${ids.length}個、span id で置かれている`);
  for(const k of Object.keys(want))
    ok(ids.some(x=>x.key===k), `${k} が画面にある`);
  for(const x of ids){
    if(want[x.key]==null){ ok(false, `${x.id} は data/edge.js に無い`); continue; }
    ok(x.val===String(want[x.key]),
      `${x.id} 画面 ${x.val} = 測定 ${want[x.key]}`
      + (x.val===String(want[x.key])?'':'  → node sync-figures.js を走らせること'));
  }
  /* sync-figures が全部の span を持っているか */
  const SF=fs.readFileSync(path.join(ROOT,'sync-figures.js'),'utf8');
  ok(/edge\.js/.test(SF) && /edgeBandPct/.test(SF),
     'sync-figures.js が data/edge.js を読んで span を埋める');
}

console.log('\n=== 結論の向きが、測定値と矛盾していないか ===');
{
  /* 勝てていると言えるのは、どれか1つでも閾値を超えたとき。
     edge.js の判定と同じ式をここにも置き、2か所がずれたら落とす。 */
  const edge = (E.blendGain > 0.02) || (E.bestBandPct >= 100) || (E.learnGain > 0.02);
  ok(edge===E.edge,
     `data/edge.js の結論（${E.edge?'勝てている':'勝てていない'}）が測定値から導ける`);
  const claims=/モデルは市場に勝てていません/.test(HTML);
  ok(claims===!E.edge,
     E.edge ? '勝てているのに「勝てていません」と書いていない'
            : '画面が「モデルは市場に勝てていません」と書いている');
  ok(E.bestBandPct<100 || /100%を超える帯/.test(HTML)===false,
     '100%を超える帯が出たら、画面の「100%を超える帯はありません」は書き直す');
  /* 混ぜたほうが良くなっているなら、結論を書き直す合図。 */
  ok(!(E.retBlend10 > E.retMarket10 + 3),
     `混ぜたほうが大きく良くなっていない（市場${E.retMarket10}% / 混ぜて${E.retBlend10}%）`
     + (E.retBlend10 > E.retMarket10+3 ? '  → 逆転した。測り直して結論を書き直すこと':''));
}

console.log('\n=== today.js が測定どおりに答えるか ===');
{
  const {execFileSync}=require('child_process');
  ok(fs.existsSync(path.join(ROOT,'today.js')), 'today.js（買っていいかを答える入口）がある');
  let out='';
  try{ out=execFileSync(process.execPath,[path.join(ROOT,'today.js')],
        {encoding:'utf8', maxBuffer:8*1024*1024, timeout:60000}); }
  catch(e){ out=(e.stdout||'')+(e.stderr||''); }
  ok(/いま、買っていいのか/.test(out), 'today.js が最後まで走る');
  if(E.edge){
    ok(/買ってよい/.test(out), '測定が「勝てている」なら、そう答える');
  }else{
    ok(/買わないほうがよい/.test(out), '測定が「勝てていない」なら、買わないと答える');
    ok(!/◎ 買ってよい/.test(out), '勝てていないのに「買ってよい」とは言わない');
  }
  ok(out.includes(`${E.retMarket10}%`), '画面と同じ測定値を出している');
  const T=fs.readFileSync(path.join(ROOT,'today.js'),'utf8');
  ok(T.includes("data/edge.js"),
     'today.js の答えは data/edge.js から来ている（気分で変えられない）');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exitCode = fail?1:0;
