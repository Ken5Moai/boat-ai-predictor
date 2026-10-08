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

/* 穴枠は本線に「上乗せ」する（本線の点数を削らない）。
   削ると、成績が下がったとき穴のせいか本線を減らしたせいか分からなくなる。
   そのかわり、上乗せぶんを1日の上限から引き忘れると、
   穴枠を使うほど上限を黙って超えることになる。ここがいちばん危ない。 */
console.log('\n4. 上乗せぶんが1日の上限から必ず引かれること');
const setBank=(cap,races,ana)=>{
  d.getElementById('dayCap').value=String(cap);
  d.getElementById('dayRaces').value=String(races);
  d.getElementById('anaCount').value=String(ana);
  try{ w.localStorage.removeItem('boat-bank-v1'); }catch(e){}
};
setBank(3000,3,0);
ok(w.perRace()===1000, `本線は1レース1,000円（${w.perRace()}）`);
ok(w.anaSpend()===0, '穴0口なら上乗せ0円');
ok(w.raceSpend()===1000, '総額は本線のみ');
setBank(3000,3,4);
ok(w.perRace()===1000, '穴を足しても本線の金額は変わらない（削らない）');
ok(w.anaSpend()===400, '穴4口で400円');
ok(w.raceSpend()===1400, `総額は1,400円（${w.raceSpend()}）`);
ok(w.bankState().spend===1400, '打ち止めの判定も総額で見ている');

console.log('\n   買ったときに上限から引かれる額');
setBank(3000,3,4);
w.markBought();
let bk=w.bankState();
ok(bk.used===1400, `1回目で1,400円引かれる（${bk.used}）← 本線だけだと1,000円になってしまう`);
ok(bk.left===1600, `残りは1,600円（${bk.left}）`);
w.markBought();
bk=w.bankState();
ok(bk.used===2800, `2回目で合計2,800円（${bk.used}）`);
ok(bk.done===true, '残り200円では1,400円に足りないので打ち止めになる');
ok(/今日はここまでです/.test(d.getElementById('bankBox').innerHTML), '打ち止めが画面に出る');
ok(/本線 1,000円 ＋ 穴枠 400円 ＝/.test(d.getElementById('bankBox').innerHTML),
   '内訳（本線＋穴＝総額）が画面に出る');

console.log('\n   残りが足りなければ穴を減らすこと（本線は削らない）');
setBank(3000,3,6);
w.markBought();                       /* 1回買って残り1,400円 */
bk=w.bankState();
ok(bk.left===1400, `残り1,400円（${bk.left}）`);
/* 残り1,400円 − 本線1,000円 = 400円 → 穴は4口までしか乗らない */
ok(Math.floor((bk.left-1000)/100)===4, '残りから乗せられるのは4口まで');
ok(/穴の口数を減らしました|口に減らしました/.test(HTML), '減らしたことを画面に出す作りになっている');
ok(/const mainBudget = budget;/.test(HTML), '本線の予算は穴に削られない');
ok(/b\.used \+= st\.spend/.test(HTML), '上限から引くのは総額（本線だけではない）');
setBank(5000,5,0);
try{ w.localStorage.removeItem('boat-bank-v1'); }catch(e){}
w.onBankChange();

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
