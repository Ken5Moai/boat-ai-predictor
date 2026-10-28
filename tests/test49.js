/* vote-assist.js の fill() と buy() は動かないこと
   ==================================================================
   2026-10-28、テレボート会員規約 第25条（禁止事項）を確認した。

     (4) 振興会が提供するアプリケーションツール、ソフトウェア等以外のものを
         用いるなど、振興会のシステムの意図から外れた方法で
         インターネット投票を利用する行為
     (2) 極めて短時間に機械的に反復して投票、照会等する行為
     (6) 前各号に掲げる行為の準備とみられる行為又は、
         該当するおそれのある行為

   Playwright は「振興会が提供するソフトウェア等以外のもの」そのもの。
   買うところだけでなく打ち込むところも当たる。(6) があるので
   「準備だから」も通らない。

   中身は消さずに残してある（なぜ止めたかを次に読む人に残すため）ので、
   うっかり動き出さないことをここで見張る。 */
const path=require('path'), fs=require('fs');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };
const V=require('../vote-assist.js');
const SRC=fs.readFileSync(path.join(__dirname,'..','vote-assist.js'),'utf8');
const AUTO=fs.readFileSync(path.join(__dirname,'..','auto.js'),'utf8');

console.log('\n=== 規約で止まること ===');
(async()=>{
  const quiet = async f => { const r=console.log; console.log=()=>{};
    let err=null; try{ await f(); }catch(e){ err=e; } console.log=r; return err; };

  /* 引数は何でもよい。入口で止まるので中身まで行かない。 */
  let e = await quiet(()=>V.fill({pages:()=>[]}, {rows:[],total:0}, null));
  ok_(!!e && e.termsBlocked===true, `fill() は止まる（${e?e.message.slice(0,40):'止まらなかった'}）`);
  ok_(!!e && /第25条/.test(e.message+V.TERMS_BLOCK), '止まる理由に条文番号が入っている');

  e = await quiet(()=>V.buy({pages:()=>[]}, {rows:[],total:0}, {}));
  ok_(!!e && e.termsBlocked===true, `buy() は止まる（${e?e.message.slice(0,40):'止まらなかった'}）`);

  /* --buy-dry も同じ。押さないから良い、にはならない（(6) がある）。 */
  e = await quiet(()=>V.buy({pages:()=>[]}, {rows:[],total:0}, {dryRun:true}));
  ok_(!!e && e.termsBlocked===true, '--buy-dry（押す直前で止まる版）も動かない');

  /* 環境変数を揃えても動かない。規約は設定で外せるものではない。 */
  const old={p:process.env.BOAT_BET_PASSWORD, t:process.env.BOAT_TERMS_OK};
  process.env.BOAT_BET_PASSWORD='x'; process.env.BOAT_TERMS_OK='yes';
  e = await quiet(()=>V.buy({pages:()=>[]}, {rows:[],total:0}, {}));
  ok_(!!e && e.termsBlocked===true, '環境変数を揃えても動かない');
  ok_(V.buyReadiness().some(m=>/第25条/.test(m)), 'buyReadiness() が理由として条文を返す');
  if(old.p==null) delete process.env.BOAT_BET_PASSWORD; else process.env.BOAT_BET_PASSWORD=old.p;
  if(old.t==null) delete process.env.BOAT_TERMS_OK;     else process.env.BOAT_TERMS_OK=old.t;

  console.log('\n=== auto.js 側 ===');
  ok_(/if\(FILL \|\| BUY \|\| BUY_DRY\)/.test(AUTO), '--fill も --buy も --buy-dry も受け付けない');
  ok_(/TERMS_BLOCK/.test(AUTO), '止めた理由を画面に出す');

  console.log('\n=== 止めた理由が残っていること ===');
  ok_(/第25条/.test(SRC), 'vote-assist.js に条文番号が書いてある');
  for(const w of ['(4)','(2)','(6)'])
    ok_(SRC.includes(w), `${w} の条文が引いてある`);
  ok_(/消さずに残す/.test(SRC), 'なぜ中身を残したかが書いてある');

  console.log('\n=== 予想は止まっていないこと ===');
  ok_(!/TERMS_BLOCK/.test(fs.readFileSync(path.join(__dirname,'..','predict.js'),'utf8')),
      'predict.js は止めていない（投票システムを触らないため）');
  ok_(!/termsForbid/.test(fs.readFileSync(path.join(__dirname,'..','backtest.js'),'utf8')),
      'backtest.js も止めていない');

  console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
  process.exitCode = ng ? 1 : 0;
})();
