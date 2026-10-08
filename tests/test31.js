/* オッズを貼り付けで取り込めること（通信不要）
   ------------------------------------------------------------------
   自動取得はプロキシ経由なので通らない日がある。そのたびに120個の数字を
   人が書き写すのは、時間がかかるうえに間違える。
   実際この会話では、私が1レースぶん120個を手で書き写しており、
   1レース集めるのに一番時間がかかっていたのがここだった。

   貼り付けでも、読み取りの規則と検算は自動取得とまったく同じにする。
   ここで固定したいのは「読めなかったものを読めたことにしない」こと。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
const ODDS=require(path.join(DIR,'odds.js'))['若松11R 準優勝戦'];
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const state=w.eval('state');

const combos=w.allTrifecta();
const put=t=>{ state.oddsMap={}; d.getElementById('oddsPasteBox').value=t; w.parseOddsPaste(); return state.oddsMap; };
const correct=m=>{ let n=0; for(const k in ODDS) if(m[k]===ODDS[k]) n++; return n; };

console.log('\n画面にある');
ok(d.getElementById('oddsPasteBox')!==null, '貼り付け欄がある');
ok(/parseOddsPaste/.test(HTML), '取り込みの関数が呼ばれている');
ok(/通信不要/.test(HTML), '通信不要だと書いてある');

console.log('\n組番つきで貼ったとき（いちばん安全な形）');
let m=put(Object.entries(ODDS).map(([k,v])=>k+'  '+v).join('\n'));
ok(Object.keys(m).length===120, `120通り取り込めた（${Object.keys(m).length}）`);
ok(correct(m)===120, `120通りすべて正しい組に対応（${correct(m)}/120）`);

console.log('\n数字だけ貼ったとき（公式の並び）');
m=put(combos.map(k=>ODDS[k].toFixed(1)).join('\n'));
ok(Object.keys(m).length===120, '120通り取り込めた');
ok(correct(m)===120, `並びを当てて全部正しく対応（${correct(m)}/120）`);

console.log('\n前に余計な数字が付いていても直せること');
m=put('99.9\n12.3\n'+combos.map(k=>ODDS[k].toFixed(1)).join('\n'));
ok(correct(m)===120, `読み飛ばして正しく対応（${correct(m)}/120）`);

console.log('\n読めないものを読めたことにしないこと');
m=put('ここにはオッズがありません');
ok(Object.keys(m).length===0, 'オッズが無い文章は取り込まない');
ok(/読み取れませんでした/.test(d.getElementById('oddsNotice').textContent), 'その旨が画面に出る');

m=put(combos.map(()=>'2.0').join('\n'));
ok(Object.keys(m).length===0,
   '全部2.0倍のような、ありえない表は弾く（Σ(1/オッズ)の検算）');

/* 並びをでたらめにしたもの。値の集合は正しいので Σ(1/オッズ) は通るが、
   組との対応が壊れている。順位相関の検算で弾けなければならない。 */
let seed=7;
const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
const shuffled=combos.map(k=>ODDS[k]);
for(let i=shuffled.length-1;i>0;i--){ const j=Math.floor(rnd()*(i+1)); [shuffled[i],shuffled[j]]=[shuffled[j],shuffled[i]]; }
m=put(shuffled.map(v=>v.toFixed(1)).join('\n'));
ok(Object.keys(m).length===0 || correct(m)===120,
   `並びをでたらめにしたものは、弾くか正しく直すかのどちらか（取り込み${Object.keys(m).length}通り・正解${correct(m)}）`);

console.log('\n自動取得と同じ規則を使っていること');
ok(/parseOdds3t\(raw, modelProbMap\(\)\)/.test(HTML), '解析は自動取得と同じ関数');
ok(/検算 Σ\(1\/オッズ\)/.test(HTML), '検算の結果を画面に出す');
const i1=HTML.indexOf('function parseOddsPaste'), i2=HTML.indexOf('\n}', i1);
ok(!/oddsMap\s*=\s*map/.test(HTML.slice(i1,i2).replace('state.oddsMap = res.map','')),
   '検算を通さずにオッズを入れる抜け道が無い');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
