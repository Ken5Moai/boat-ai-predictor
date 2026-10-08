/* 穴枠（本線とは別に、高配当だけを狙う口）
   ------------------------------------------------------------------
   「本線6口・穴4口」のように分けて買えるようにした枠。
   ただし手元の28レースでは、足すほど回収率が下がった。

     本線6のみ                      合計 89%
     本線6＋穴4（20倍以上）          合計 97%
     本線6＋穴4（50倍以上）          合計 77%
     本線6＋穴4（100倍以上）         合計 53%（穴は0/28）
     本線10のみ                     合計106%

   なので既定は0口。ここで固定したいのは次の4つ。
     1. 既定で有効にならないこと（黙って成績を下げない）
     2. 本線と重ならないこと（同じ組を2回買わない）
     3. 下限オッズ未満の組を穴に入れないこと
     4. 予算を黙って超えないこと（穴は本線の予算の中から取る） */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const state=w.eval('state');

/* 確率の高い順に並べた120通りを作る（合計1になるようにする） */
const combos=[];
for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) for(let c=1;c<=6;c++)
  if(a!==b&&a!==c&&b!==c) combos.push(`${a}-${b}-${c}`);
let acc=0;
const LIST=combos.map((combo,i)=>{ const p=Math.pow(0.95,i); acc+=p; return {combo,p}; });
LIST.forEach(x=>x.p/=acc);
LIST.sort((x,y)=>y.p-x.p);

console.log('\n1. 既定で有効にならないこと');
ok(d.getElementById('anaCount')!==null, '穴の口数の欄がある');
ok(d.getElementById('anaCount').value==='0', '既定は0口');
ok(d.getElementById('anaMinOdds').value==='50', '下限オッズの既定は50倍');
ok(w.chooseAna(LIST,[],0,50).points.length===0, '0口なら1つも選ばない');
ok(/既定は0口/.test(HTML), '既定が0口であることが書いてある');
ok(/0%（0\/28）/.test(HTML), '100倍以上が0/28だったことを画面に出している');

console.log('\n2. 本線と重ならないこと');
state.oddsMap={};
const main=LIST.slice(0,6);
const a1=w.chooseAna(LIST, main, 4, 50);
ok(a1.points.length===4, `4口選べた（${a1.points.length}口）`);
ok(a1.points.every(p=>!main.some(m=>m.combo===p.combo)), '本線の6点と1つも重なっていない');
ok(new Set(a1.points.map(p=>p.combo)).size===a1.points.length, '穴の中にも重複が無い');

console.log('\n3. 下限オッズ未満を入れないこと');
for(const min of [30,50,100,200]){
  const r=w.chooseAna(LIST, main, 6, min);
  const bad=r.points.filter(p=>0.75/p.p < min);
  ok(bad.length===0, `下限${min}倍: 未満の組が混ざっていない（${r.points.length}口）`);
}
ok(w.chooseAna(LIST, main, 4, 50).estimated===true,
   'オッズ未入力のときは「見積もり」と分かる印が立つ');
/* 実オッズを入れたら、そちらが優先されること */
state.oddsMap={}; LIST.forEach((x,i)=>{ state.oddsMap[x.combo]= i<10 ? 5 : 999; });
const a2=w.chooseAna(LIST, main, 3, 100);
ok(a2.estimated===false, '全部にオッズがあれば見積もりは使わない');
ok(a2.points.every(p=>state.oddsMap[p.combo]>=100), '実オッズが下限以上の組だけ選ぶ');
ok(a2.points.every(p=>state.oddsMap[p.combo]!==5), 'オッズ5倍の組は穴に入らない');
state.oddsMap={};

console.log('\n4. 予算を黙って超えないこと');
ok(/budget - anaWant\*100/.test(HTML), '穴のぶんを本線の予算から引いている');
ok(/unitsAll - 1/.test(HTML), '本線が0点にならないよう口数を抑えている');
ok(/穴の口数を減らしました/.test(HTML), '予算不足で減らしたときに画面へ出す');

console.log('\n選び方が確率順であること（期待値順にしない）');
const a3=w.chooseAna(LIST, main, 5, 50);
const ps=a3.points.map(p=>p.p);
ok(ps.every((v,i)=>i===0||ps[i-1]>=v), '穴は確率の高い順に並んでいる');
ok(/期待値順にはしない/.test(HTML), '期待値順にしない理由が書いてある');

console.log('\n画面の表示');
ok(/穴枠 \$\{anaPoints\.length\}口/.test(HTML), '穴枠の見出しに口数が出る');
ok(/本線\$\{points\.length\}口 ＋ 穴\$\{anaPoints\.length\}口/.test(HTML),
   '合計点数が「本線○口＋穴○口」で出る');
ok(/compressCombos\(anaPoints/.test(HTML), '穴枠もまとめ表記で出す');
ok(/当てるための枠ではなく/.test(HTML), '当てる枠ではないと明記している');
ok(/41\.3番目/.test(HTML), '高配当でモデルが遠いことを数字で出している');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
