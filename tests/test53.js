/* 判定で「採らない」と決めたものが、黙って入ってこないか見張る
   ------------------------------------------------------------------
   2026-11-03 までに判定が済んだものは、こうなっている。

     判定④⑤⑥⑦  欠けたので採らない
     判定⑧        2026-10-30 に一度「満たした」と出たが、11/2 を足して裏返った。
                   35場日413レースで 91% / 82%。採らない。
     判定⑨        今節着順をコース別で測る。923レースで良くならない。採らない。

   判定⑨のコードは残してある（消すと次に思いついたとき測り直すことになる）。
   残すなら、既定で入らないことを機械で見張らないといけない。
   人が目で確かめる約束は、1か月後には守られない。

   判定⑧のほうは、走らせるたびに測り直す形のままにしてある。
   数字が増えて結論が変われば、そのとき出力が変わってほしいから。
   ただし「10/30 に一度満たした」という経過が消えると、
   同じ罠（少ない本数で満たしたと言う）を踏み直すので、そこを見張る。 */
const fs=require('fs'), path=require('path');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');
const HTML=read('index.html'), BT=read('backtest.js');

console.log('\n=== 判定⑨（今節着順をコース別で測る）は既定で使わない ===');

ok(/__RECENT_BY_COURSE/.test(HTML), 'index.html に判定⑨の切り替えがある');

/* 切り替えは window / globalThis を読むだけで、index.html 自身が立てては駄目。
   「= true」や「=true」で立てていれば、画面を開いた全員に効いてしまう。 */
const setsIt = /__RECENT_BY_COURSE\s*=\s*(?!=)/.test(HTML);
ok(!setsIt, 'index.html は __RECENT_BY_COURSE を自分で立てていない（読むだけ）');

/* 実際に画面を開いて、既定で「今節着順」の見出しが出ることを確かめる。
   文字列の検査だけでは、別の経路で立っていても気づけない。 */
const {JSDOM}=require(path.join(ROOT,'node_modules','jsdom'));
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){w.Tesseract={createWorker:async()=>({})};
                 w.fetch=async()=>{throw new Error('x')};w.alert=()=>{};}});
const w=dom.window;
w.Element.prototype.scrollIntoView=function(){};
ok(!w.__RECENT_BY_COURSE,
   '画面を開いた直後 __RECENT_BY_COURSE は立っていない（既定は採らない側）');

/* 今節3走を入れて採点し、どちらの見出しが出るか見る。 */
const d=w.document;
const regs=[4238,4320,4444,4502,4610,4700];
regs.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=String(r); });
w.syncRegsFromInputs();
const setField=w.eval('setField');
for(let i=1;i<=6;i++){
  const b=w.boatOf(i);
  setField(b,'nationalWinRate',5.0,'official');
  setField(b,'motor2Rate',35,'official');
  setField(b,'boat2Rate',35,'official');
  b.recentRaces=[{course:1,st:null,stFlag:null,result:3},
                 {course:1,st:null,stFlag:null,result:4},
                 {course:4,st:null,stFlag:null,result:4}];
  b.recentSource='official';
}
w.scoreAll();
const labels=w.eval('state').boats[0].scoreBreakdown.map(p=>p.label);
ok(labels.includes('今節着順'),
   '既定では「今節着順」で採点している（コース別ではない）');
ok(!labels.includes('今節着順(コース別)'),
   '既定では「今節着順(コース別)」が出ない');

/* 切り替えを立てれば、ちゃんと別の採点になる（残したコードが死んでいないか）。 */
w.__RECENT_BY_COURSE = true;
w.scoreAll();
const labels2=w.eval('state').boats[0].scoreBreakdown.map(p=>p.label);
ok(labels2.includes('今節着順(コース別)'),
   '切り替えを立てればコース別で採点する（残したコードが生きている）');

console.log('\n=== 判定⑨の結果が書き残されている ===');
ok(/【判定⑨の結果・2026-11-03】採らない/.test(HTML),
   'index.html に判定⑨の結果（採らない）が書いてある');
ok(/129本/.test(HTML) && /14%/.test(HTML),
   '「効いていないわけではない」実測（買い目が変わるのは14%）が残っている');

console.log('\n=== 判定⑧の経過が消えていない ===');
ok(/22場日259レース 117% \/ 103%/.test(BT),
   'backtest.js に「10/30時点で一度満たした」経過が残っている');
ok(/PREREG_NEED_DAYS\s*=\s*40/.test(BT),
   'これから書く判定の必要数は40場日（15場日で裏返ったため引き上げた）');
ok(/PREREG_MAX_SHARE\s*=\s*0\.05/.test(BT),
   '払戻の偏り5%未満も条件に入っている');

/* 引き上げた必要数を、過去の判定にあとから当てないこと。
   判定⑧の 15場日 は、条件を書いた日の値のまま残っていなければならない。
   ここを「40場日に届いていないから判定前に戻す」と書き換えると、
   都合の悪い結果を測り直しで消せてしまう。 */
const ana8 = BT.slice(BT.indexOf('【判定⑧・2026-10-28に先に書いた】'));
const blk = ana8.slice(0, ana8.indexOf('判定が済むまで'));
ok(/const NEED_DAYS = 15/.test(blk),
   '判定⑧の必要数は条件を書いた日の15場日のまま（あとから引き上げていない）');
/* 合否を決めている式そのものを見る。
   新しい定数は注意書き（console.log）に出てくるだけで、
   満たした・欠けたの判断には入っていないこと。 */
const judge = blk.match(/const a=back\/t\.inv\*100[\s\S]*?欠けたので捨てる。採らない。/);
ok(!!judge, '判定⑧の合否を決めている式が見つかる');
if(judge){
  ok(/a>=100\s*&&\s*b>=100/.test(judge[0]),
     '判定⑧の合否は条件を書いた日の2つ（回収率100%・最大1件除いて100%）のまま');
  ok(!/PREREG_NEED_DAYS|PREREG_MAX_SHARE/.test(judge[0]),
     '判定⑧の合否に新しい必要数・偏りの線を使っていない（過去の判定を緩めない）');
}
ok(/\bNEED_DAYS\b/.test(blk) && !/fresh\.length\s*<\s*PREREG_NEED_DAYS/.test(blk),
   '判定⑧の「たまったら判定する」の線も 15場日 のまま');

console.log('\n=== 判定⑩（波乱4点だけを買うか）が緩められていないか ===');
/* 判定⑩は「波乱だけを買う」案の2回目。1回目（判定⑧・8点）が落ちたあとに
   4点で引き直しているので、通りやすくなっているぶんを条件で返している。
   ここが 110 → 100 に下がったり、場日40・偏り5%が外れたら、
   それは「通るまで引き直す」に戻ったということ。 */
ok(/const PREREG10_AFTER = '2026-11-03'/.test(BT),
   '判定⑩は 2026-11-03 までの日を使わない（凍結の線が残っている）');
ok(/const PREREG10_PCT = 110/.test(BT),
   '判定⑩の線は110%（2回目の挑戦ぶんを厳しくしてある）');
const a10 = BT.slice(BT.indexOf('【判定⑩・2026-11-03に先に書いた】波乱4点'));
const blk10 = a10.slice(0, a10.indexOf('判定が済むまで'));
ok(/fresh10\.length >= PREREG_NEED_DAYS/.test(blk10),
   '判定⑩は場日40以上たまるまで判定しない');
ok(/share < PREREG_MAX_SHARE/.test(blk10),
   '判定⑩は払戻の偏りが5%未満になるまで判定しない');
ok(/a>=PREREG10_PCT&&b>=PREREG10_PCT/.test(blk10.replace(/\s+/g,'')) ||
   /a>=PREREG10_PCT\s*&&\s*b>=PREREG10_PCT/.test(blk10),
   '判定⑩の合否は2つの条件の両方を満たしたときだけ「採る」');
/* 判定⑧の点数(8)と判定⑩の点数(4)が入れ替わっていないか。
   取り違えると、凍結したはずの問いが別の問いに化ける。 */
ok(/const PREREG8_ANA = 8/.test(BT) && /const PREREG10_ANA = 4/.test(BT),
   '判定⑧は8点・判定⑩は4点のまま（取り違えていない）');

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exitCode = fail ? 1 : 0;
