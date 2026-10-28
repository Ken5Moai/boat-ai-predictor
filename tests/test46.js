/* vote-assist.js の probe()
   ==================================================================
   実機で1回失敗すると往復が増えるので、ここで形を確かめておく。
   本物の投票サイトには触らない。同じ作り（入力欄・iframe・別ウィンドウ・
   パスワード欄・押してはいけないボタン）のページを自分で作って試す。

   playwright かブラウザが無い環境では黙って飛ばす（CI用ではなく手元用）。 */
const path=require('path'), fs=require('fs'), os=require('os');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };

let pw;
try{ pw=require('playwright'); }
catch(e){
  console.log('\n=== vote-assist の probe ===');
  console.log('  － playwright が無いので飛ばしました（npm install で入ります）');
  console.log('\n================ 結果: 0 件成功 / 0 件失敗 ================');
  process.exitCode = 0; return;
}
const V=require('../vote-assist.js');

const DIR=fs.mkdtempSync(path.join(os.tmpdir(),'probe-'));
const INNER=`<!doctype html><meta charset="utf-8"><title>iframe の中</title>
<body><h2>3連単 入力</h2>
<input id="kumiban" name="kumiban" placeholder="組番">
<input id="kingaku" name="kingaku" placeholder="金額">
<select id="shiki" name="shiki"><option>3連単</option></select>
<button id="go" class="btn">ベットリストに追加</button>
<button id="done">投票入力完了</button></body>`;
const MAIN=`<!doctype html><meta charset="utf-8"><title>投票メイン</title>
<body><h1>投票サイト</h1>
<input id="pw" type="password" value="ひみつ">
<input id="plain" value="みえる値">
<a href="#" class="btn is-type1_5">投票サイトへ</a>
<button id="kakutei">購入する</button>
<iframe src="inner.html" width="500" height="300"></iframe></body>`;
fs.writeFileSync(path.join(DIR,'inner.html'),INNER);
fs.writeFileSync(path.join(DIR,'main.html'),MAIN);

(async()=>{
  console.log('\n=== vote-assist の probe（本物の投票サイトには触らない） ===');
  let browser;
  try{ browser=await pw.chromium.launch({headless:true}); }
  catch(e){
    console.log('  － ブラウザが無いので飛ばしました（npx playwright install chromium）');
    console.log('\n================ 結果: 0 件成功 / 0 件失敗 ================');
    return;
  }
  const ctx=await browser.newContext();
  const p1=await ctx.newPage(); await p1.goto('file://'+path.join(DIR,'main.html'));
  const p2=await ctx.newPage(); await p2.goto('file://'+path.join(DIR,'inner.html'));

  const out1=path.join(DIR,'out.json');
  const said=[]; const realLog=console.log; console.log=(...a)=>said.push(a.join(' '));
  await V.probe(ctx, out1);
  console.log=realLog;
  await browser.close();

  const got=JSON.parse(fs.readFileSync(out1,'utf8'));
  ok_(Array.isArray(got), '配列で書き出す（画面が複数あるため）');
  ok_(got.length===2, `開いている画面を2つとも拾う（${got.length}個）`);
  ok_((got[0].frames||[]).length===1, `iframe を見つける（${(got[0].frames||[]).length}個）`);
  ok_((got[0].frames[0].inputs||[]).length===3,
      `iframe の中の入力欄も拾う（${(got[0].frames[0].inputs||[]).length}個）`);

  /* ここがいちばん大事。パスワードの中身を書き出さない。
     書き出したファイルは人が私に送るので、中身が入っていては困る。 */
  const pwf=(got[0].inputs||[]).find(i=>i.type==='password');
  ok_(!!pwf, 'パスワード欄を見つける');
  ok_(pwf && pwf.value==='(ふせた)', `パスワードの中身を書き出さない（${pwf?pwf.value:'-'}）`);
  ok_(!JSON.stringify(got).includes('ひみつ'), 'ファイル全体のどこにもパスワードが出ない');
  const plain=(got[0].inputs||[]).find(i=>i.id==='plain');
  ok_(plain && plain.value==='みえる値', 'ふつうの入力欄の中身は見える（組番や金額を見るため）');

  ok_(fs.existsSync(out1.replace(/\.\w+$/,'-page0.png'))
   && fs.existsSync(out1.replace(/\.\w+$/,'-page1.png')), '写真を画面ごとに保存する');
  ok_(!!got[0].text && got[0].text.includes('投票サイト'), '本文も書き出す');

  /* 押してはいけないものを見つけても、押さずに名前を出すだけ */
  const said1=said.join('\n');
  ok_(/押してはいけないもの/.test(said1), '押してはいけないものを知らせる');
  /* 挙げるのは「押すと投票が進む／確定するもの」だけ。
     「投票サイトへ」は遷移リンク、「投票」は式別のタブなので挙げない。
     何でも挙げると、本当に危ないものが埋もれる。 */
  for(const w of ['購入する','投票入力完了'])
    ok_(said1.includes(w), `「${w}」を押してはいけないものとして挙げる`);
  for(const w of ['投票サイトへ','ベットリストに追加'])
    ok_(!said1.includes(w+'」'), `「${w}」は危ない側に挙げない`);

  /* 押してよいもの／絶対に押さないものの線引き。
     実機の画面（2026-10-27 唐津6R 3連単 通常投票）の文言で確かめる。
     ここを間違えると、必要な操作まで禁止して人が90回手で押すことになるか、
     逆に投票を確定させてしまう。どちらも困るので両向きに見る。 */
  console.log('\n  押してよいもの／絶対に押さないもの');
  const never=[['投票入力完了','入力画面を離れて確認に進む'],
               ['投票する',''],['購入する',''],['確定',''],
               ['投票内容確認',''],['金額確定','']];
  const fine =[['ベットリストに追加','買い目を積むだけ。投票は進まない'],
               ['おまかせ',''],['更新',''],['資金配分',''],['全削除',''],
               ['オッズ投票',''],['ボックス投票','']];
  for(const [t,why] of never)
    ok_(V.isNeverClick(t)===true, `「${t}」は押さない${why?'（'+why+'）':''}`);
  for(const [t,why] of fine)
    ok_(V.isNeverClick(t)===false, `「${t}」は押してよい${why?'（'+why+'）':''}`);

  fs.rmSync(DIR,{recursive:true,force:true});
  console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
  process.exitCode = ng ? 1 : 0;
})();
