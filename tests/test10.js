const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};

// 実機とおなじ状況を再現するfetchスタブ: jinaだけ生きている
let calls=[];
function makeDom(handler){
  return new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
   beforeParse(w){
     w.Tesseract={createWorker:async()=>({})};
     w.alert=()=>{};
     w.fetch=async(u)=>{ calls.push(u); return handler(String(u)); };
   }});
}
const resp=(body,status=200)=>({ok:status>=200&&status<300,status,text:async()=>body});
const PAD='あ'.repeat(600);

console.log('\n=== BX. 死んだ経路は2回失敗したら以降スキップする ===');
calls=[];
let dom=makeDom(u=>{
  if(u.includes('r.jina.ai')) return resp('中身はあるが場データではない'+PAD);
  throw new Error('Load failed');       // 他は全滅（実機と同じ）
});
let w=dom.window;
(async()=>{
  // 1回目: 全経路を試す
  try{ await w.fetchViaProxy('https://x.jp/a',{mustContain:['コース別']}); }catch(e){}
  const first=calls.length;
  calls=[];
  // 2回目: 死んだ経路はスキップされるはず
  try{ await w.fetchViaProxy('https://x.jp/b',{mustContain:['コース別']}); }catch(e){}
  const second=calls.length;
  console.log(`  1回目 ${first}回の通信 → 2回目 ${second}回`);
  ok(first<=2,`中身が返った時点で打ち切る (1回目 ${first}回 / 以前は8回)`);
  ok(second<=2,`2回目も生きている経路だけ試す (${second}回)`);

  console.log('\n=== BY. 中身違いと通信失敗を区別する ===');
  calls=[];
  dom=makeDom(u=>{
    if(u.includes('r.jina.ai')) return resp('これは一覧ページです'+PAD);
    throw new Error('Load failed');
  });
  w=dom.window;
  let caught=null;
  try{ await w.fetchViaProxy('https://x.jp/a',{mustContain:['コース別']}); }catch(e){ caught=e; }
  ok(caught && caught.name==='ContentMismatch',`中身違いは専用のエラー (${caught&&caught.name})`);
  ok(caught && caught.text.includes('一覧ページ'),'実際に返ってきた内容を保持している（診断用）');
  ok(caught && caught.proxyName==='jina',`どの経路が生きているか記録 (${caught&&caught.proxyName})`);
  // 中身を問わなければ同じ経路で成功する
  const t=await w.fetchViaProxy('https://x.jp/a');
  ok(t.includes('一覧ページ'),'条件を付けなければ同じ経路で取得できる');

  console.log('\n=== BZ. 一覧からリンクをたどって取得できるか ===');
  const STADIUM_PAGE=`若松ボートレース場
コース別入着率&決まり手
コース 1着 2着 3着 4着 5着 6着 逃げ 捲り 差し 捲り差し 抜き 恵まれ
1 55.0 15.0 9.5 8.0 7.5 5.0 93.5 0.0 0.0 0.0 6.0 0.5
2 12.5 26.0 18.5 17.5 13.0 12.5 0.0 34.0 55.5 0.0 10.5 0.0
3 12.0 23.0 18.5 18.0 15.5 13.0 0.0 48.0 10.0 35.5 6.5 0.0
4 11.0 16.0 19.5 18.5 18.0 17.0 0.0 50.0 20.5 19.0 9.0 1.5
5 6.5 13.5 18.0 20.0 21.0 21.0 0.0 11.5 7.0 63.0 16.0 2.5
6 2.5 6.5 17.0 19.0 25.5 29.5 0.0 35.0 23.5 29.5 12.0 0.0
(集計期間：2026/06/01～2026/08/31 単位：%)
枠番別コース取得率
枠 1コース 2コース 3コース 4コース 5コース 6コース
1 99.0 0.4 0.3 0.2 0.1 0.0
2 0.8 94.0 4.0 0.8 0.3 0.1
3 0.1 3.0 92.0 4.0 0.6 0.3
4 0.1 1.0 2.5 88.0 5.4 3.0
5 0.0 1.0 1.0 5.0 85.5 7.5
6 0.0 1.0 1.0 2.0 8.5 87.5
MEMO
水質 ： 海水
干満差 ： あり`;
  const INDEX_PAGE=`ボートレース場データ
- [桐生](https://www.boatrace.jp/owpc/pc/extra/data/stadium/detail.html?jcd=01)
- [若松](https://www.boatrace.jp/owpc/pc/extra/data/stadium/detail.html?jcd=20)
`+PAD;
  calls=[];
  dom=makeDom(u=>{
    if(!u.includes('r.jina.ai')) throw new Error('Load failed');
    const target=decodeURIComponent(u.replace('https://r.jina.ai/',''));
    if(/detail\.html\?jcd=(20|01)/.test(target)) return resp(STADIUM_PAGE);
    if(target.includes('index.html') && !target.includes('jcd=')) return resp(INDEX_PAGE);
    return resp('該当なし'+PAD);     // index.html?jcd=20 は一覧が返る（実機と同じ）
  });
  w=dom.window;
  const d=w.document;
  w.localStorage.clear();
  d.getElementById('venue').value='20';
  await w.fetchStadiumData();
  const ST=w.eval('STADIUM');
  ok(!!ST['20'],'若松のデータを取り込めた');
  ok(ST['20'] && ST['20'].course[1][0]===55.0,`1コース1着率 55.0 (${ST['20']&&ST['20'].course[1][0]})`);
  ok(ST['20'] && ST['20'].water==='海水','水質も取得');
  ok(d.getElementById('stadiumNotice').textContent.includes('取り込みました'),'成功を通知');
  const saved=w.localStorage.getItem('boatai_stadium_url_v1');
  ok(saved && saved.includes('{jcd}'),`URLの形を記憶: ${saved}`);
  console.log(`  通信回数: ${calls.length}回`);
  ok(calls.length<=8,`無駄打ちが少ない (${calls.length}回 / 以前は最大32回)`);

  console.log('\n=== CA. 記憶したURLで2場目は一発で取れるか ===');
  calls=[];
  d.getElementById('venue').value='01';
  await w.fetchStadiumData();
  console.log(`  2場目の通信回数: ${calls.length}回`);
  ok(calls.length===1,`記憶したURLで一発 (${calls.length}回)`);
  ok(!!w.eval('STADIUM')['01'],'2場目も取り込めた');

  console.log('\n=== CB. 全滅時は実際の中身を見せる（診断用） ===');
  dom=makeDom(u=>{
    if(u.includes('r.jina.ai')) return resp('Error: This page requires JavaScript'+PAD);
    throw new Error('Load failed');
  });
  w=dom.window;
  w.document.getElementById('venue').value='20';
  await w.fetchStadiumData();
  const nt=w.document.getElementById('stadiumNotice').textContent;
  ok(nt.includes('取得できませんでした'),'失敗を通知');
  ok(nt.includes('実際に返ってきた内容'),'実際の中身を表示して原因を追えるようにする');
  ok(nt.includes('requires JavaScript'),'中身の先頭が読める');
  ok(nt.includes('貼り付け'),'確実な代替手段を案内');
  ok(nt.includes('予想はできます'),'取り込めなくても進めると案内');
  ok(w.document.getElementById('stadiumPasteDetails').open===true,'貼り付け欄を自動で開く');

  console.log('\n=== CC. 通信テストで生死判定をやり直せるか ===');
  ok(typeof w.resetProxyHealth==='function','リセット機能がある');
  const ph=w.eval('proxyHealth');
  ok(Object.keys(ph).length>0,'不調の記録が溜まっている');
  w.resetProxyHealth();
  ok(Object.keys(w.eval('proxyHealth')).length===0,'通信テスト時にリセットされる');

  console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
  process.exit(fail?1:0);
})();
