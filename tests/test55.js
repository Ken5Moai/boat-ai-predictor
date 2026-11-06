/* 「買える時点のオッズ」を集めるところが、締切のオッズと混ざらないか
   ------------------------------------------------------------------
   data/odds.js は「締切前後に読み取ったオッズ」。買える値段ではない。
   期待値方式が1054レースで100%と出ているのは、その買えない値段での話。

   実際に両方ある38レースで比べると、買う帯（30倍以下）でも
   締切までに中央値24%動いている。2割以上動いた組が58%。
   だから「買える時点のオッズ」を別に集める（catch-odds.js）。

   ここで混ざるといちばん困る。締切後に取ったオッズが odds-live に入ると、
   「買えない値段で計算した期待値」を「買える」と思い込む。
   数字は良くなる方向に狂うので、気づきにくい。機械で見張る。 */
const fs=require('fs'), path=require('path');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const SRC=fs.readFileSync(path.join(ROOT,'catch-odds.js'),'utf8');
const code=SRC.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
const flat=code.replace(/\s+/g,'');

console.log('\n=== 締切を過ぎたレースのオッズを入れない ===');
ok(/left\(\)<1/.test(flat), '残り時間が1分を切っていたら取らない');
ok((flat.match(/left\(\)<1/g)||[]).length>=2,
   '待つ前と待ったあと、2回とも残り時間を見ている（待っているあいだに過ぎることがある）');
ok(/missed\+\+/.test(flat), '過ぎていたぶんは数えて、あとで出す');

console.log('\n=== 120通りそろわないオッズを入れない ===');
ok(/n!==120/.test(flat),
   '120通りそろっていなければ入れない（穴の開いたオッズで期待値は出せない）');

console.log('\n=== 何分前に取ったかを必ず残す ===');
ok(/minutes:/.test(code), '何分前の値かを記録している');
ok(/at:/.test(code), '何時に取ったかを記録している');
ok(/const LEAD = Number\(flag\('lead', 15\)\)/.test(code),
   '既定は締切15分前（auto.js が買うのが10〜15分前なので、そこに合わせる）');

console.log('\n=== data/ を勝手に書き換えない ===');
/* 集めたものをそのまま判定用のデータに混ぜない。
   入れるかどうかは人が決める（レースを足すと判定の母数が全部動く）。 */
ok(!/data['"/\\]/.test(code.replace(/require\([^)]*\)/g,'')) ||
   !/writeFileSync\([^)]*data/.test(code),
   'data/ に書き込んでいない（取り込みは人が決める）');
ok(/tmp['"\s,)]|'tmp'/.test(code), '書き出しは tmp/ の下');

console.log('\n=== 途中で落ちても取れたぶんが残る ===');
ok(/save\(store\)/.test(flat.replace(/\s/g,'')) || /save\(store\)/.test(code),
   '1レース取るたびに書き出している（まとめて最後に書かない）');
ok(/続きから/.test(SRC) && /load\(\)/.test(code),
   '走らせ直すと、すでに取れているぶんは飛ばす');

console.log('\n=== process.exit() を使っていない ===');
ok(!/process\.exit\s*\(/.test(code), 'process.exit() ではなく exitCode を使っている');

console.log(`\n結果: ${pass} 件成功 / ${fail} 件失敗`);
process.exitCode = fail ? 1 : 0;
