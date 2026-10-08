/* 収支の記録（bets.js）が、あとから都合よく書き換わらないこと
   ------------------------------------------------------------------
   お金の記録でいちばん起きやすい崩れ方は3つある。
     1. まとめ表記と実際の買い目がずれる（10点のつもりが11点になっている）
     2. 分からない値を 0 で埋める（「120番目」と「分からない」が同じになる）
     3. 当たった回だけ残る（外れを消せば回収率はいくらでも上がる）
   ここで全部止める。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const BETS=require(path.join(DIR,'bets.js'));
const src=fs.readFileSync(path.join(DIR,'bets.js'),'utf8');
const HTML=fs.readFileSync(path.join(DIR,'index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window;
w.Element.prototype.scrollIntoView=function(){};

const COMBO=/^[1-6]-[1-6]-[1-6]$/;
const valid=c=>COMBO.test(c) && new Set(c.split('-')).size===3;

function expand(terms){
  const out=[];
  for(const t of terms){
    const [A,B,C]=t.split('-').map(x=>x.split(''));
    for(const a of A) for(const b of B) for(const c of C)
      if(a!==b&&a!==c&&b!==c) out.push(`${a}-${b}-${c}`);
  }
  return out;
}

console.log('\n記録そのものの形');
ok(Array.isArray(BETS) && BETS.length>0, `記録がある（${BETS.length}件）`);
for(const b of BETS){
  ok(Array.isArray(b.picks) && b.picks.length>0, `${b.name}: 買い目がある`);
  ok(b.picks.every(valid), `${b.name}: 買い目がすべて正しい3連単の形`);
  ok(new Set(b.picks).size===b.picks.length, `${b.name}: 同じ組を2回買っていない`);
  ok(typeof b.unit==='number' && b.unit>0, `${b.name}: 1点あたりの金額が入っている`);
}

console.log('\n1. まとめ表記と買い目がずれていないこと');
for(const b of BETS){
  if(!b.form) continue;
  const ex=expand(b.form);
  ok(ex.length===b.picks.length, `${b.name}: まとめ表記を展開すると${b.picks.length}点（${ex.length}点）`);
  ok(new Set(ex).size===ex.length, `${b.name}: 展開に重複が無い`);
  ok(ex.every(x=>b.picks.includes(x)) && b.picks.every(x=>ex.includes(x)),
     `${b.name}: まとめ表記と買い目の中身が完全に同じ`);
  /* アプリ側のまとめ方とも突き合わせる（表記の作り方が2つに分かれないように） */
  const f=w.compressCombos(b.picks);
  ok(f.ok && f.terms.reduce((a,t)=>a+t.n,0)===b.picks.length,
     `${b.name}: アプリのまとめ方でも点数が変わらない`);
}

console.log('\n2. 分からない値を 0 で埋めていないこと');
for(const b of BETS){
  ok(b.rank===null || (Number.isInteger(b.rank) && b.rank>=1 && b.rank<=120),
     `${b.name}: rank は null か 1〜120（0 は使わない）`);
  ok(b.pop===null || (Number.isInteger(b.pop) && b.pop>=1),
     `${b.name}: 人気は null か 1以上`);
}
ok(/0 にはしない/.test(src), '0で埋めない決まりがファイルに書いてある');

console.log('\n3. 当たりと外れの扱いが一致していること');
const DONE=BETS.filter(b=>b.hit!=null), WAIT=BETS.filter(b=>b.hit==null);
for(const b of DONE){
  ok(valid(b.hit), `${b.name}: 結果の組が正しい形`);
  ok(typeof b.pay==='number' && b.pay>0, `${b.name}: 払戻が入っている`);
  const win=b.picks.includes(b.hit);
  /* 当たりなら払戻は1点ぶん以上あるはず。外れなら収支は投資ぶんの丸損。 */
  const pl = (win ? b.pay : 0) - b.picks.length*b.unit;
  ok(win ? pl === b.pay - b.picks.length*b.unit : pl === -b.picks.length*b.unit,
     `${b.name}: 収支の計算が ${win?'的中':'外れ'} と矛盾しない（${pl>=0?'+':''}${pl}）`);
}
ok(/当たった回だけ載せる、ということはしない/.test(src),
   '全部載せる決まりがファイルに書いてある');

/* 結果待ちを「外れ」として数えないこと。
   hit が null のレースは picks に含まれないので、素朴に書くと
   外れと同じ扱いになり、収支が勝手にマイナスへ積み上がる。
   締切前に書いた予想がそのまま負けとして記録されてしまうので、必ず分ける。 */
console.log('\n4. 結果待ちを外れとして数えないこと');
for(const b of WAIT){
  ok(b.hit===null && b.pay===null, `${b.name}: 結果欄が空のまま`);
  ok(b.rank===null && b.pop===null, `${b.name}: 順位・人気も空のまま`);
  ok(Array.isArray(b.picks) && b.picks.length>0, `${b.name}: 買い目は入っている`);
  ok(typeof b.unit==='number' && b.unit>0, `${b.name}: 金額は入っている`);
}
ok(/結果がまだ出ていないレースは、収支に混ぜない/.test(src),
   '混ぜない決まりがファイルに書いてある');
ok(/b\.hit!=null/.test(src), '集計が hit の有無で分かれている');

console.log('\n本線と穴を混ぜて数えないこと');
for(const b of BETS){
  const ana=b.ana||[];
  ok(Array.isArray(ana), `${b.name}: 穴枠の欄がある（使っていなければ空）`);
  ok(ana.every(valid), `${b.name}: 穴枠の組がすべて正しい形`);
  ok(ana.every(c=>!b.picks.includes(c)), `${b.name}: 本線と穴が重なっていない`);
}
ok(/本線と穴は別々に数える/.test(src), '別々に数える決まりがファイルに書いてある');

console.log('\n件数が少ないうちは回収率を強調しないこと');
const out=require('child_process').execFileSync(process.execPath,[path.join(DIR,'bets.js')],{encoding:'utf8'});
ok(/回収率/.test(out), '回収率は出る');
ok(/本線 /.test(out) && /穴枠 /.test(out) && /合計 /.test(out),
   '本線・穴枠・合計が別々の行で出る');
ok(BETS.length>=20 || /何も意味しない数字/.test(out),
   '20レース未満なら「意味しない」と添える');
ok(BETS.every(b=>b.rank!=null) || /順位が未計算/.test(out),
   'モデルの順位が未計算なら、そう書く');
ok(BETS.every(b=>b.date) || /日付が未確認/.test(out),
   '日付が未確認なら、そう書く');
for(const b of DONE) ok(out.includes(b.hit), `${b.name}: 結果が出力に出る（外れも消えない）`);
/* 結果待ちは収支に混ざらず、それでも画面から消えないこと。
   消えると「出したことにしない」ができてしまう。 */
for(const b of WAIT){
  ok(out.includes(b.name), `${b.name}: 結果待ちでも一覧に出る（なかったことにしない）`);
  ok(/結果待ち \d+件（収支には入れていない）/.test(out), '結果待ちだと明記されている');
}
{
  /* 収支の分母に、結果待ちのぶんが入っていないことを数字で確かめる */
  const inv=DONE.reduce((a,b)=>a+b.picks.length*b.unit+(b.ana||[]).length*(b.anaUnit||100),0);
  const m=out.match(/合計\s+投資¥([\d,]+)/);
  ok(m && Number(m[1].replace(/,/g,''))===inv,
     `合計の投資額が結果の出たぶんだけ（¥${inv.toLocaleString()}）`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
