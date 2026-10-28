/* wholeday.js で取った1日ぶんを backtest.js / odds.js に取り込む
   ==================================================================
   使い方
     node absorb-day.js 20261026 --dry   何を足すかだけ出す（書かない）
     node absorb-day.js 20261026         実際に足す

   record.js と同じ方針で、書く前にぜんぶ確かめる。
     ・結果と払戻がある／不成立でない
     ・結果ページの水面気象が入っている
     ・オッズが120通りある
     ・オッズ×100 が払戻と合う（返還があるレースは数に入れない）
     ・すでに入っているレース（場・R・日付が同じ）は足さない
     ・レース名が既存とぶつからない
   どれか1つでも欠けたレースは足さずに理由を出す。

   なぜ「足さない」を強く作るか。
   ここは1回で100本以上を書き込む。1本まちがうと、どこが間違ったか
   あとから分からなくなる。入れないほうが、間違って入れるよりずっと安い。 */
const fs=require('fs'), path=require('path');
const BT=require('./backtest.js');

const HD=process.argv[2];
const DRY=process.argv.includes('--dry');
if(!/^\d{8}$/.test(HD||'')){ console.log('使い方: node absorb-day.js YYYYMMDD [--dry]'); process.exit(1); }
const DATE=`${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)}`;
const DIR=path.join(__dirname,'tmp','wholeday',HD);
if(!fs.existsSync(DIR)){ console.log(`${DIR} がありません。先に node wholeday.js ${HD} を走らせてください。`); process.exit(1); }

const HTML=fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
const VN={}; { const re=/'(\d{2})':\{name:'([^']+)'/g; let m; while((m=re.exec(HTML))) VN[m[1]]=m[2]; }

/* すでに入っているレース（場・R・日付）と、すでに使われているレース名 */
const have=new Set(BT.RACES.map(r=>`${r.jcd}|${r.rno}|${r.date}`));
const names=new Set(BT.RACES.map(r=>r.name));

const f=(v,dp)=> v==null ? 'null' : Number(v).toFixed(dp);
/* 0.18 を .18 と書くための変換。
   以前は String(v).replace(/^0/,'') でやっていたが、v がちょうど 0 のとき
   空文字になり `exST:,` `6:}` という壊れた行を作っていた（2026-10-26）。
   展示STが 0.00 のレース、本番STが 0 のレースで実際に起きる。
   先頭が "0." のときだけ 0 を落とす。 */
const dot = v => v==null ? 'null' : (String(v).startsWith('0.') ? String(v).slice(1) : String(v));
/* 「オッズ×100 が払戻と合うか」の判断。書き込み前と書き込み後の両方で使う。
   同じ判断を2箇所に書いていたせいで、片方だけ直して毎回巻き戻っていた。

   返還があるとき … 払戻は生き残った票だけのプールで計算し直されるので
     締切時オッズとは一致しない。安くなっていることだけを見る。
   1000倍以上のとき … 公式のオッズ画面が整数にして出すので小数が落ちる。
     2026-10-27 唐津8R は画面1893・払戻¥189,370（真の値1893.7）。
     落ちた小数で説明がつく範囲（切り捨て/四捨五入のどちらか）だけ許す。
   それ以外 … ぴったり一致を求める。 */
const payMatches = (odds, pay, refund) => {
  if(odds==null || pay==null) return false;
  if(refund && refund.length) return pay < Math.round(odds*100);
  if(Math.round(odds*100)===pay) return true;
  return odds>=1000 && (Math.floor(pay/100)===odds || Math.round(pay/100)===odds);
};
const add=[], skip=[];

for(const file of fs.readdirSync(DIR).filter(x=>/^\d\d\.json$/.test(x)).sort()){
  const j=JSON.parse(fs.readFileSync(path.join(DIR,file),'utf8'));
  for(const r of j.races){
    const where=`${VN[r.jcd]||r.jcd}${r.rno}R`;
    const R=r.result;
    if(have.has(`${r.jcd}|${r.rno}|${DATE}`)){ skip.push([where,'すでに記録ずみ']); continue; }
    if(!R || R.void || R.result==null || R.pay==null){ skip.push([where,'結果か払戻が無い／不成立']); continue; }
    if(R.ws==null || R.wave==null){ skip.push([where,'結果ページの水面気象が空']); continue; }
    const ks=Object.keys(r.odds);
    if(ks.length!==120){ skip.push([where,`オッズ${ks.length}通り（欠場）`]); continue; }
    const o=r.odds[R.result];
    if(o==null){ skip.push([where,'正解の組のオッズが無い']); continue; }
    /* 返還があるレースの扱い。
       ここは以前「数に入れない（record.js と同じ扱い）」と書いて落としていたが、
       record.js は落としていない。記録して、確かめ方だけ変えている。
       書いた本人（私）が取り違えていた。

       返還があると、払戻は生き残った票だけのプールで計算し直されるので
       オッズ×100 とは一致しない。一致を求めれば永久に入らない。
       代わりに record.js と同じ2つを見る。
         ・正解の組に返還艇が入っていないこと（入っていたら読み取りがおかしい）
         ・払戻が、締切時オッズ換算より安いこと（プールが減るので必ず安くなる）
       落としていたせいで 2026-10-27 の平和島・津・大村、10/28 の唐津が
       「あと1本」で12レースそろわず、選り好みなしの判定から外れていた。 */
    const refund=(R.refund||[]).map(String);
    if(refund.length){
      if(String(R.result).split('-').some(x=>refund.includes(x))){
        skip.push([where,`正解 ${R.result} に返還艇 ${refund.join('・')} が入っている（読み取りがおかしい）`]); continue;
      }
      const want=Math.round(o*100);
      if(!(R.pay < want)){
        skip.push([where,`返還艇 ${refund.join('・')} ありなのに払戻¥${R.pay} が`
                       + `締切時オッズ換算¥${want} より安くない（売上が減れば必ず安くなるはず）`]); continue;
      }
    }else if(!payMatches(o, R.pay, refund)){
      /* 公式のオッズ画面は、1000倍以上を整数にして出す（小数が落ちる）。
         2026-10-27 唐津8R は画面が 1893 で、払戻は ¥189,370 だった。
         真の値は 1893.7 で、取り込みは画面どおりなので誤りではない。
         ぴったり一致を求めると、1000倍以上のレースが永久に入らない。

         そこで「落ちた小数のぶんだけ」を許す。許すのは
           ・切り捨て表示  画面の値 = floor(払戻/100)
           ・四捨五入表示  画面の値 = round(払戻/100)
         のどちらかで説明がつく場合だけ。唐津8R は切り捨てだった（1893.7→1893）が、
         公式がどちらを使っているかは1件では決められないので両方を許す。
         1000倍未満は画面に小数が出るので、ぴったり一致を求め続ける。 */
      skip.push([where,`オッズ×100=${Math.round(o*100)} が払戻¥${R.pay}と合わない`]); continue;
    }
    if(r.boats.length!==6){ skip.push([where,`出走表が${r.boats.length}艇`]); continue; }

    const md=`(${Number(HD.slice(4,6))}/${Number(HD.slice(6,8))})`;
    const name=`${VN[r.jcd]||r.jcd}${r.rno}R ${r.title||'番組名不明'}${md}`;
    if(names.has(name)){ skip.push([where,`レース名 ${name} が既存とぶつかる`]); continue; }
    names.add(name);

    const st=Object.keys(R.actualST||{}).length
      ? ` actualST:{${[1,2,3,4,5,6].filter(l=>R.actualST[l]!=null)
          .map(l=>`${l}:${dot(R.actualST[l])}`).join(',')}},\n` : '';
    const body=`{name:'${name}',jcd:'${r.jcd}',rno:${r.rno},date:'${DATE}',`
      + `result:'${R.result}',pop:${R.pop},pay:${R.pay},\n`
      + st
      /* 返還艇は記録に残す。これが無いと、あとからオッズと払戻が合わない理由が
         分からなくなり、テスト（test37）も「払戻が合わない」と落ちる。 */
      + (refund.length ? ` refund:[${refund.join(',')}],\n` : '')
      + ` wind:null,ws:${R.ws},wave:${R.wave},temp:${R.temp},wtemp:${R.wtemp},\n B:[\n`
      + r.boats.map((b,i)=>` {reg:'${b.reg}',g:'${b.g}',nat:${f(b.nat,2)},loc:${f(b.loc,2)},`
        + `motNo:${b.motNo??'null'},mot:${f(b.mot,2)},`
        + `btNo:${b.btNo??'null'},bt:${f(b.bt,2)},st:${b.st==null?'null':f(b.st,2)},F:${b.F},`
        + `exST:${dot(b.exST)},`
        + `exF:${b.exF?"'F'":'null'},exT:${f(b.exT,2)},tilt:${f(b.tilt,1)},wt:${f(b.wt,1)},`
        + (b.adj ? `adj:${f(b.adj,1)},` : '')
        + (b.parts ? `parts:'${b.parts}',` : '')
        + `entry:${b.entry},rec:[${(b.rec||[]).map(x=>`[${x[0]},${dot(x[1])},`
        + `${typeof x[2]==='number'?x[2]:`'${x[2]}'`}]`).join(',')}]}`).join(',\n')
      + `]}`;

    const lines=[];
    for(let a=1;a<=6;a++) for(let b2=1;b2<=6;b2++){
      if(a===b2) continue;
      const row=[];
      for(let c=1;c<=6;c++){ if(c===a||c===b2) continue;
        const k=`${a}-${b2}-${c}`; if(r.odds[k]!=null) row.push(`'${k}':${r.odds[k]}`); }
      if(row.length) lines.push(' '+row.join(','));
    }
    /* 1本ずつその場で構文を確かめる。まとめて書いてから壊れていると、
       123本のどれが悪いのか分からなくなる（実際そうなった）。 */
    try{ new Function('return ['+body+']')(); }
    catch(e){ skip.push([where,`組み立てた行が壊れている: ${e.message}`]); continue; }
    add.push({name, where, block:body, odds:`  '${name}': {\n${lines.join(',\n')}\n  },`});
  }
}

console.log(`\n${DATE} から足せるレース ${add.length}本 / 足さないレース ${skip.length}本`);
if(skip.length){
  console.log('\n足さない理由');
  const byWhy=new Map();
  for(const [w,why] of skip){ const k=why.replace(/\d+/g,'N'); if(!byWhy.has(k)) byWhy.set(k,[]); byWhy.get(k).push(`${w}（${why}）`); }
  for(const [k,v] of byWhy) console.log(`  ${v.length}本  ${k}\n       ${v.slice(0,6).join(' / ')}${v.length>6?` ほか${v.length-6}本`:''}`);
}
if(DRY){ console.log('\n--dry なので何も書いていません。'); process.exit(0); }
if(!add.length){ console.log('\n足すものがありません。'); process.exit(0); }

/* ---- 書く。書いたあとで必ず読み直して確かめる ---------------------- */
const btPath=path.join(__dirname,'data','races.js'), odPath=path.join(__dirname,'data','odds.js');
const btBefore=fs.readFileSync(btPath,'utf8'), odBefore=fs.readFileSync(odPath,'utf8');
const nBefore=BT.RACES.length;

/* RACES の閉じ括弧の直前に差し込む。閉じ方が想定と違えば何もしない。 */
const END=/\n\];\s*\n\s*\/\* ---- 実オッズ/;
let bt=btBefore;
const endRe=/^\];$/m;
const marker='\n/* ---- ここから node absorb-day.js '+HD+' で足したぶん ---- */\n';
const racesEnd=bt.indexOf('\n];', bt.indexOf('module.exports = ['));
if(racesEnd<0){ console.log('✗ RACES の終わりが見つからない。何も書いていない。'); process.exit(1); }
bt = bt.slice(0,racesEnd) + ',\n' + marker + add.map(a=>a.block).join(',\n') + bt.slice(racesEnd);

/* odds.js は最後の } の直前に差し込む */
const od=odBefore.replace(/\n\};\s*$/, '\n'+add.map(a=>a.odds).join('\n')+'\n};\n');
if(od===odBefore){ console.log('✗ odds.js の終わりが見つからない。何も書いていない。'); process.exit(1); }

fs.writeFileSync(btPath,bt); fs.writeFileSync(odPath,od);

/* 読み直して確かめる。require のキャッシュを捨ててから読む
   （record.js でここを忘れて、古い配列を見て「末尾が違う」と誤判定した） */
let ok=true;
try{
  delete require.cache[require.resolve('./backtest.js')];
  delete require.cache[require.resolve('./data/races.js')];
  delete require.cache[require.resolve('./data/odds.js')];
  const B2=require('./backtest.js'), O2=require('./data/odds.js');
  const n2=B2.RACES.length;
  if(n2!==nBefore+add.length){ console.log(`✗ レース数が ${nBefore}→${n2}（${nBefore+add.length} のはず）`); ok=false; }
  if(B2.RACES.some(r=>r==null)){ console.log('✗ 配列に穴がある'); ok=false; }
  for(const a of add){
    const r=B2.RACES.find(x=>x.name===a.name);
    if(!r){ console.log(`✗ ${a.name} が入っていない`); ok=false; continue; }
    const o=O2[a.name];
    if(!o || Object.keys(o).length!==120){ console.log(`✗ ${a.name} のオッズが120通りでない`); ok=false; continue; }
    /* 書き込む前の検査と同じ条件で見る。
       ここだけ「ぴったり一致」のままだったので、返還ありと1000倍以上の
       レースが毎回この検算で落ち、4本まとめて巻き戻っていた。
       同じ判断を2箇所に書くと必ずずれるので、条件を関数にして両方から呼ぶ。 */
    if(!payMatches(o[r.result], r.pay, r.refund)){
      console.log(`✗ ${a.name} のオッズと払戻が合わない`
        + `（オッズ${o[r.result]}倍 / 払戻¥${r.pay}`
        + (r.refund&&r.refund.length?` / 返還${r.refund.join('・')}`:'')+'）');
      ok=false;
    }
  }
}catch(e){ console.log('✗ 読み直せなかった: '+e.message); ok=false; }

if(!ok){
  fs.writeFileSync(btPath,btBefore); fs.writeFileSync(odPath,odBefore);
  console.log('\n確かめに失敗したので、元に戻しました。ファイルは触る前のままです。');
  process.exit(1);
}
console.log(`\n${add.length}本を足しました（${nBefore} → ${nBefore+add.length}レース）。`);
console.log('※ node sync-figures.js を走らせてから node tests/run.js してください。');
