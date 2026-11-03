/* 「実際に買ったもの」を数えるところに、モデルを混ぜていないか
   ------------------------------------------------------------------
   2026-10-29、買ったあとにモデルを走らせ直して収支を数えた。
   今節成績はレースが終わるたびに増えるので、買った時点とは中身が違う。
   それで大村12Rを「外れ」と数えて本人に伝え、
   本人のスクリーンショット（1-2-4 ¥1,020 的中）で間違いが分かった。

   settle-bought.js は、その反省で作った。
   数えるのは tmp/bought-<日付>.json（押した買い目そのもの）だけ。
   ここにモデルが入り込んだら、また同じ間違いをする。
   「入れないように気をつける」では1か月後に守られないので、機械で見張る。 */
const fs=require('fs'), path=require('path');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'settle-bought.js'),'utf8');

console.log('\n=== settle-bought.js はモデルを走らせない ===');
/* コメントを落としてから見る。説明文に出てくる名前で落ちないように。 */
const code = SRC.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
for(const bad of ['backtest.js','index.html','jsdom','buyPlan','scoreAll','predict.js']){
  ok(!code.includes(bad), `${bad} を使っていない`);
}
ok(/tmp'?,\s*`bought-\$\{HD\}\.json`|bought-\$\{HD\}\.json/.test(code),
   'tmp/bought-<日付>.json を読んでいる（押した買い目そのもの）');
ok(/picks/.test(code), '記録に入っている picks（実際に押した組番）で当たりを見ている');

console.log('\n=== 範囲外のレース番号を数えない ===');
/* 公式の結果ページは rno=99 でも断らず、その日の最終レースを返す。
   そのまま数えると、別のレースの払戻で収支を出してしまう。 */
ok(/b\.rno>=1\s*&&\s*b\.rno<=12/.test(code.replace(/\s+/g,' ').replace(/ /g,'')) ||
   /rno>=1&&b\.rno<=12/.test(code.replace(/\s/g,'')),
   'レース番号が1〜12の範囲にあるか先に確かめている');
ok(/Number\.isInteger\(b\.rno\)/.test(code),
   'レース番号が整数であることも確かめている');

console.log('\n=== 記録が無いときに黙って0を出さない ===');
ok(/がありません/.test(SRC) && /process\.exitCode\s*=\s*1/.test(code),
   '記録ファイルが無ければ、そう言って終わる（0円と答えない）');

console.log('\n=== 金額がそろっていない買い方を断る ===');
/* 至極を厚くした買い方だと、どの点にいくら載せたかが記録に無い。
   そこを黙って一律100円として数えると、払戻がずれる。 */
ok(/picks\.length\*unit\s*!==\s*spent/.test(code.replace(/\s+/g,' ')) ||
   /picks\.length\*unit!==spent/.test(code.replace(/\s/g,'')),
   '1点あたりの金額がそろっていないレースを見つけて断っている');

console.log('\n=== process.exit() を使っていない ===');
/* 配管に流すと出力が切れる（理由は tests/run.js の末尾）。 */
ok(!/process\.exit\s*\(/.test(code), 'process.exit() ではなく exitCode を使っている');

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exitCode = fail ? 1 : 0;
