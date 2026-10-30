/* backtest.js の入口のチェックが、正しい状態を誤って止めないこと
   ------------------------------------------------------------------
   実際に起きた誤検知：オッズだけ先に入れて結果待ちにしているレース
   （pending.js にある）を「RACES に無い」として止めてしまった。
   結果待ちは正しい状態なので、止めてはいけない。
   一方、名前の重複と、pending と RACES の二重登録は止めなければならない。 */
const path=require('path');
const {execFileSync}=require('child_process');
const fs=require('fs');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const DIR=path.join(__dirname,'..');
const BT=path.join(DIR,'backtest.js');
const RACES_FILE=path.join(DIR,'data','races.js');
const PEND=path.join(DIR,'data','pending.js');
const src=fs.readFileSync(BT,'utf8');
const pendSrc=fs.readFileSync(PEND,'utf8');

/* backtest.js を丸ごと走らせると重いので、入口のチェックだけを取り出して試す。
   RACES / PENDING / ODDS を差し替えられる形で評価する。 */
function check(races, pending, odds){
  const seen=new Map();
  for(const r of races) seen.set(r.name,(seen.get(r.name)||0)+1);
  const dup=[...seen].filter(([,v])=>v>1).map(([k])=>k);
  if(dup.length) return {stop:true, why:'dup:'+dup.join(',')};
  const known=new Set([...races,...pending].map(r=>r.name));
  const missing=Object.keys(odds).filter(k=>!known.has(k));
  if(missing.length) return {stop:true, why:'missing:'+missing.join(',')};
  for(const r of pending) if(races.some(q=>q.name===r.name))
    return {stop:true, why:'both:'+r.name};
  return {stop:false};
}

console.log('\n入口のチェック');
ok(check([{name:'A'},{name:'B'}],[],{'A':{},'B':{}}).stop===false,
   'ふつうの状態は通る');
ok(check([{name:'A'},{name:'A'}],[],{'A':{}}).stop===true,
   'RACES に同じ名前が2つあれば止まる');
ok(check([{name:'A'}],[{name:'B'}],{'A':{},'B':{}}).stop===false,
   '結果待ち（pending にだけある）レースは止めない ← 誤検知した箇所');
ok(check([{name:'A'}],[],{'A':{},'C':{}}).stop===true,
   'オッズだけあってどこにも無いレースは止まる');
ok(check([{name:'A'}],[{name:'A'}],{'A':{}}).stop===true,
   'RACES と pending の両方にあれば止まる（二重に数えるため）');

console.log('\n実物のファイルでも止まらないこと');
let out='', code=0;
try{ out=execFileSync(process.execPath,[BT],{encoding:'utf8',cwd:DIR}); }
catch(e){ out=(e.stdout||'')+(e.stderr||''); code=1; }
ok(code===0, 'いまの backtest.js は最後まで走る');
/* ★ は期待値の的中マークにも使っているので、それだけでは判定できない。
   入口のチェックが出す文言そのものを見る。 */
ok(!/レース名が重複|どこにも無いレース|二重に数えます/.test(out),
   '入口のチェックの警告が出ていない');
ok(/検証レース \d+件/.test(out), 'レース件数が表示されている');

/* pending に中身があるときだけ、結果まちの節が出ること */
const hasPending=/\{name:/.test(pendSrc);
ok(hasPending ? /結果まちのレース/.test(out) : !/結果まちのレース/.test(out),
   hasPending ? '結果待ちがあるので、その節が出ている' : '結果待ちが無いので、その節は出ていない');

/* odds.js はオブジェクトなので、同じレース名を2回書くと
   古いほうが JavaScript の時点で消える。消えてからでは気づけない。
   2026-09-27、9/25の三国8Rを足すときに実際に踏みかけた
   （9/24にも「三国8R 一般」があった）。 */
function dupKeys(src){
  const names=[...src.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map(m=>m[1]);
  const c=new Map(); for(const n of names) c.set(n,(c.get(n)||0)+1);
  return [...c].filter(([,v])=>v>1).map(([k])=>k);
}
console.log('\nodds.js の見出しの重複');
ok(dupKeys("module.exports={\n 'A': {\n 'B': {\n}").length===0, '重複が無ければ通る');
ok(dupKeys("module.exports={\n 'A': {\n 'A': {\n}")[0]==='A', '同じ名前が2回あれば見つかる');
const oddsSrc=fs.readFileSync(path.join(DIR,'data','odds.js'),'utf8');
ok(dupKeys(oddsSrc).length===0, 'いまの odds.js に重複した見出しが無い');
const names=[...oddsSrc.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map(m=>m[1]);
ok(names.length===Object.keys(require(path.join(DIR,'data','odds.js'))).length,
   '見出しの数と読み込めたレース数が一致する（消えていない）');
ok(/odds\.js に同じレース名が2回書かれています/.test(src),
   'backtest.js にその検査が入っている');

/* 名前と中身が食い違っていないか
   ------------------------------------------------------------------
   実際にあった間違い：「桐生8R 女子」なのに rno:1 が入っていた。
   公式から取り直すまで気づかなかった。名前が「8R」なら rno も 8 のはず。
   場コードも同じで、名前の頭が場の名前と合っているはず。 */
console.log('\n名前と中身（場・レース番号）');
{
  const vm2=require('vm');
  /* レース記録は data/races.js に移した（非公開リポジトリ boat-ai-data）。
     ここは配列に穴が無いかを見たいので、require ではなく本文から組み立てる。 */
  const bt=fs.readFileSync(RACES_FILE,'utf8');
  const a=bt.indexOf('module.exports = ['), b2=bt.indexOf('\n];',a);
  const RACES=vm2.runInNewContext(bt.slice(a+'module.exports ='.length,b2+2));
  const VEN={'01':'桐生','04':'平和島','10':'三国','13':'尼崎','18':'徳山',
             '19':'下関','20':'若松','23':'唐津','24':'大村'};
  let ng=0;
  for(const r of RACES){
    const m=String(r.name).match(/^(\D+?)(\d+)R/);
    if(!m){ ng++; console.log('  ✗ FAIL: 名前からレース番号が読めない: '+r.name); continue; }
    if(Number(m[2])!==r.rno){ ng++;
      console.log(`  ✗ FAIL: ${r.name} のレース番号 名前${m[2]} / 記録${r.rno}`); }
    else if(VEN[r.jcd] && VEN[r.jcd]!==m[1]){ ng++;
      console.log(`  ✗ FAIL: ${r.name} の場 名前${m[1]} / 記録${VEN[r.jcd]}`); }
  }
  ok(ng===0, `${RACES.length}レースすべて、名前と場・レース番号が合っている`);
}

console.log('\n=== 配列に穴（undefined）が開いていないか ===');
/* 2回やらかしている。どちらもレコードを足したり移したりしたときのカンマ。
     backtest.js … 末尾が「]},」で終わっているところへ「,」を足して ]},, になった
     pending.js  … レースを RACES へ移したあと、カンマだけが行として残った
   どちらも JavaScript としては正しい文法で、読み込みも通る。
   できるのは要素が undefined の「穴」で、使う側で初めて落ちる。
   文字列で ,, を探すのでは見つからない（空行をはさむ形があるため）。
   実際に読み込んで中身を見るのが確実。 */
{
  const look = (label, arr) => {
    let holes=0, badB=0;
    arr.forEach((r,i)=>{
      if(!r){ holes++; console.log(`    ${label}[${i}] が穴`); return; }
      if(!Array.isArray(r.B) || r.B.length!==6){ badB++; console.log(`    ${r.name} の B が6艇でない`); return; }
      r.B.forEach((b,j)=>{ if(!b){ holes++; console.log(`    ${r.name} の B[${j}] が穴`); } });
    });
    ok(holes===0, `${label} に穴が無い（${arr.length}件）`);
    ok(badB===0,  `${label} はすべて6艇ぶん持っている`);
  };
  /* 配列の穴は require では見えない（穴は undefined として読めてしまう）。
     本文から組み立てて確かめる。レース記録は data/races.js に移した。 */
  const RSRC = fs.readFileSync(path.join(__dirname,'..','data','races.js'),'utf8');
  const m_ = RSRC.match(/module\.exports = \[([\s\S]*?)\n\];/);
  if(!m_) throw new Error('data/races.js から RACES を取り出せない');
  const RACES_ = eval('['+m_[1]+']');
  look('RACES', RACES_);
  const PENDING = require(path.join(__dirname,'..','data','pending.js'));
  look('PENDING', PENDING);
}
/* data/ に移したファイルを、古い場所のまま指していないか
   ==================================================================
   2026-10-27、predict.js の require.resolve が 'pending.js' のままで、
   予想を出す直前に落ちた。移設のとき require() だけ直して
   require.resolve() と readFileSync を見落としていた。
   テストは通っていた（書き込み経路を誰も通していなかったため）。
   文字列として残っていないかを、ここで機械的に見る。 */
console.log('\n=== data/ のファイルを古い場所で指していないか ===');
{
  const moved=['races','odds','odds-live','payouts','card','pending','screened','bets'];
  const files=[...fs.readdirSync(DIR).filter(f=>f.endsWith('.js')),
               ...fs.readdirSync(path.join(DIR,'tests')).filter(f=>f.endsWith('.js')).map(f=>'tests/'+f)];
  let bad=0;
  for(const f of files){
    const src=fs.readFileSync(path.join(DIR,f),'utf8');
    for(const m of moved){
      /* ROOT や __dirname のすぐ下に置いている書き方だけを見る。
         'data','pending.js' のように分けてあるものは見逃さないよう別に書く。 */
      const re=new RegExp(`(ROOT|__dirname)\\s*,\\s*['"\`]${m.replace('-','\\-')}\\.js['"\`]`);
      const re2=new RegExp(`require\\(['"\`]\\.{1,2}/${m.replace('-','\\-')}\\.js['"\`]\\)`);
      if(re.test(src) || re2.test(src)){
        bad++; console.log(`  ✗ FAIL: ${f} が ${m}.js を古い場所で指している`);
      }
    }
  }
  ok(bad===0, `${files.length}個のファイルに古い指し方が残っていない`);
}

/* RACES の目印を古いまま探しているコードが残っていないか
   ==================================================================
   data/races.js に移したとき、配列の頭が const RACES=[ から
   module.exports = [ に変わった。require() の経路は直したが、
   本文から切り出している箇所を2回見落とした。
     absorb-day.js（移設時に気づいた）
     record.js の検算（2026-10-27、5件まとめて止まって気づいた）
   どちらも「止まった」ので実害は無かったが、気づくのが遅い。
   文字列として残っていないかを機械的に見る。 */
console.log('\n=== RACES の目印を古いまま探していないか ===');
{
  const files=[...fs.readdirSync(DIR).filter(f=>f.endsWith('.js')),
               ...fs.readdirSync(path.join(DIR,'tests')).filter(f=>f.endsWith('.js')).map(f=>'tests/'+f)];
  let bad=0;
  for(const f of files){
    const src=fs.readFileSync(path.join(DIR,f),'utf8');
    /* 「const RACES=[」を探している書き方。コメントの中は見逃してよいので、
       indexOf / match / RegExp の引数に出てくるものだけを見る。 */
    if(/(indexOf|match|RegExp|test)\s*\(\s*[/'"`][^'"`/]*const\s+RACES=\\?\[/.test(src)){
      bad++; console.log(`  ✗ FAIL: ${f} が「const RACES=[」を探している（いまは module.exports = [）`);
    }
  }
  ok(bad===0, `${files.length}個のファイルに古い目印が残っていない`);
}

/* 採点できなかったレースの扱い
   ------------------------------------------------------------------
   「まるごと1日そろった日だけで見る」は、選り好みの入っていない唯一の数字。
   その判定を「12レース全部そろっているか」でやっていたため、
   欠場で5艇になったレースが1本あるだけで、残り11レースごとその日が
   捨てられていた（2026-10-26 の常滑と福岡、10/28 の常滑）。
   29場日348レース → 37場日441レースに増えた。捨てていた量が大きい。

   直したあとに新しく危ないのは、この「除いてよい」の口が広がること。
   data/unscorable.js に何でも書けば、都合の悪いレースを外せてしまう。
   ・手で書けないよう、自動生成であること
   ・理由が欠場（オッズ60通り）だけであること
   を見る。 */
/* 取り直せる理由と、永久にあきらめる理由の線引き
   ------------------------------------------------------------------
   wholeday.js は、取れなかったレースを理由つきで残し、
   次に走らせたとき「取り直せるもの」だけを取りに行く。
   ここを間違えると、取れるはずのレースが永久に欠けたままになる。

   2026-10-30、児島10Rが "Command failed: curl -sS --fail ..." で落ちた。
   当時の判定は取り直せる側を並べる書き方（/取得|timeout|ENOTFOUND|ECONN/）で、
   この文面はどれにも当たらず、何度走らせても取りに行かなかった。
   知らない失敗を「永久」と決めつけるのが危ない。並びを逆にしてある。

   永久は3つだけ。それ以外は全部取り直す。 */
console.log('\n=== 取り直せる理由の線引き ===');
{
  const src=fs.readFileSync(path.join(DIR,'wholeday.js'),'utf8');
  ok(/const PERMANENT = why => \/欠場\|不成立\|中止\/\.test\(why\);/.test(src),
     'wholeday.js は「永久」を 欠場・不成立・中止 の3つで決めている');
  ok(/const RETRYABLE = why => why === LEGACY \|\| !PERMANENT\(why\)/.test(src),
     '取り直せるかは「永久でなければ取り直す」で決めている（並べ上げていない）');
  /* 実際に判定を動かして確かめる。書き方を見るだけでは、
     正規表現が意図どおり効いているかは分からない。 */
  const PERMANENT = why => /欠場|不成立|中止/.test(why);
  const LEGACY = '結果なし/不成立';
  const RETRYABLE = why => why === LEGACY || !PERMANENT(why);
  const cases = [
    ['オッズ60通り（欠場）', false, '欠場は何度取っても5艇'],
    ['不成立（レースが行われなかった）', false, '不成立は着順が出ない'],
    ['中止（レースが行われなかった）', false, '中止はレースが無い'],
    ['結果まだ（走っていない）', true, 'あとで走れば取れる'],
    ['結果なし/不成立', true, '理由を分ける前の古い文字列。1度取り直して分類し直す'],
    ['Command failed: curl -sS --fail --max-time 60', true, '通信の失敗。児島10Rで実際に起きた'],
    ['racelist の中身が短すぎる（0文字）', true, '取得の失敗'],
  ];
  let bad=0;
  for(const [why, want, note] of cases){
    const got = RETRYABLE(why);
    if(got!==want){ bad++; console.log(`  ✗ FAIL: 「${why.slice(0,36)}」は${want?'取り直す':'永久'}はず（${note}）`); }
  }
  ok(bad===0, `${cases.length}通りの理由が、すべて意図どおりに分かれている`);
  /* unscorable.js の「永久」と同じでなければ、片方だけ直したときにずれる。 */
  const un=fs.readFileSync(path.join(DIR,'unscorable.js'),'utf8');
  ok(/const PERMANENT = why => \/欠場\|不成立\|中止\/\.test\(why\);/.test(un),
     'unscorable.js の「永久」も同じ3つ（2箇所でずれていない）');
}

console.log('\n=== 採点できなかったレースの一覧が、都合よく使われていないか ===');
{
  const up=path.join(DIR,'data','unscorable.js');
  if(!fs.existsSync(up)){
    ok(true, 'data/unscorable.js は無い（まだ欠場レースに当たっていない）');
  }else{
    const list=require(up);
    ok(Array.isArray(list), 'data/unscorable.js は配列を返す');
    /* 除いてよい理由は3つだけ。ここを広げると、都合の悪いレースを
       「採点できなかった」として外せるようになる。
         欠場   … 5艇になった。6艇前提のモデルでは採点できない
         不成立 … レースが成立せず、着順も払戻も出ない
         中止   … 荒天などでレースを行わなかった
       どれも「こちらが選んだのではなく、レースが無い」ものだけ。
       「結果まだ」は取り直せば入るので、ここには来てはいけない。 */
    const ALLOWED = /^(オッズ\d+通り（欠場）|不成立（レースが行われなかった）|中止（レースが行われなかった）)$/;
    const bad=list.filter(r=>!ALLOWED.test(r.why||''));
    ok(bad.length===0,
       `除いている理由が「欠場・不成立・中止」の3つだけ`
       + (bad.length?'（ほかの理由: '+bad.map(r=>r.date+' '+r.jcd+' R'+r.rno+' '+r.why).join(' / ')+'）':''));
    const notYet=list.filter(r=>/結果まだ/.test(r.why||''));
    ok(notYet.length===0,
       `「結果まだ」が混ざっていない（混ざっていたら node wholeday.js で取り直す）`
       + (notYet.length?'（: '+notYet.map(r=>r.date+' '+r.jcd+' R'+r.rno).join(' / ')+'）':''));
    /* 除いたレースが本当に記録に入っていないこと。
       入っているのに「除いた」と書いてあれば、二重に数えている。 */
    const recorded=require(RACES_FILE);
    const inRaces=list.filter(r=>
      recorded.some(x=>x.date===r.date && x.jcd===r.jcd && x.rno===r.rno));
    ok(inRaces.length===0,
       `除いたレースはどれも記録に入っていない${inRaces.length?'（二重: '+inRaces.map(r=>r.date+' '+r.jcd+' R'+r.rno).join(' / ')+'）':''}`);
    /* 生成元があること。無いと手で書いたものと区別がつかない。 */
    ok(fs.existsSync(path.join(DIR,'unscorable.js')),
       'unscorable.js（一覧を作り直すスクリプト）がある');
    const src=fs.readFileSync(up,'utf8');
    ok(/自動生成/.test(src) && /手で書かないこと/.test(src),
       'data/unscorable.js の先頭に「自動生成・手で書かない」と書いてある');
  }
  /* backtest 側が、この一覧を「無くてよい」として数えていること。 */
  const bt=fs.readFileSync(path.join(DIR,'backtest.js'),'utf8');
  ok(/nos\.has\(i\+1\) \|\| skip\.has\(i\+1\)/.test(bt),
     'backtest.js は「記録にある、または採点できない」で1日ぶんを数えている');
  ok(/const races=full\.reduce\(\(a,\[,l\]\)=>a\+l\.length,0\)/.test(bt),
     '合計レース数を 場日×12 ではなく足し算で出している（11本の日があるため）');
}

/* テストが process.exit() で終わっていないか
   ------------------------------------------------------------------
   stdout が配管のとき Node の書き出しは非同期で、process.exit() は
   流れきる前にプロセスを落とす。2026-10-28、test38 の出力が増えたところで
   末尾の集計行が消え、tests/run.js が「実行できませんでした」と出した。
   このとき合計件数は 3131 と出ていたが、本当は 7403 だった。
   4272 件が黙って捨てられていたことになる。切れる位置は実行ごとに変わるので、
   運が悪ければ FAIL 行が消える。つまり「テストが通った」が信用できなくなる。
   いちばん危ない種類の不具合なので、戻ってこないように見張る。 */
console.log('\n=== テストが process.exit() で終わっていないか ===');
/* 探し方について。
   最初は「コメントと文字列を正規表現で剥がしてから探す」と書いたが、
   test23.js 自身の中にある [/'"`] のような文字クラスで剥がし方が崩れ、
   自分自身を誤検出した。正規表現リテラルと割り算を見分けるのは正規表現では無理。
   そこで剥がすのをやめ、
     ・複数行コメントは「いま中にいるか」を行をまたいで覚えて飛ばす
     ・呼び出しは「文のはじめにある process.exit(」だけを見る
   の2つにした。説明文の中の process.exit() は文のはじめには来ないので当たらない。 */
const exitCalls = (src) => {
  const hits=[]; let inBlock=false;
  src.split('\n').forEach((L,i)=>{
    let code='';
    for(let j=0;j<L.length;j++){
      if(inBlock){ if(L.startsWith('*/',j)){ inBlock=false; j++; } continue; }
      if(L.startsWith('/*',j)){ inBlock=true; j++; continue; }
      if(L.startsWith('//',j)) break;
      code+=L[j];
    }
    if(/(^|[{};])\s*process\.exit\s*\(/.test(code)) hits.push(`${i+1}行目: ${L.trim()}`);
  });
  return hits;
};
{
  const files=fs.readdirSync(path.join(DIR,'tests')).filter(f=>/\.js$/.test(f));
  let bad=0;
  for(const f of files){
    const hits=exitCalls(fs.readFileSync(path.join(DIR,'tests',f),'utf8'));
    if(hits.length){
      bad++;
      console.log(`  ✗ FAIL: tests/${f} が process.exit() を呼んでいる`);
      hits.slice(0,3).forEach(h=>console.log('        '+h));
      console.log('        → process.exitCode = … に置き換えてください（出力が切れます）');
    }
  }
  ok(bad===0, `tests/ の${files.length}個が process.exit() を使っていない`);
}
/* 検査そのものが効いているか。空振りしていたら何も守っていないのに通る。 */
/* 検査にかける文字列そのものが「文のはじめの呼び出し」の形になると、
   この行自身が引っかかる。つなぎ合わせて、文面として出ないようにする。 */
const EXIT='process.'+'exit';
ok(exitCalls('let a=1;\n'+EXIT+'(0);\n').length===1,
   '検査は本物の呼び出しを見つける');
ok(exitCalls('console.log(1); '+EXIT+'(1); }\n').length===1,
   '検査は行の途中にある呼び出しも見つける');
ok(exitCalls('/* '+EXIT+'() は使わない。\n   '+EXIT+'() は出力を切る。 */\n').length===0,
   '検査は複数行コメントの中の process.exit() を拾わない');
ok(exitCalls("console.log('"+EXIT+"() はだめ');\n").length===0,
   '検査は文字列の中の process.exit() を拾わない');

/* 本体のスクリプトは出力が短く、人が画面で見るものなので process.exit() のままでよい。
   ただし出力の多い backtest.js だけは、集計を配管に流すことがあるので見る。 */
{
  const src=fs.readFileSync(path.join(DIR,'backtest.js'),'utf8');
  const hit=src.split('\n').filter(L=>/process\.exit\s*\(/.test(L.split('/*')[0].split('//')[0]));
  /* backtest.js の exit は「データが無い」等で止まる経路だけ。
     集計を出しきったあとに exit していないことを見る。 */
  const last=src.lastIndexOf('process.exit(');
  const sum=src.lastIndexOf('console.log');
  ok(last<0 || last<sum,
     `backtest.js は集計を出しきったあとに process.exit() していない（exit ${hit.length}箇所はすべて途中で止まる経路）`);
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
