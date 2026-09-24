/* 配信用の書き出し ― 「都合の良い回だけ載せる」を仕組みで塞ぐ
   ------------------------------------------------------------------
   予想を売るときにいちばん問題になるのは中身ではなく見せ方。
   当たった回だけ載せれば、どんな予想でも好成績に見える。

   だから予想テキストには通算成績を必ず貼りつけ、
   その成績は保存されている全記録から計算する。
   外れたレースを記録から消さないかぎり、数字は良くならない。

   ここが壊れると、実測が支持していない主張を売ることになる。 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
 {runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.alert=()=>{};
    w.confirm=()=>true; w.fetch=async()=>{throw new Error('x')}; }});
const w=dom.window,d=dom.window.document;
w.Element.prototype.scrollIntoView=function(){};

/* 3レースぶんの記録を作る。1つだけ的中、2つは外れ。 */
const mk = (rno,combo,payout,picks) => ({
  id:'2026-09-24_19_'+rno, date:'2026-09-24', jcd:'19', rno,
  savedAt:'2026-09-24T10:00:00.000Z',
  order:[1,2,3,4,5,6],
  picks: picks.map(c=>({combo:c, amount:100})),
  result:{ combo, first:Number(combo[0]), second:Number(combo[2]), third:Number(combo[4]), payout }
});
w.eval('saveRecords')([
  mk(1,'1-2-3',1000,['1-2-3','1-2-4']),   /* 的中: 投200 戻1000 */
  mk(2,'6-5-4',9000,['1-2-3','1-2-4']),   /* 外れ: 投200 戻0 */
  mk(3,'3-1-2',5000,['1-2-3','1-2-4'])    /* 外れ: 投200 戻0 */
]);

console.log('\n通算成績は全記録から出る');
const lines=w.careerLines().join('\n');
console.log('    '+lines.replace(/\n/g,'\n    '));
ok(/通算 3レース/.test(lines), '3レースすべてが数に入る');
ok(/的中 1\/3/.test(lines), '的中は1回だけと正しく出る');
ok(/回収率 167%/.test(lines), '回収率は投600円→戻1000円で167%');
ok(/選別なし/.test(lines), '「選別なし」と明記される');

console.log('\n外れを消さないかぎり数字は良くならない');
{
  const before=w.careerLines().join('\n');
  /* 外れレースを1件消してみる＝人が記録を削った場合 */
  const list=w.loadRecords().filter(r=>r.rno!==2);
  w.eval('saveRecords')(list);
  const after=w.careerLines().join('\n');
  ok(before!==after, '記録を消せば数字は変わる（＝数字は記録そのもの）');
  ok(/通算 2レース/.test(after), 'レース数も一緒に減るので、消したことが見える');
  /* 戻す */
  w.eval('saveRecords')([
    mk(1,'1-2-3',1000,['1-2-3','1-2-4']),
    mk(2,'6-5-4',9000,['1-2-3','1-2-4']),
    mk(3,'3-1-2',5000,['1-2-3','1-2-4'])
  ]);
}

console.log('\n予想テキストに成績と注記が必ず入る');
d.getElementById('venue').value='19';
d.getElementById('raceNo').value='5';
d.getElementById('raceDate').value='2026-09-25';
const post=w.buildPostText([{combo:'1-2-3'},{combo:'1-2-4'}],[100,100]);
ok(/下関5R/.test(post), 'レースが分かる');
ok(/1-2-3  100円/.test(post), '買い目と金額が入る');
ok(/予想時刻/.test(post) && /締切前に出しています/.test(post), '予想時刻が入る');
ok(/通算 3レース/.test(post), '通算成績がそのまま入る');
ok(/的中 1\/3/.test(post), '外れも含んだ数字が入る');
ok(/当たった回だけ載せることはできません/.test(post), '選別できない旨が入る');
ok(/控除率は25%/.test(post), '控除率の注記が入る');
ok(/保証するものではありません/.test(post), '保証しない旨が入る');

console.log('\n成績表は全レースが入る');
const rec=w.buildRecordPost();
ok(/1R/.test(rec) && /2R/.test(rec) && /3R/.test(rec), '3レースすべてが行として出る');
ok(/的中/.test(rec), '的中した回が分かる');
ok((rec.match(/—/g)||[]).length>=2, '外れた回も行として残る');
ok(/選別なし/.test(rec), '選別なしと書いてある');
ok(/控除率は25%/.test(rec), '注記が付く');

console.log('\n注記の文言は1か所にまとまっている');
{
  const note=w.eval('POST_NOTE');
  ok(Array.isArray(note) && note.length===3, '注記は3行で定義されている');
  ok(note.every(n=>post.includes(n)), '予想テキストに全部入る');
  ok(note.every(n=>rec.includes(n)), '成績表にも全部入る');
}

console.log('\nX用の短い版は140字に収まる');
{
  d.getElementById('venue').value='19';
  d.getElementById('raceNo').value='5';
  const mkPts=n=>Array.from({length:n},(_,i)=>({combo:`1-2-${i%4+3}`}));
  for(const n of [6,10,12]){
    const pts=mkPts(n);
    const t=w.buildPostShort(pts, pts.map(()=>100));
    ok(w.xLen(t)<=140, `${n}点なら ${w.xLen(t)}字で収まる`);
  }
  const t6=w.buildPostShort(mkPts(6), mkPts(6).map(()=>100));
  ok(/下関5R/.test(t6), 'レースが分かる');
  ok(/全レース記録・選別なし/.test(t6), '選別なしの注記が残る');
  ok(/控除率25%/.test(t6) && /保証はありません/.test(t6), '控除率と無保証の注記が残る');
  ok(/通算/.test(t6), '通算成績が入る');
}

console.log('\n字数の数え方（全角2・半角1）');
ok(w.xLen('あいう')===3, '全角3文字は3字');
ok(w.xLen('abcdef')===3, '半角6文字は3字ぶん');
ok(w.xLen('')===0, '空なら0');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
