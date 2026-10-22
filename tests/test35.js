/* 予想を3段で見せる（至極の一点 / 抑え / 波乱）
   ------------------------------------------------------------------
   有料note（禅-zen）の見せ方が読みやすかったので形だけ借りた。
   ただし点数は借りない。実測31レースでこうなっているため。
     1点46% / 6点80% / 8点94% / 10点96% / 12点92%
     15点73% / 18点69% / 19点66% / 20点63%
   19点前後は66%の帯で、10点の96%とは30ポイント違う。

   見せ方を3段にすることと、点数を増やすことは別の話。
   ここで固定するのは「見せ方を変えても点数が増えないこと」。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window;
w.Element.prototype.scrollIntoView=function(){};

const L=[{combo:'1-2-4',p:.075},{combo:'1-2-3',p:.069},{combo:'1-4-2',p:.067},
         {combo:'1-3-2',p:.060},{combo:'1-2-5',p:.060},{combo:'1-5-2',p:.050},
         {combo:'1-4-3',p:.046},{combo:'1-3-4',p:.045},{combo:'1-4-5',p:.040},
         {combo:'1-5-4',p:.038}];

console.log('\n3段に分ける');
const T=w.buildTiers(L,10);
ok(T.top.combo==='1-2-4', '至極の一点は確率がいちばん高い組');
ok(T.osae.length===9, `抑えは9点（${T.osae.length}）`);
ok(!T.osae.some(c=>c.combo===T.top.combo), '至極の一点が抑えに重複していない');
ok(1+T.osae.length===10, '合わせて10点。見せ方を変えても点数は増えない');
ok(T.osae.every((c,i)=>i===0||T.osae[i-1].p>=c.p), '抑えが確率の高い順');

console.log('\n点数を指定しても、その点数を超えない');
for(const n of [1,4,6,10,12]){
  const t=w.buildTiers(L.slice(0,Math.max(n,1)),n);
  ok(1+t.osae.length<=n || n===1, `${n}点を指定すると合計${1+t.osae.length}点（超えない）`);
}
ok(w.buildTiers(L,1).osae.length===0, '1点指定なら抑えは0点');

console.log('\n実測を画面に出していること');
ok(/19点/.test(HTML) && /66%/.test(HTML), '19点が66%だと書いてある');
ok(/10点<\/b><\/td><td><b>96%/.test(HTML.replace(/\s+/g,'')) || /96%/.test(HTML),
   '10点が96%だと書いてある');
ok(/この1点だけで買うと実測46%/.test(HTML),
   '至極の一点を1点で買うと46%だと書いてある');
ok(/1点勝負する券ではありません/.test(HTML), '1点勝負の券ではないと明記している');
ok(/見せ方だけ借りて、点数は実測どおり10点に据え置/.test(HTML),
   '見せ方と点数が別の話だと書いてある');
ok(/波乱はこの下の「荒れ予想」に出ます/.test(HTML), '波乱が別枠だと案内している');
ok(/別枠なので、買うと点数が増えます/.test(HTML), '波乱を買うと増えると注意している');

console.log('\n投稿文も3段になること');
const d=dom.window.document;
d.getElementById('venue').value='20'; d.getElementById('raceNo').value='12';
d.getElementById('raceDate').value='2026-10-22';
const amounts=L.map(()=>100);
const txt=w.buildPostText(L, amounts);
ok(/◎ 至極の一点/.test(txt), 'note用に「至極の一点」が入る');
ok(txt.includes('1-2-4'), '至極の一点の組が入る');
ok(/○ 抑え 9点/.test(txt), '抑えの点数が入る');
ok(/3連単 10点/.test(txt), '合計点数が変わっていない');
ok(/（1点ずつ）/.test(txt), '1点ずつの一覧も残っている');
ok(!/波乱/.test(txt), '投稿文に波乱を混ぜていない（何点買うのか分からなくなるため）');
const sh=w.buildPostShort(L, amounts);
ok(/◎ 1-2-4/.test(sh), 'X用にも本命の印が付く');
ok(w.xLen(sh)<=140, `X用が140字以内（${w.xLen(sh)}字）`);

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
