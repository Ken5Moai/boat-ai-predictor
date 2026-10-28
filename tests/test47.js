/* vote-assist.js の fill() は動かない（会員規約 第25条）
   ==================================================================
   2026-10-28、テレボート会員規約 第25条(4) により、このスクリプトで
   投票画面を操作すること自体が禁止されていると分かった。
   打ち込みの中身は消さずに残してあるが、動かない。
   動かないことは tests/test49.js で見ている。

   このファイルにあった「打ち込みが正しく動くか」の検査は役目を終えた。
   残してあるのは、金額の単位の計算（toUnit）だけ。これは買い目を
   人が手で入れるときにも使う考え方なので、確かめ続ける価値がある。 */
const path=require('path'), fs=require('fs');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };
const V=require('../vote-assist.js');

console.log('\n=== 購入金額の単位（画面は100円単位） ===');
console.log('  投票画面の購入金額欄は「[  ] 00円」。¥100 なら 1 と入れる。');
console.log('  手で入れるときも同じなので、ここは残しておく。');
for(const [yen,unit] of [[100,1],[500,5],[1000,10],[2000,20]])
  ok_(V.toUnit(yen)===unit, `¥${yen} は「${unit}」と入れる`);
for(const bad of [150,99,0,-100,1.5])
  ok_((()=>{try{V.toUnit(bad);return false}catch(e){return true}})(), `¥${bad} は入れずに止まる`);

console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
process.exitCode = ng ? 1 : 0;
