/* 「買える時点のオッズ」を、開催中の全場・全レースぶん集める
   ==================================================================
     node catch-odds.js [YYYYMMDD] [--lead 15]

   なぜ要るか。
   モデルはオッズを一切見ていない。そこが構造的な穴になっている。
   選り好みなし1023レースで測ると、こうなっている。

     正解の組番を上に置いていたのは  モデル31% / 人気57%
     平均順位                      モデル22.0 / 人気16.5
     上位6点の回収率                モデル78% / 人気77%

   モデルは市場より当てていないのに、回収率はほぼ同じ。
   当たりが少ないぶん、当たったときの払戻が大きいだけで、差し引きゼロ。
   どちらも控除率（約25%）の線に貼りついている。
   当てる精度を上げても、この線は越えられない。
   越えられるとしたら「確率に対して値段が高い組」を見つけたときだけ。

   期待値方式（オッズを使う買い方）は、1054レースで回収率100%まで来ていた。
   2026-11-06、このスクリプトを書いた翌日に、過去分だけで判定できた（判定⑱）。
   結論は不採用。理由は2つ。

     ① その100%の中身が、払戻¥232,020 の1件（全体の23%）。
        先に書いてある上限（PREREG_MAX_SHARE = 5%）の外で、
        その1件を除くと 77% に戻る。
     ② 100%の計算に使っているのが data/odds.js、つまり
        「締切前後に画面から読み取ったオッズ」で、買える値段ではない。
        両方ある38レースで測ると、買える時点で期待値1.10以上だった組の
        値段は締切までに平均80%まで下がる（7割が下がる）。
        1.10のつもりで買っても、払戻ベースでは 0.88。
        選ぶオッズを替えると、回収率は 70% → 58% に落ちる。

   それでも、ここで集めるのは止めない。
   集める理由が「期待値方式を救うため」から変わった、とだけ。

     ・値段を使う案は期待値方式1つではない。
       上の②の測定そのものが、38レースのデータがあってはじめてできた。
       次に何を試すにしても、このデータが無いと判定できない。
     ・買える時点のオッズは、そのとき取らなければ永久に手に入らない
       （公式に過去の時系列オッズは無い）。後から埋め直せない。
     ・いま data/odds-live.js は38レースだけ。odds.js は1067レース。
       このスクリプトは買ったレースだけでなく全場・全レースを取るので、
       1日150レースほど貯まる。2〜3週間で 40場日に届く。

   取るのは1レース1ページだけ（オッズ表）。待っているあいだは何もしない。
   書き出しは tmp/oddslive/<日付>.json に1レースずつ追記するので、
   途中で落ちても、取れたぶんは残る。走らせ直せば続きから。 */
const fs=require('fs'), path=require('path');
const F=require('./fetch.js');
const sleep=require('./sleep.js');
const ROOT=__dirname;

const args=process.argv.slice(2);
const HD = args.find(a=>/^\d{8}$/.test(a))
        || new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
const flag=(n,d)=>{ const i=args.indexOf('--'+n); return i<0?d:args[i+1]; };
/* 何分前に取るか。auto.js が買うのは締切10〜15分前なので、そこに合わせる。
   ここを締切ぎりぎりにすると odds.js と同じものになり、集める意味が無くなる。 */
const LEAD = Number(flag('lead', 15));
const ONCE = args.includes('--once');   /* 待たずに、いま取れるぶんだけ取る */

const VN=(()=>{ const o={}; const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const re=/'(\d{2})':\{name:'([^']+)'/g; let m; while((m=re.exec(html))) o[m[1]]=m[2]; return o; })();

const OUT=path.join(ROOT,'tmp','oddslive');
fs.mkdirSync(OUT,{recursive:true});
const FILE=path.join(OUT,`${HD}.json`);
const load=()=>{ try{ return JSON.parse(fs.readFileSync(FILE,'utf8')); }catch(e){ return {}; } };
const save=o=>fs.writeFileSync(FILE, JSON.stringify(o));

const nowMin=()=>{ const d=new Date(Date.now()+9*3600*1000);
  return d.getUTCHours()*60+d.getUTCMinutes(); };
const hhmm=()=>{ const d=new Date(Date.now()+9*3600*1000);
  return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0'); };
const log=s=>console.log(`[${hhmm()}] ${s}`);

async function racingVenues(){
  const html=await F.getPage(`https://www.boatrace.jp/owpc/pc/race/index?hd=${HD}`);
  const found=[...new Set((html.match(/jcd=(\d\d)/g)||[]).map(x=>x.slice(4)))]
                .filter(j=>VN[j]).sort();
  if(!found.length) throw new Error('開催場が読み取れません');
  return found;
}

/* 締切時刻を12レースぶん読む。読めない場は開催していないものとして落とす。 */
async function schedule(jcd){
  const html=await F.getPage(
    `https://www.boatrace.jp/owpc/pc/race/racelist?rno=1&jcd=${jcd}&hd=${HD}`);
  const cs=F.cells(html).filter(x=>x&&x!=='|');
  const k=cs.findIndex(x=>/締切予定時刻/.test(x));
  if(k<0) return [];
  const ts=cs.slice(k+1,k+40).filter(x=>/^\d{1,2}:\d{2}$/.test(x)).slice(0,12);
  if(ts.length!==12) return [];
  return ts.map((t,i)=>{ const [h,m]=t.split(':').map(Number);
    return {jcd, venue:VN[jcd], rno:i+1, close:t, closeMin:h*60+m}; });
}

async function grabOdds(r, store){
  const key=`${r.jcd}_${r.rno}`;
  const html=await F.getPage(
    `https://www.boatrace.jp/owpc/pc/race/odds3t?rno=${r.rno}&jcd=${r.jcd}&hd=${HD}`);
  const odds=F.parseOdds(html);
  const n=Object.keys(odds).length;
  /* 120通りそろわない回は入れない。欠場やページの出かけで穴が開く。
     穴の開いたオッズで期待値を計算すると、買わない組を買ったことにできてしまう。 */
  if(n!==120){ log(`${r.venue}${r.rno}R オッズ${n}通り → 入れません`); return false; }
  store[key]={ jcd:r.jcd, rno:r.rno, hd:HD, close:r.close,
               minutes: r.closeMin-nowMin(), at:hhmm(), odds };
  save(store);
  return true;
}

(async()=>{
  console.log(`=== ${HD} 買える時点のオッズを集める（締切${LEAD}分前をねらう）===`);
  const store=load();
  const had=Object.keys(store).length;
  if(had) console.log(`  すでに ${had}レースぶんあります（続きから）`);

  let venues;
  try{ venues=await racingVenues(); }
  catch(e){ console.log(`  ✗ ${e.message}`); process.exitCode=1; return; }
  console.log(`  開催 ${venues.length}場（${venues.map(j=>VN[j]).join('・')}）`);

  let all=[];
  for(const jcd of venues){
    try{ const s=await schedule(jcd); all.push(...s);
         if(s.length) console.log(`  ${VN[jcd]} 12レース`); }
    catch(e){ console.log(`  ${VN[jcd]} 締切時刻が読めません（${String(e.message).slice(0,40)}）`); }
  }
  all=all.filter(r=>!store[`${r.jcd}_${r.rno}`]).sort((a,b)=>a.closeMin-b.closeMin);
  if(!all.length){ console.log('\n  取るものがありません。'); return; }
  console.log(`\n  これから取るレース ${all.length}本`);

  let got=0, missed=0;
  for(const r of all){
    const left=()=>r.closeMin-nowMin();
    if(left() < 1){
      /* 締切を過ぎている。ここで取っても「買える値段」ではないので取らない。
         取ってしまうと odds.js と同じものが odds-live.js に混ざる。 */
      missed++; continue;
    }
    if(ONCE && left() > LEAD+2){ continue; }
    while(left() > LEAD){
      const wait=Math.min(600, (left()-LEAD)*60);
      if(wait>60) log(`${r.venue}${r.rno}R 締切${r.close}（残り${left()}分）… ${Math.round(wait/60)}分待ちます`);
      sleep(wait);
    }
    if(left() < 1){ missed++; continue; }
    try{
      if(await grabOdds(r, store)){
        got++;
        log(`${r.venue}${r.rno}R 締切${r.close} の${left()}分前のオッズを取りました（計${got}本）`);
      }
    }catch(e){ log(`${r.venue}${r.rno}R 取れません: ${String(e.message).slice(0,50)}`); }
  }
  console.log(`\n  取れた ${got}本 / 締切を過ぎていた ${missed}本`);
  console.log(`  ${FILE}`);
  console.log('  ※ まだ data/odds-live.js には入れていません。');
  console.log('     入れるのは node absorb-oddslive.js（人が決めること）。');
})();
