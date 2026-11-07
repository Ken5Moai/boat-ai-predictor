/* 1日1回、これだけ走らせれば回る
   ==================================================================
     node daily.js            … 昨日ぶんを取り込んで、今日の答えを出す
     node daily.js 20261106   … 日付を指定する
     node daily.js --skip-capture   … 取得は済んでいる前提で、取り込みだけ

   いままで、1日ぶんを入れるのに手で5つ走らせていた。
     wholeday.js → captures.js save → unscorable.js → absorb-day.js → sync-figures.js
   どれか1つ忘れると、黙って数字がずれる（実際、unscorable.js の
   走らせ忘れで「選り好みなし」が2場日ぶん少なく出ていた）。
   順番と、飛ばしてよい条件をここに1回書いて、あとは機械にやらせる。

   途中で落ちても、もう一度走らせれば続きから。
   すでに済んでいる手順は「済み」と出して飛ばす。 */
const fs=require('fs'), path=require('path');
const {execFileSync}=require('child_process');
const ROOT=__dirname;
const args=process.argv.slice(2);
const SKIP_CAP=args.includes('--skip-capture');
const HD = args.find(a=>/^\d{8}$/.test(a))
  || (()=>{ const d=new Date(Date.now()+9*3600*1000 - 86400000);
            return d.toISOString().slice(0,10).replace(/-/g,''); })();
const DATE=`${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)}`;

const run=(label, file, a=[], opt={})=>{
  console.log(`\n── ${label}`);
  try{
    const out=execFileSync(process.execPath,[path.join(ROOT,file),...a],
      {encoding:'utf8', maxBuffer:256*1024*1024, timeout:opt.timeout||7200000});
    const tail=out.trimEnd().split('\n').slice(-(opt.lines||4));
    tail.forEach(l=>console.log('   '+l));
    return {ok:true, out};
  }catch(e){
    const out=(e.stdout||'')+(e.stderr||'');
    out.trimEnd().split('\n').slice(-5).forEach(l=>console.log('   '+l));
    console.log(`   ✗ ${file} が最後まで走りませんでした。`);
    return {ok:false, out};
  }
};
const fresh=f=>{ const p=path.join(ROOT,f); delete require.cache[require.resolve(p)]; return require(p); };

console.log(`\n=== ${DATE} を取り込んで、今日の答えを出す ===`);

/* 風の後入れが走っている間は races.js を書き換えない。
   あちらは最後に1回まとめて書くので、こちらが先に書くと取りこぼす。 */
let busy=false;
try{ busy = execFileSync('pgrep',['-f','backfill-wind'],{encoding:'utf8'}).trim().length>0; }catch(e){}
if(busy) console.log('\n  ※ backfill-wind.js が走っています。races.js を書く手順は飛ばします。');

/* 1. 取る（すでに12場ぶんあれば飛ばす） */
const dir=path.join(ROOT,'tmp','wholeday',HD);
const have=fs.existsSync(dir)?fs.readdirSync(dir).filter(x=>/^\d\d\.json$/.test(x)).length:0;
if(SKIP_CAP){ console.log(`\n── 取得  --skip-capture なので飛ばします（いま ${have}場）`); }
else if(have>=10){ console.log(`\n── 取得  済み（${have}場）`); }
else run(`取得（${HD}。1場12レース×4ページ。時間がかかります）`,'wholeday.js',[HD]);

/* 2. 消えない場所に残す */
run('捕獲データを残す','captures.js',['save',HD],{lines:3});

/* 3. 採点できなかったレースを記録する（走らせ忘れると場日が減る） */
run('採点できなかったレースの一覧を作り直す','unscorable.js',[],{lines:2});

/* 4. 取り込む */
if(busy){
  console.log('\n── 取り込み  飛ばしました（風の後入れが終わってから node daily.js を走らせ直す）');
}else{
  const RACES=fresh('data/races.js');
  const already=RACES.filter(r=>r.date===DATE).length;
  if(already>0){ console.log(`\n── 取り込み  済み（${DATE} は ${already}レース入っています）`); }
  else run(`${DATE} を data/races.js に入れる`,'absorb-day.js',[HD],{lines:3});
}

/* 5. 画面の数字を実測に合わせる */
if(!busy) run('画面の数字を実測に合わせる','sync-figures.js',[],{lines:2});

/* 6. 風向きが足りなければ埋める（すでに走っているなら触らない） */
if(!busy){
  const RACES=fresh('data/races.js');
  const miss=RACES.filter(r=>r.windN==null).length;
  if(miss>0){
    console.log(`\n── 風向きが ${miss}レース 足りません`);
    console.log('   node backfill-wind.js を走らせてください（1レース約9秒）。');
  }else{
    console.log('\n── 風向き  全部入っています');
  }
}

/* 7. 今日の答え */
console.log('\n' + '='.repeat(60));
try{
  const out=execFileSync(process.execPath,[path.join(ROOT,'today.js')],
    {encoding:'utf8', maxBuffer:8*1024*1024, timeout:120000});
  console.log(out);
}catch(e){ console.log((e.stdout||'')+(e.stderr||'')); }
