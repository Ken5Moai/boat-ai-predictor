/* いま、買っていいのか。1画面で答える
   ==================================================================
     node today.js

   この道具だけが「買う／買わない」を言う。
   根拠は測定値だけで、気分では変えない。読むだけで、何も書き換えない。

   なぜ要るか。
   画面も backtest.js も、測った数字をたくさん出す。
   数が多いほど「どれかは良く見える」ので、結局その日の気分で決めてしまう。
   決め手を1つに絞って、そこだけ見る。

   決め手は edge.js の測定（data/edge.js）。
   控除率は約25%で、何も考えずに買えば回収率75%になる。
   これを超えるには「市場より正しい確率」が要る。
   持っていなければ、点数も配分も損切りも関係なく負ける。 */
const fs=require('fs'), path=require('path');
const ROOT=__dirname;
const r=f=>{ try{ return require(path.join(ROOT,f)); }catch(e){ return null; } };
const yen=n=>'¥'+Number(n).toLocaleString();
const JST=new Date(Date.now()+9*3600*1000).toISOString().slice(0,10);

console.log(`\n=== ${JST} いま、買っていいのか ===\n`);

/* ---- 1. 買っていいか ---- */
const E=r('data/edge.js');
if(!E){
  console.log('  判定できません。node edge.js --save をまだ走らせていません。');
}else{
  const old = (new Date(JST) - new Date(E.measuredAt))/86400000;
  console.log(E.edge
    ? '  ◎ 買ってよい。市場に足せるものが測れています。'
    : '  ■ 買わないほうがよい。');
  console.log(`     モデルを市場に混ぜたときの重み ${E.blendB}（0 なら何も足していない）`);
  console.log(`     学習に使っていない${E.testRaces}レースでの上位10点の回収率`);
  console.log(`       市場だけ ${E.retMarket10}%  →  モデルを混ぜて ${E.retBlend10}%`);
  console.log(`     モデルを使わず人気帯を丸ごと買っても、いちばん良い${E.bestBand}で ${E.bestBandPct}%`);
  if(E.windGain!=null)
    console.log(`     風を足しても ${E.windGain>=0?'+':''}${E.windGain}（${E.windRaces}レースで測定）`);
  console.log(`     （${E.measuredAt} に ${E.races}レースで測定${old>7?`／${Math.round(old)}日前。node edge.js --save で測り直し`:''}）`);
  if(!E.edge){
    console.log('\n     買えば、賭けた額のおよそ 1〜2割が平均で減ります。');
    console.log('     1レース¥1,000なら1日10レースで -¥1,500 前後が期待値です。');
  }
}

/* ---- 2. まだ決まっていない判定 ---- */
console.log('\n--- まだ決まっていないこと ---');
{
  const bt=fs.readFileSync(path.join(ROOT,'backtest.js'),'utf8');
  const need=(bt.match(/PREREG_NEED_DAYS\s*=\s*(\d+)/)||[])[1];
  const RACES=r('data/races.js')||[];
  const UNS=r('data/unscorable.js')||[];
  const after='2026-11-03';
  const days=new Set();
  for(const x of RACES){ if(x.date>after) days.add(`${x.date}|${x.jcd}`); }
  /* そろっている場日だけ数える（判定はそろった日しか使わない） */
  let full=0;
  for(const k of days){
    const [date,jcd]=k.split('|');
    const skip=new Set(UNS.filter(u=>u.date===date&&u.jcd===jcd).map(u=>u.rno));
    const nos=new Set(RACES.filter(x=>x.date===date&&x.jcd===jcd).map(x=>x.rno));
    if([...Array(12)].every((_,i)=>nos.has(i+1)||skip.has(i+1))) full++;
  }
  console.log(`  判定⑩（波乱4点だけを買うか）  いま ${full}/${need} 場日`);
  console.log(full>=Number(need)
    ? '    → たまりました。node backtest.js で判定してください。'
    : `    → あと ${Number(need)-full} 場日。1日12場なので ${Math.ceil((Number(need)-full)/12)}日ぶん。`);
}

/* ---- 3. 手元のデータ ---- */
console.log('\n--- 手元のデータ ---');
{
  const RACES=r('data/races.js')||[];
  const wind=RACES.filter(x=>x.windN!=null).length;
  console.log(`  レース記録 ${RACES.length}本`);
  console.log(`  風向きが入っている ${wind}本（${RACES.length?Math.round(wind/RACES.length*100):0}%）`
    + (wind<RACES.length?'  ← node backfill-wind.js で埋まります':''));
  const live=r('data/odds-live.js');
  console.log(`  買える時点のオッズ ${live?Object.keys(live).length:0}レース`
    + '（締切10〜20分前。後から取り直せない）');
}

/* ---- 4. 直近の収支 ---- */
console.log('\n--- 直近の収支 ---');
{
  const S=r('data/settled.js')||[];
  const B=r('data/bets.js')||[];
  const bought=fs.existsSync(path.join(ROOT,'data','bought'))
    ? fs.readdirSync(path.join(ROOT,'data','bought')).filter(x=>/^\d{8}\.json$/.test(x)).sort() : [];
  if(!S.length && !bought.length){
    console.log('  記録がありません。');
  }else{
    for(const d of S){
      const net=d.returned-d.invested;
      console.log(`  ${d.date}  投資${yen(d.invested)} 払戻${yen(d.returned)} `
        + `収支 ${net>=0?'+':'-'}${yen(Math.abs(net))}（回収率${Math.round(d.returned/d.invested*100)}%）`);
    }
    for(const f of bought)
      console.log(`  ${f.slice(0,4)}-${f.slice(4,6)}-${f.slice(6,8)}  `
        + `買った記録あり → node settle-bought.js ${f.slice(0,8)}`);
  }
  if(B.length) console.log(`  （data/bets.js には ${B.length}件の買い目が残っています）`);
}

console.log('\n--- 次にやること ---');
{
  const RACES=r('data/races.js')||[];
  const wind=RACES.filter(x=>x.windN!=null).length;
  const todo=[];
  if(wind<RACES.length) todo.push('node backfill-wind.js（風向きを埋める）');
  if(!fs.existsSync(path.join(ROOT,'data','venue-dir.js'))) todo.push('node venue-dir.js（場の向きを取る）');
  if(E && wind>RACES.length*0.5) todo.push('node edge.js --save（風を入れて測り直す）');
  todo.push('node wholeday.js <日付>（1日ぶん取る。判定⑩が進みます）');
  todo.forEach((t,i)=>console.log(`  ${i+1}. ${t}`));
}
console.log('');
