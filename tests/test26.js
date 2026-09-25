/* 前夜に書いた買い目が、モデルの出力とずれていたら止まること
   ------------------------------------------------------------------
   実際に起きた事故（2026-09-25 三国1R・2R）：
   screen.js が出した6点を screened.js に手で書き写すときに間違えた。
   1Rは6点のうち3点が違っていて、しかも正解の 3-1-2（¥8,940）は
   モデルの5番目に入っていたのに、手書きのリストからは抜けていた。
   「モデルは当てたが、渡したリストでは外れ」という、いちばん困る形。

   手で書き写す工程がある限り同じ事故は起きるので、
   screen.js に照合を入れた。ここではその照合が
   ・一致していれば通す
   ・1点でも違えば止める
   ・順番が違うだけでも止める（買い目は点数を切るときに順番で効く）
   ・rno が無い、card.js に無い、も止める
   を満たすか確かめる。 */
const path=require('path'),fs=require('fs');
const {execFileSync}=require('child_process');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(DIR,'screen.js'),'utf8');

/* screen.js の照合と同じ判定をここに写して、条件ごとに試す。
   screen.js を丸ごと走らせるとレースを12本採点するので毎回は重い。
   本体を1回だけ走らせる確認は下でやる。 */
function check(pend, rows){
  let bad=0, msg=[];
  for(const e of pend){
    if(e.rno==null){ msg.push('rno無し:'+e.name); bad++; continue; }
    const r=rows.find(x=>x.rno===e.rno);
    if(!r){ msg.push('card外:'+e.name); bad++; continue; }
    const a=(e.picks||[]).join(' '), b=r.top6.join(' ');
    if(a!==b){ msg.push('不一致:'+e.name); bad++; }
  }
  return {stop:bad>0, msg};
}
const T6=['1-2-3','2-1-3','1-3-2','1-2-4','1-2-5','2-1-4'];
const rows=[{rno:7, top6:T6}];

console.log('\n買い目の照合');
ok(check([{name:'7R',rno:7,picks:T6}],rows).stop===false,
   '一致していれば通る');
ok(check([{name:'7R',rno:7,picks:['1-2-3','2-1-3','1-3-2','1-2-4','2-1-4','1-2-5']}],rows).stop===true,
   '順番が違うだけでも止まる');
ok(check([{name:'7R',rno:7,picks:['1-2-3','2-1-3','1-3-2','1-2-4','1-2-5','1-2-6']}],rows).stop===true,
   '1点だけ違っても止まる');
ok(check([{name:'1R',rno:1,picks:['1-2-3','1-3-2','1-2-5','1-2-4','1-5-2','1-3-4']}],
         [{rno:1,top6:['1-2-3','1-3-2','1-2-5','2-1-3','3-1-2','1-2-6']}]).stop===true,
   '実際に起きた三国1Rの書き間違いを止められる ← 事故そのもの');
ok(check([{name:'7R',picks:T6}],rows).stop===true,
   'rno が無ければ止まる（照合できないものを通さない）');
ok(check([{name:'9R',rno:9,picks:T6}],rows).stop===true,
   'card.js に無いレースなら止まる');
ok(check([],rows).stop===false, '結果待ちが無ければ通る');

console.log('\nscreen.js の中身');
ok(/--emit/.test(src), '貼り付け用の出力（--emit）がある');
ok(/process\.exit\(1\)/.test(src), 'ずれたら終了コード1で止まる');
ok(/top6/.test(src), 'モデルの上位6点を保持している');

/* 本体を1回走らせて、いまの screened.js が照合を通ることを確かめる。
   ここが落ちるときは、書いてある買い目とモデルの出力が食い違っている。 */
console.log('\nいまのファイルの状態');
let out='',code=0;
try{ out=execFileSync(process.execPath,[path.join(DIR,'screen.js')],{encoding:'utf8'}); }
catch(e){ out=(e.stdout||'')+(e.stderr||''); code=1; }
ok(code===0, 'いまの screened.js は照合を通る');
ok(!/買い目がモデルの出力と違う/.test(out), '不一致の警告が出ていない');
ok(/【判定】/.test(out), '採用の判定が出ている');

/* 成績の集計が rank で決まっていること。
   手書きの picks で数えていると、書き間違いがそのまま成績になる。 */
const scr=fs.readFileSync(path.join(DIR,'screened.js'),'utf8');
ok(/rank:\s*5/.test(scr) && /pay:8940/.test(scr),
   '三国1Rは rank:5 の的中として記録されている（モデルの順位で数える）');
ok(/rank:\s*18/.test(scr) && /pay:6270/.test(scr),
   '三国2Rは rank:18 の外れとして記録されている');
/* 振り分けの照合。
   「外にA級あり」を避ける理由は「そちらのほうが当たらない」なので、
   避けたほうも数えないと理由が検証できない。数えるからには、
   都合のいいレースだけ拾えないようにしておく。 */
function split(rows, picked, avoided){
  let bad=0;
  for(const r of rows){
    if(picked.includes(r.rno)&&avoided.includes(r.rno)) bad++;
    if(picked.includes(r.rno)&&r.outA) bad++;
    if(avoided.includes(r.rno)&&!r.outA) bad++;
  }
  return bad>0;
}
const RS=[{rno:1,outA:false},{rno:2,outA:false},{rno:3,outA:true},{rno:4,outA:true}];
console.log('\n振り分けの照合');
ok(split(RS,[1,2],[3,4])===false, '正しい振り分けは通る');
ok(split(RS,[1,2,3],[3,4])===true, '同じレースが両方にあれば止まる');
ok(split(RS,[3],[4])===true,       '外にA級ありを picked 側に入れたら止まる');
ok(split(RS,[1],[2])===true,       '外にA級なしを avoided 側に入れたら止まる');
ok(split(RS,[1],[])===false,       'まだ結果を入れていないレースがあっても止めない');

const SC=require(path.join(DIR,'screened.js'));
ok(Array.isArray(SC.avoided)&&SC.avoided.length>0, '避けたほうの記録が存在する');
ok(SC.avoided.every(r=>r.rank!=null&&r.pay!=null&&r.rno!=null),
   '避けたほうの記録に rank・pay・rno がそろっている');
ok(SC.avoided.some(r=>r.pay>=20000&&r.rank>50),
   '高配当でモデルが遠かった例が残っている（三国6R ¥27,110 / 74番目）');
ok(/避けたほうを6点で買っていたら/.test(out), '避けたほうの成績が表示されている');
ok(!/振り分けが card\.js と合っていない/.test(out), '振り分けの警告が出ていない');

/* 見つけたデータ（in-sample）と、決めたあとのデータ（前向き）を
   混ぜて見ないこと。混ぜると「7件すべて的中」のような数字が出て、
   検証したつもりになる。 */
console.log('\nin-sample と前向きの区別');
ok(SC.every(r=>typeof r.fwd==='boolean'), '全レースに fwd がついている');
ok(SC.filter(r=>!r.fwd).length===7, '条件を見つけた28レースの中にあったのは7件');
ok(SC.filter(r=>r.fwd).length>0, '条件を決めたあとに選んだレースがある');
ok(SC.filter(r=>!r.fwd).every(r=>r.rank<=6),
   'in-sample の7件は全部的中している（だから検証にならない）');
ok(/条件を見つけたデータか、決めたあとのデータか/.test(out), 'その区別が表示されている');
ok(/判定その2/.test(out), '前向きぶんだけの判定が別に出ている');
ok(/条件は上とまったく同じ/.test(out), '判定その2の条件が元と同じだと明示されている');
ok(/この判定は先に書いたとおり全件で見る/.test(out),
   '元の判定を後から書き換えていないと明示されている');

/* 判定その2は元の判定を緩めたものであってはならない。
   必要な数字（100/100/95）が両方で同じであることを見る。 */
const need=(out.match(/必要 (\d+)/g)||[]).map(x=>+x.replace(/\D/g,''));
ok(need.length>=6 && need[0]===need[3] && need[1]===need[4] && need[2]===need[5],
   '2つの判定で必要な数字が同じ（後から緩めていない）');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
