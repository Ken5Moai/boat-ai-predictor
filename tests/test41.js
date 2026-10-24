/* fetch.js の読み取りが、手で書き写した記録と合うか
   ------------------------------------------------------------------
   公式ページを実際に取ってきて保存したもの（唐津1R 2026-10-20）を
   固定データとして置いてある。ネットに出ずに回せる。

   この1レースは、スクショから手で書き写して backtest.js に入れてある。
   同じレースを fetch.js で読んで、全項目が一致することを確かめる。
   合えば「手書きも読み取りも正しい」。
   どちらかを壊したら、ここが落ちる。

   作っている途中で、このやり方が実際に2つのバグを見つけた。
     ・tail が次の艇まで食い込み、1・2号艇の今節成績が空になっていた
     ・本番STのセルに決まり手がくっつき（「.03 逃げ」）、1着のSTが落ちていた
   どちらも順位の並びはそれらしく出るので、目では気づけない。 */
const fs=require('fs'), path=require('path'), zlib=require('zlib'), vm=require('vm');
const F=require('../fetch.js');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const fix=n=>zlib.gunzipSync(fs.readFileSync(
  path.join(__dirname,'fixtures',`karatsu1R_20261020_${n}.html.gz`))).toString('utf8');

const src=fs.readFileSync(path.join(DIR,'backtest.js'),'utf8');
const from=src.indexOf('const RACES=['), to=src.indexOf('\n];',from);
const RACES=vm.runInNewContext(src.slice(from+'const RACES='.length,to+2));
const mine=RACES.find(r=>r.name==='唐津1R 予選(10/20)');
const ODDS=require(path.join(DIR,'odds.js'))['唐津1R 予選(10/20)'];

const L=F.parseRacelist(fix('racelist'));
const B=F.parseBefore(fix('beforeinfo'));
const O=F.parseOdds(fix('odds3t'));
const R=F.parseResult(fix('raceresult'));

console.log('\n=== 出走表 ===');
ok(L.length===6, `6艇ぶん取れた（${L.length}艇）`);
mine.B.forEach((b,i)=>{
  const o=L[i]||{};
  const same = o.reg===b.reg && o.g===b.g
    && Math.abs(o.nat-b.nat)<.005 && Math.abs(o.loc-b.loc)<.005
    && Math.abs(o.mot-b.mot)<.005 && Math.abs(o.bt-b.bt)<.005
    && Math.abs(o.st-b.st)<.005 && o.F===b.F;
  ok(same, `${i+1}号艇 ${b.reg} の出走表が一致`
    + (same?'':`  手書き[${[b.g,b.nat,b.loc,b.mot,b.bt,b.st,b.F]}] / 読み取り[${[o.g,o.nat,o.loc,o.mot,o.bt,o.st,o.F]}]`));
  ok(JSON.stringify(o.rec)===JSON.stringify(b.rec),
    `${i+1}号艇 今節成績が一致  ${JSON.stringify(o.rec)}`);
});

console.log('\n=== 直前情報 ===');
mine.B.forEach((b,i)=>{
  const o=B.boats[i]||{}, e=B.exSt[i+1]||{};
  ok(Math.abs(o.exT-b.exT)<.005, `${i+1}号艇 展示タイム ${o.exT}`);
  ok(Math.abs(o.tilt-b.tilt)<.005, `${i+1}号艇 チルト ${o.tilt}`);
  ok(Math.abs(e.st-b.exST)<.005, `${i+1}号艇 展示ST ${e.st}`);
  ok((e.f||null)===(b.exF||null), `${i+1}号艇 展示F ${e.f||'なし'}`);
  ok(B.entry[i+1]===b.entry, `${i+1}号艇 進入 ${B.entry[i+1]}`);
});

console.log('\n=== 3連単オッズ ===');
ok(Object.keys(O).length===120, `120通り取れた（${Object.keys(O).length}）`);
const diff=Object.keys(ODDS).filter(k=>Math.abs(ODDS[k]-O[k])>0.005);
ok(diff.length===0, `手書きのオッズと全120通り一致`
  + (diff.length?`  違い: ${diff.slice(0,3).map(k=>`${k} ${ODDS[k]}/${O[k]}`).join(' ')}`:''));

console.log('\n=== 結果 ===');
ok(R.result===mine.result, `3連単 ${R.result}`);
ok(R.pay===mine.pay, `払戻 ¥${R.pay}`);
ok(R.pop===mine.pop, `人気 ${R.pop}番`);
ok(R.ws===mine.ws && R.wave===mine.wave, `風速${R.ws}m 波高${R.wave}cm`);
ok(Math.abs(R.temp-mine.temp)<.05 && Math.abs(R.wtemp-mine.wtemp)<.05,
   `気温${R.temp} 水温${R.wtemp}`);
ok(Object.keys(R.actualST).length===6, `本番STが6艇ぶん（1着の「.03 逃げ」も拾えている）`);
ok(Math.abs(R.actualST[1]-mine.actualST[1])<.005, `1号艇の本番ST ${R.actualST[1]}`);

console.log('\n=== 直前情報の気象は、結果の気象と別物 ===');
ok(B.ws!==R.ws || B.wave!==R.wave,
   `直前情報 風速${B.ws}m 波高${B.wave}cm（${B.weatherLabel}） ≠ 結果 風速${R.ws}m 波高${R.wave}cm`);
ok(/現在/.test(B.weatherLabel||''),
   `直前情報の見出しが「現在」の表示になっている（過去レースでは当時の天気ではない）`);

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
