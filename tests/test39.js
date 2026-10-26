/* 気象データを「結果」ページ以外から取った回を、見えるところに出しておく
   ------------------------------------------------------------------
   backtest.js のRACESの上にルールが書いてある：
     ws / wave / temp / wtemp は かならず「結果」ページの水面気象情報から取る。
   ところが結果ページが途中までしか表示されないことがある（若松9R 10/23）。
   そのときは直前情報の値で代える以外にないが、代えたことを黙っていると
   いつのまにかそれが普通になってしまう。

   そこで weatherFrom という欄を置いた。結果ページ以外から取ったときだけ
   そこに出どころを書く。このテストは
     ・weatherFrom が付いている回を全部出す
     ・それが全体の1割を超えたら失敗させる
   の2つをやる。黙って増えないための歯止め。 */
const fs=require('fs'),path=require('path'),vm=require('vm');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const src=fs.readFileSync(path.join(DIR,'data','races.js'),'utf8');
const from=src.indexOf('module.exports = ['), to=src.indexOf('\n];',from);
if(from<0||to<0){ console.log('  ✗ FAIL: RACES を取り出せない'); process.exit(1); }
const RACES=vm.runInNewContext(src.slice(from+'module.exports ='.length, to+2));

console.log('\n=== 気象データの出どころ ===');
const sub = RACES.filter(r=>r.weatherFrom);
console.log(`  全${RACES.length}レース中、結果ページ以外から取ったのは ${sub.length}件\n`);
for(const r of sub){
  console.log(`  － ${r.name}  ${r.weatherFrom}`);
  ok(typeof r.weatherFrom==='string' && r.weatherFrom.length>=4,
     `${r.name} は出どころが書いてある`);
}
const ratio = sub.length / RACES.length;
ok(ratio <= 0.10,
   `結果ページ以外から取った回は全体の ${(ratio*100).toFixed(1)}%（1割までに収まっている）`);

console.log('\n=== ルールそのものが消えていないか ===');
ok(src.includes('結果」ページの水面気象情報から取る'),
   'backtest.js に「結果ページの水面気象情報から取る」ルールが残っている');

console.log('\n=== 気象が入っているか ===');
let noWeather=0;
for(const r of RACES){
  if(r.ws==null || r.wave==null) noWeather++;
}
ok(noWeather===0, `風速と波高が入っていないレースは ${noWeather}件`);

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
