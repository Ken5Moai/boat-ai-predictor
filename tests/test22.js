/* イン率の補正が、イン率の高い場でも効いていることを固定する
   ------------------------------------------------------------------
   実際にあった不具合：枠の目安の点で1号艇の基準が100（＝上限）だったため、
   laneVal + (inRate-55)*adj を 0〜100 に丸めた時点で加点が消えていた。
   イン率60%の徳山と55%の浜名湖で1号艇の点がどちらも100になり、
   「イン天国ほどインが強い」という補正が、イン率55%以上の場
   （24場のうち半分近く）でまったく効いていなかった。
   競艇場ごとに1号艇の確率を並べるまで気づけなかった種類の不具合。 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(HTML_PATH,'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.alert=()=>{};
   w.fetch=async()=>{throw new Error('x')}; }});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');

/* 同じ6人を場だけ変えて採点し、1号艇の「枠」の点を取り出す。
   選手側を全員同じにしておかないと、場の効果だけを見られない。 */
function laneScore(jcd, lane){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  ['4396','3859','3710','3284','5078','4750'].forEach((reg,i)=>{ d.getElementById('reg'+(i+1)).value=reg; });
  w.syncRegsFromInputs();
  for(let i=0;i<6;i++){ const b=w.boatOf(i+1);
    setField(b,'name','X','official'); setField(b,'grade','B1','official');
    setField(b,'nationalWinRate',5.0,'official'); setField(b,'motor2Rate',30,'official');
    setField(b,'boat2Rate',30,'official'); setField(b,'averageST',0.17,'official');
    setField(b,'exhibitionTime',6.85,'official'); setField(b,'exhibitionST',0.10,'official'); }
  d.getElementById('venue').value=jcd;
  w.scoreAll();
  const p=state.boats[lane-1].scoreBreakdown.find(x=>/場特性/.test(x.label));
  return p ? p.val : null;
}

console.log('\nイン率の高い場でも1号艇の加点が効くか');
const toda=laneScore('02',1);      /* 戸田 47% */
const kiryu=laneScore('01',1);     /* 桐生 52% */
const mikuni=laneScore('10',1);    /* 三国 54% */
const hamana=laneScore('06',1);    /* 浜名湖 55% */
const shimo=laneScore('19',1);     /* 下関 58% */
const toku=laneScore('18',1);      /* 徳山 60% */

ok(toda<kiryu && kiryu<mikuni && mikuni<hamana, 'イン率55%まで、イン率が高いほど1号艇の点が高い');
ok(hamana<shimo, '浜名湖(55%)より下関(58%)のほうが高い ← 以前は同じ100だった');
ok(shimo<toku,   '下関(58%)より徳山(60%)のほうが高い ← 以前は同じ100だった');
ok(toku<=100,    '最もイン率の高い場でも100を超えない');
ok(toku>=99,     '最もイン率の高い場では100に届く（上限を使い切っている）');

console.log('\n他の枠は逆向きに動く');
const toku6=laneScore('18',6), toda6=laneScore('02',6);
ok(toku6<toda6, 'イン天国(徳山)の6号艇は、イン受難場(戸田)の6号艇より低い');

console.log('\nイン率55%未満の場では、この修正で枠の差が変わっていないこと');
/* 天井に当たらない場では、1号艇と6号艇の差は式どおりのまま。
   基準を8点下げても、両方が同じだけ下がるので差は変わらない。
   三国(54%): (92-1.6) - (26+0.6) = 63.8。修正前は (100-1.6) - (34+0.6) = 63.8。 */
const mikuni6=laneScore('10',6);
ok(Math.abs((mikuni-mikuni6)-63.8)<0.1, '三国の1号艇と6号艇の差は63.8のまま（修正前と同じ）');
const kiryu6=laneScore('01',6);
ok(Math.abs((kiryu-kiryu6)-(66+(52-55)*2.2))<0.1, '桐生の差も式どおり（天井に当たらない）');
/* 天井に当たっていた場では、差が広がったのが正しい姿。 */
ok((toku-toku6)>(mikuni-mikuni6), 'イン天国の徳山では1号艇と6号艇の差が三国より大きい');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
