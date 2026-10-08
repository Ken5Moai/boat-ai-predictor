/* 買い目のまとめ表記（フォーメーション）が、元の買い目と完全に一致すること
   ------------------------------------------------------------------
   1点ずつ縦に並べると10点を超えたあたりから目で追えないので、
     1-3-2 1-2-3 1-3-4 1-4-3 3-1-2 1-2-4 2-1-3 1-4-2 3-1-4 4-1-3
   を
     1-234-234  6点 / 24-1-3  2点 / 3-1-24  2点
   のようにまとめる。

   ここで一番こわいのは「見やすくなった代わりに点数が変わる」こと。
   1点でも増えれば余計に買うし、減れば本命が抜ける。
   だから、まとめたものを必ず展開し直して突き合わせ、
   合わなければまとめずに1点ずつ出す（見やすさより正しさ）。

   このテストは、総当たり（120通りから無作為に選んだ組）でも
   往復が常に一致することを確かめる。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window;
w.Element.prototype.scrollIntoView=function(){};

const ALL=[];
for(let a=1;a<=6;a++) for(let b=1;b<=6;b++) for(let c=1;c<=6;c++)
  if(a!==b&&a!==c&&b!==c) ALL.push(`${a}-${b}-${c}`);

/* まとめたものを展開し直す（テスト側で独立に実装して突き合わせる） */
function expand(terms){
  const out=[];
  for(const t of terms){
    const [A,B,C]=t.text.split('-').map(x=>x.split(''));
    for(const a of A) for(const b of B) for(const c of C)
      if(a!==b&&a!==c&&b!==c) out.push(`${a}-${b}-${c}`);
  }
  return out;
}

console.log('\n実際に頼まれた10点');
const ASK=['1-3-2','1-2-3','1-3-4','1-4-3','3-1-2','1-2-4','2-1-3','1-4-2','3-1-4','4-1-3'];
const f=w.compressCombos(ASK);
ok(f.ok, 'まとめられた');
const back=expand(f.terms);
ok(back.length===10, `展開すると10点に戻る（${back.length}点）`);
ok(new Set(back).size===10, '展開に重複が無い');
ok(ASK.every(x=>back.includes(x)), '元の10点がすべて含まれる');
ok(back.every(x=>ASK.includes(x)), '元に無い組が1つも増えていない');
ok(f.terms.reduce((a,t)=>a+t.n,0)===10, '各項の点数の合計が10点');
ok(f.terms.length<=5, `項が5つ以内にまとまっている（${f.terms.length}項）`);
console.log('    ' + f.terms.map(t=>`${t.text}(${t.n}点)`).join('  '));

/* 本人が書いた表記も同じ10点であることを、こちら側でも確かめる */
console.log('\n本人が書いた表記と同じ中身か');
const MINE=expand([{text:'1-23-23'},{text:'1-34-34'},{text:'1-24-24'},
                   {text:'3-1-24'},{text:'24-1-3'}]);
ok(MINE.length===10 && new Set(MINE).size===10, '本人の表記も10点');
ok(MINE.every(x=>ASK.includes(x)) && ASK.every(x=>MINE.includes(x)),
   '本人の表記と元の10点は完全に同じ');

console.log('\n項が重なっていないこと（重なると同じ組を2回買う）');
const seen=new Set(); let dup=0;
for(const x of back){ if(seen.has(x)) dup++; seen.add(x); }
ok(dup===0, '同じ組が2つの項に入っていない');

console.log('\nどんな買い目でも往復が一致すること（無作為に200通り試す）');
let bad=0, worst=0, mismatch=null;
let seed=20260928;
const rnd=()=>{ seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff; };
for(let trial=0; trial<200; trial++){
  const n=1+Math.floor(rnd()*18);
  const pool=[...ALL];
  const pick=[];
  for(let i=0;i<n;i++) pick.push(pool.splice(Math.floor(rnd()*pool.length),1)[0]);
  const r=w.compressCombos(pick);
  if(!r.ok){ bad++; continue; }                 /* まとめられない場合は1点ずつなので可 */
  const ex=expand(r.terms);
  const same = ex.length===pick.length && new Set(ex).size===pick.length
            && ex.every(x=>pick.includes(x));
  if(!same){ bad++; if(!mismatch) mismatch=pick.join(' '); }
  worst=Math.max(worst, r.terms.length);
}
ok(bad===0, bad? `往復が合わない例があった: ${mismatch}` : '200通りすべてで往復が一致した');
ok(worst<=18, `項の数が点数を超えない（最大${worst}項）`);

console.log('\n端の場合');
ok(w.compressCombos([]).ok && w.compressCombos([]).n===0, '0点でも落ちない');
const one=w.compressCombos(['1-2-3']);
ok(one.ok && one.terms.length===1 && one.terms[0].text==='1-2-3', '1点はそのまま');
const two=w.compressCombos(['1-2-3','1-2-3']);
ok(two.n===1, '同じ組を2回渡しても1点として扱う');
const bogus=w.compressCombos(['1-2-3','あ']);
ok(!bogus.ok && bogus.list.length===2, '形がおかしい組が混ざったらまとめない');
const full=w.compressCombos(ALL);
ok(full.ok && expand(full.terms).length===120, '120通り全部でも往復が一致する');
ok(full.terms.length===1 && full.terms[0].text==='123456-123456-123456',
   `120通りは1項にまとまる（${full.terms[0].text}）`);

console.log('\n表示に使われていること');
ok(/compressCombos\(points\.map/.test(HTML), '買い目カードでまとめ表記を出している');
ok(/formationLines\(points\.map/.test(HTML), '投稿文でもまとめ表記を使っている');
ok(/点数が合いません/.test(HTML), '点数が合わないときに警告を出す作りになっている');
const lines=w.formationLines(ASK);
ok(lines.length===f.terms.length && /点$/.test(lines[0]), '投稿用の行に点数が付く');
ok(w.formationLines(['1-2-3','あ']).join(' ')==='1-2-3 あ',
   'まとめられないときは渡されたものをそのまま返す');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
