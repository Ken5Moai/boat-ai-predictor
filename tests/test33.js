/* 着順ごとの確率と、軸を決めて流す買い方
   ------------------------------------------------------------------
   2026-10-22 若松10R。モデルの10点も有料noteの19点も外れ、
   本人が 4-全-5（4点）で 4-3-5 を取った（388.7倍）。
   本人の言葉は「4がいって、5がついていけず3着、2着は分からんけん全」。

   モデルは120通りを確率順に並べるだけで、
   「誰が1着か」「誰が3着か」という着順ごとの確信を外に出していなかった。
   確率は Plackett-Luce の計算の中にすでにある。出していなかっただけ。

   ここで固定するのは次の3つ。
     ・着順ごとの確率が、組み合わせの確率と矛盾しないこと
     ・軸流しの点数と中身が正しいこと（買い間違いになるため）
     ・モデルが 4-全-5 を推すわけではない、と正直に扱えること */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window;
w.Element.prototype.scrollIntoView=function(){};

/* 合計1になる作り物の確率で試す */
const combos=[];
for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) for(let c=1;c<=6;c++)
  if(a!==b&&a!==c&&b!==c) combos.push(`${a}-${b}-${c}`);
let acc=0;
const LIST=combos.map((combo,i)=>{ const p=Math.pow(0.96,i); acc+=p; return {combo,p}; });
LIST.forEach(x=>x.p/=acc);
LIST.sort((x,y)=>y.p-x.p);

console.log('\n着順ごとの確率');
const PP=w.positionProbs(LIST);
for(const k of ['p1','p2','p3']){
  const sum=[1,2,3,4,5,6].reduce((t,l)=>t+PP[l][k],0);
  ok(Math.abs(sum-1)<1e-9, `${k} の6艇ぶんの合計が1（${sum.toFixed(6)}）`);
}
ok([1,2,3,4,5,6].every(l=>['p1','p2','p3'].every(k=>PP[l][k]>=0&&PP[l][k]<=1)),
   'すべて0〜1の範囲に入っている');
/* 手でも数えて突き合わせる */
let hand=0; for(const c of LIST) if(String(c.combo)[0]==='1') hand+=c.p;
ok(Math.abs(PP[1].p1-hand)<1e-12, '1号艇の1着確率が手計算と一致する');
let hand3=0; for(const c of LIST) if(String(c.combo)[4]==='3') hand3+=c.p;
ok(Math.abs(PP[3].p3-hand3)<1e-12, '3号艇の3着確率が手計算と一致する');

console.log('\n軸を決めて流す買い方');
const WH=w.wheelCandidates(LIST);
ok(WH.length>0, `候補が出る（${WH.length}件）`);
ok(WH.every(x=>x.n===4), 'どの形も4点（6艇なので流すのは4通り）');
ok(WH.every(x=>new Set(x.combos).size===x.n), '同じ組が2回入らない');
ok(WH.every(x=>x.combos.every(k=>/^[1-6]-[1-6]-[1-6]$/.test(k)&&new Set(k.split('-')).size===3)),
   '中身がすべて正しい3連単の形');
ok(WH.every((x,i)=>i===0||WH[i-1].p>=x.p), '合計確率の高い順に並んでいる');

const byText=t=>WH.find(x=>x.text===t);
const w45=byText('4-全-5');
ok(!!w45, '4-全-5 が候補にある');
ok(w45.combos.join(' ')==='4-1-5 4-2-5 4-3-5 4-6-5',
   `4-全-5 の中身が正しい（${w45.combos.join(' ')}）`);
ok(w45.combos.includes('4-3-5'), '実際に当たった 4-3-5 を含んでいる');
/* 合計確率が、中身を足したものと一致すること（買い間違いの防止） */
const byC={}; LIST.forEach(c=>byC[String(c.combo)]=c.p);
ok(Math.abs(w45.p - w45.combos.reduce((t,k)=>t+byC[k],0))<1e-12,
   '合計確率が中身の足し算と一致する');

console.log('\n3つの形がすべて出ること');
ok(byText('1-4-全') && byText('1-全-4') && byText('全-1-4'),
   'A-B-全 / A-全-C / 全-B-C の3種類が出る');
ok(byText('1-全-1')===undefined && byText('1-1-全')===undefined,
   '同じ艇を2か所に置いた形は作らない');

console.log('\n正直に扱えること');
ok(/モデルは120通りを確率順に並べるだけ/.test(HTML),
   'なぜ出していなかったのかが書いてある');
ok(/4-全-5/.test(HTML) && /388\.7倍/.test(HTML),
   'きっかけになったレースが記録されている');
ok(/上の「買い目」とは別の考え方/.test(HTML),
   '通常の買い目とは別物だと明記している');
ok(/両方買うと点数が倍/.test(HTML), '両方買わないよう注意している');
ok(/2着を1艇に決めるより、流したほうが理にかなっています/.test(HTML),
   '2着が割れているときに、流しを勧める文言がある');

console.log('\n画面に出ること');
ok(/着順ごとの確率/.test(HTML), 'レポートに着順ごとの確率の節がある');
ok(/軸を決めて流す買い方（合計確率の高い順）/.test(HTML), '軸流しの節がある');
ok(/positionProbs\(combos\)/.test(HTML), 'レポートで実際に呼んでいる');
ok(/wheelCandidates\(combos\)/.test(HTML), '同上');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
