// 実際に走ったレースで採点の当たり具合を測る道具。
// 重みやバンドを思いつきで変えないための検証環境。
//   使い方: node backtest.js        （index.html と同じ場所で実行）
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
require('./need-data.js')(__dirname);   /* data/ が無ければ理由を出して止まる */
const ODDS=require('./data/odds.js');   /* 実オッズ120通り（あるレースだけ） */
/* 予想のときに見ていた締切前のオッズ。締切時オッズとのずれを測るのに使う。 */
const ODDS_LIVE = require('./data/odds-live.js');
const PENDING=require('./data/pending.js'); /* まだ結果の出ていないレース */

const HTML_PATH=path.join(__dirname,'index.html');
const HTML=fs.readFileSync(HTML_PATH,'utf8');
/* 買う点数は index.html の BUY_POINTS が持っている。ここでも文字から読む。
   数字を書き写すと本体とずれ、「本線10点 91%」と出しながら中身は6点、
   という状態になる。読む人がいちばん信じる数字なので、必ず本体から取る。 */
const PTS = (()=>{
  const m = HTML.match(/const BUY_POINTS = \{\s*main:\s*(\d+),\s*ana:\s*(\d+)\s*\}/);
  if(!m) throw new Error('index.html の BUY_POINTS が読めません（買う点数が分かりません）');
  return { main:Number(m[1]), ana:Number(m[2]) };
})();
const PTS_ALL = PTS.main + PTS.ana;
const L_MAIN = `本線${PTS.main}点`;
const L_ANA  = `波乱${PTS.ana}点`;
const L_ALL  = `本線${PTS.main}＋波乱${PTS.ana}（${PTS_ALL}点）`;
/* 競艇場ごとの公表イン率（1コース1着率）。index.html の VENUES から読む。
   17レースの勝率よりずっと確かな物差しとして、採点の校正に使う。 */
const VENUE_IN_RATE = (()=>{
  const out = {};
  const src = HTML;
  const re = /'(\d{2})':\{name:'[^']+',\s*water:'[^']+',\s*inRate:(\d+)/g;
  let m; while((m = re.exec(src))) out[m[1]] = Number(m[2]);
  return out;
})();
/* 場コード → 場名。これも index.html の VENUES から読む（二重に持たない）。
   2026-10-26 に桐生を 02 と打って出走表が取れなかった。02 は戸田。
   コードと名前の対応がどこにも書いていないのが原因だったので、
   ここで引けるようにし、出力には必ず場名を出す。 */
const VENUE_NAME = (()=>{
  const out = {};
  const re = /'(\d{2})':\{name:'([^']+)'/g;
  let m; while((m = re.exec(HTML))) out[m[1]] = m[2];
  return out;
})();

/* レース記録は data/races.js（boat-ai-data・非公開）にある。
   公開リポジトリには取り込んだ内容を置かない。 */
const RACES=require('./data/races.js');
/* 採点できなかったレース（欠場で5艇になった回）。node unscorable.js で作る。
   「まるごと1日そろった日」を数えるときに「無くてよい」として扱う。
   無ければ空（古い data/ でも動く）。 */
let UNSCORABLE=[]; try{ UNSCORABLE=require('./data/unscorable.js'); }catch(e){}


function runWith(weightPatch, bandPatch, opt){
  opt=opt||{};
  const dom=new JSDOM(opt.html||HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
   beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  const w=dom.window,d=w.document;
  w.Element.prototype.scrollIntoView=function(){};
  const W=w.eval('W'); Object.assign(W, weightPatch||{});
  if(bandPatch) Object.assign(w.eval('BAND'), bandPatch);
  const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
  const out=[];
  for(const R of (opt.races || RACES)){
    state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
    R.B.forEach((x,i)=>{ d.getElementById('reg'+(i+1)).value=x.reg; });
    w.syncRegsFromInputs();
    R.B.forEach((x,i)=>{
      const b=w.boatOf(i+1);
      setField(b,'name','選手'+(i+1),'official'); setField(b,'grade',x.g,'official');
      setField(b,'nationalWinRate',x.nat,'official');
      /* 当地勝率 0.00 は「まだこの場で走っていない」の意味で、欠測ではない。
         index.html の取り込み経路（b.localNone）と同じ扱いにそろえる。
         ここをそろえていなかったため、画面では出せるレースがテストでは出せず、
         原因を「アプリのバグ」と取り違えた（2026-10-25）。
         採点結果はどちらも欠測扱いで同じなので、測定値は変わらない。 */
      if(x.loc === 0) b.localNone = true;
      else if(x.loc != null) setField(b,'localWinRate',x.loc,'official');
      setField(b,'motor2Rate',x.mot,'official'); setField(b,'boat2Rate',x.bt,'official');
      if(x.st!=null) setField(b,'averageST',x.st,'official');
      setField(b,'exhibitionTime',x.exT,'official');
      b.exhibitionSTFlag=x.exF; setField(b,'exhibitionST',x.exST,'official');
      setField(b,'tilt',x.tilt,'official'); setField(b,'weight',x.wt,'official');
      if(x.adj!=null) setField(b,'adjustmentWeight',x.adj,'official');
      if(x.parts) b.partsChange=x.parts;
      b.flagF=x.F; b.flagL=0;
      if(x.entry) b.entryCourse = (opt.useActualEntry && R.actualEntry) ? R.actualEntry[i+1] : x.entry;
      if(x.rec && x.rec.length){
        b.recentRaces=x.rec.map(r=>({course:r[0],st:r[1],stFlag:null,result:r[2]}));
        b.recentSource='official';
      }
    });
    d.getElementById('venue').value=R.jcd; d.getElementById('raceDate').value=R.date;
    d.getElementById('raceNo').value=String(R.rno||1);
    d.getElementById('wave').value=String(R.wave); d.getElementById('windSpeed').value=String(R.ws);
    if(R.wind) d.getElementById('windDir').value=R.wind;
    if(R.temp!=null) d.getElementById('temp').value=String(R.temp);
    if(R.wtemp!=null) d.getElementById('waterTemp').value=String(R.wtemp);
    const ctx=w.scoreAll();
    const combos=w.buildProbabilities(ctx);
    const rank=combos.findIndex(c=>c.combo===R.result)+1;
    const sorted=[...state.boats].sort((a,b)=>b.score-a.score);
    const rec={name:R.name, result:R.result, pop:R.pop, pay:R.pay, pays:R.pays, rank,
               gap: Math.round((sorted[0].score-sorted[1].score)*10)/10,
               probs:combos.map(c=>c.p),
               /* probs は確率の高い順。組番と対応させるにはこちらを使う。 */
               probOf:Object.fromEntries(combos.map(c=>[c.combo,c.p]))};
    if(opt.detail){
      rec.order=[...state.boats].sort((a,b)=>b.score-a.score).map(b=>`${b.lane}(${b.score.toFixed(1)})`);
      rec.head=combos[0].combo.split('-')[0];
      rec.top3=combos.slice(0,3).map(c=>c.combo);
      rec.breakdown=state.boats.map(b=>({lane:b.lane,
        parts:b.scoreBreakdown.map(p=>`${p.label}:${Math.round(p.val)}`)}));
    }
    out.push(rec);
  }
  return out;
}

const allCombos = (()=>{ const o=[];
  for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ if(b===a) continue;
    for(let c=1;c<=6;c++){ if(c===a||c===b) continue; o.push(`${a}-${b}-${c}`); } }
  return o; })();

function summarize(res){
  const r=res.map(x=>x.rank);
  return { ranks:r, avg:r.reduce((a,c)=>a+c,0)/r.length,
           in6:r.filter(x=>x<=6).length, in12:r.filter(x=>x<=12).length,
           in20:r.filter(x=>x<=20).length, n:r.length };
}
const line=s=>`[${s.ranks.map(x=>String(x).padStart(3)).join(' ')}]  平均${s.avg.toFixed(1)}  `+
  `6点${s.in6}/${s.n} 12点${s.in12}/${s.n} 20点${s.in20}/${s.n}`;

if(require.main===module){
  /* オッズはレース名で引いている。名前が重なると別のレースのオッズを拾う。
     同じ場の同じレース番号が別の日に出てくるので、実際に起きかけた（徳山2Rが2つ）。
     気づけない種類の取り違えなので、毎回ここで止める。 */
  {
    const seen = new Map();
    for(const r of RACES) seen.set(r.name, (seen.get(r.name)||0)+1);
    const dup = [...seen].filter(([,v])=>v>1).map(([k])=>k);
    if(dup.length){
      console.error(`★ レース名が重複しています: ${dup.join(', ')}`);
      console.error('  オッズはレース名で引いているので、別のレースの数字を拾います。');
      console.error('  名前を分けてください（例「徳山2R 特選」「徳山2R 狙いトク特選」）。');
      process.exit(1);
    }
    /* 結果待ちのレースは pending.js にあり、RACES にはまだ無い。
       それは正しい状態なので、pending も見てから判断する。
       （この判定を入れた直後に、自分で誤検知を出した） */
    const known = new Set([...RACES, ...PENDING].map(r=>r.name));
    const missing = Object.keys(ODDS).filter(k=>!known.has(k));
    if(missing.length){
      console.error(`★ odds.js にあるのに RACES にも pending.js にも無いレース: ${missing.join(', ')}`);
      console.error('  名前の書き間違いか、RACES への移し忘れです。');
      process.exit(1);
    }
    for(const r of PENDING){
      if(RACES.some(q=>q.name===r.name)){
        console.error(`★ pending.js のレース名が RACES と重複しています: ${r.name}`);
        console.error('  すでに結果を入れたレースを二重に数えます。');
        process.exit(1);
      }
    }

    /* odds.js はオブジェクトなので、同じレース名で2回書くと
       古いほうが JavaScript の時点で黙って消える。
       消えたあとでは Object.keys を見ても何も分からないので、
       ファイルの文字列のほうを数えて突き合わせる。
       2026-09-27、9/25の三国8Rを足すときに実際に踏みかけた
       （9/24にも「三国8R 一般」があった）。 */
    {
      const src = fs.readFileSync(path.join(__dirname,'data','odds.js'),'utf8');
      const names = [...src.matchAll(/^\s*'([^']+)'\s*:\s*\{/gm)].map(m=>m[1]);
      const cnt = new Map();
      for(const n of names) cnt.set(n,(cnt.get(n)||0)+1);
      const dupK = [...cnt].filter(([,v])=>v>1).map(([k])=>k);
      if(dupK.length){
        console.error(`★ odds.js に同じレース名が2回書かれています: ${dupK.join(', ')}`);
        console.error('  オブジェクトなので、あとに書いたほうだけが残り、前のオッズは消えます。');
        console.error('  日付を名前に入れて分けてください（例「三国8R 一般(9/25)」）。');
        process.exit(1);
      }
      if(names.length !== Object.keys(ODDS).length){
        console.error(`★ odds.js の見出し ${names.length}件に対し、読み込めたのは ${Object.keys(ODDS).length}件です。`);
        console.error('  どこかで名前が重なって消えています。');
        process.exit(1);
      }
    }
  }
  /* 書き写したオッズと、実際の払戻が合っているかを毎回照合する。
     3連単の払戻は「当たった組のオッズ×100円」なので、
     odds.js の値が正しければ pay と必ず一致する。
     ここまで14レース連続で一致していたが、それを確かめていたのは手作業だった。
     1つでもズレたら、書き写しの誤りか、締切前のオッズを拾っている。 */
  {
    const bad = [], drift = [];
    for(const R of RACES){
      const m = ODDS[R.name]; if(!m || !R.result || !R.pay) continue;
      const o = m[R.result]; if(o == null) continue;
      const expect = Math.round(o*100);
      if(Math.abs(expect - R.pay) <= 0.5) continue;
      const rec = { name:R.name, combo:R.result, odds:o, expect, pay:R.pay,
                    gap:(R.pay/expect-1)*100, pre:R.preClose };
      (R.preClose ? drift : bad).push(rec);
    }
    const n = RACES.filter(R=>ODDS[R.name] && R.result && R.pay).length;
    const okN = n - bad.length - drift.length;
    console.log(`オッズと払戻の照合  ${n}レース中 ${okN}レース一致`);
    if(drift.length){
      console.log('  締切前のオッズを使っているレース（ズレは想定内）');
      for(const b of drift)
        console.log(`    ${b.name}  ${b.combo}  ${b.odds}倍→¥${b.expect}  `+
                    `実際¥${b.pay}  ${b.gap>=0?'+':''}${b.gap.toFixed(1)}%  [${b.pre}]`);
      console.log('    締切前の市場は未完成なので、モデルとの比較では不利に働く。');
      /* 締切までの時間とズレの大きさを並べる。
         いつスクショを撮ればいいかが、そのまま読み取れる。 */
      const mins = d => { const m = /(\d+):(\d+)（締切(\d+):(\d+)/.exec(d.pre);
        return m ? (Number(m[3])*60+Number(m[4])) - (Number(m[1])*60+Number(m[2])) : null; };
      const timed = drift.map(d=>({...d, min:mins(d)})).filter(d=>d.min!=null)
                         .sort((a,b)=>b.min-a.min);
      if(timed.length >= 2){
        console.log('    締切までの時間とズレ');
        for(const t of timed)
          console.log(`      ${String(t.min).padStart(2)}分前  ${t.gap>=0?'+':''}${t.gap.toFixed(1)}%  ${t.name}`);
        console.log('      → 締切に近いほどオッズは動かない。');
        console.log('        スクショは「締切時オッズ」表示に切り替わってからが正確。');
      }
    }
    if(bad.length){
      console.log('■ 説明のつかないズレ（書き写しの誤りの可能性）');
      for(const b of bad)
        console.log(`    ${b.name}  ${b.combo}  書き写し${b.odds}倍→¥${b.expect}  `+
                    `実際¥${b.pay}  差${b.gap>=0?'+':''}${b.gap.toFixed(1)}%`);
      console.log('    該当レースのオッズを読み直すこと。');
    }
    console.log('');
  }
  console.log(`検証レース ${RACES.length}件\n`);
  console.log('=== 現在の重み ===');
  const base=runWith({},null,{detail:true});
  /* index.html の関数（upsetView / outerSecond）をそのまま使う。
     検証用に書き写すと本体とずれるので、本体を読み込んで呼ぶ。 */
  const WIN = (()=>{
    const d2=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
      beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
    d2.window.Element.prototype.scrollIntoView=function(){};
    return d2.window;
  })();
  /* 波乱ブロックを足すと、どうなるか
     ==================================================================
     「本線10点＋波乱9点＝19点なら良い」という案を測った。
     波乱ブロックは index.html の upsetView / outerSecond で作ったもので、
     本命が飛んだ場合に限った条件つき確率の上位から3艇×3点を取る。

     結果は厳しかった。自分で作ったものだが、そのまま書く。 */
  {
    const toCombos = r => Object.entries(r.probOf)
      .map(([combo,p])=>({combo,p})).sort((a,b)=>b.p-a.p);
    const done = base.filter((r,i)=>RACES[i] && RACES[i].pay!=null);
    const payOf = {}; for(const R of RACES) if(R.pay!=null) payOf[R.name]={pay:R.pay, result:R.result};

    const haran = (combos, mode) => {
      const fav = Number(String(combos[0].combo)[0]);
      const U = WIN.upsetView(combos, fav);
      const out = [];
      for(const x of U.lanes.filter(y=>y.cond>=0.10).slice(0,3)){
        const src = mode==='outer' ? WIN.outerSecond(x, x.lane).list : x.list;
        for(const c of src.slice(0,3)) out.push(String(c.combo));
      }
      return out;
    };
    const run = (label, pick, mode) => {
      let inv=0, back=0, hit=0, pts=0;
      for(const r of done){
        const info = payOf[r.name]; if(!info) continue;
        const ks = [...new Set(pick(toCombos(r)))];
        pts += ks.length; inv += ks.length*100;
        if(ks.includes(info.result)){ back += info.pay; hit++; }
      }
      console.log(`  ${label.padEnd(26)} 平均${(pts/done.length).toFixed(1)}点  `+
        `回収率${(back/inv*100).toFixed(0).padStart(4)}%  的中${String(hit).padStart(2)}/${done.length}`);
    };
    console.log('\n=== 波乱ブロックを足すと回収率はどうなるか ===');
    console.log('  「本線10点＋波乱9点＝19点」という案を測った結果。');
    run('本線10点のみ',          c=>c.slice(0,10).map(x=>String(x.combo)));
    run('確率順19点',            c=>c.slice(0,19).map(x=>String(x.combo)));
    run('本線10＋波乱9（モデル順）', c=>[...c.slice(0,10).map(x=>String(x.combo)), ...haran(c,'model')]);
    run('本線10＋波乱9（外に限る）', c=>[...c.slice(0,10).map(x=>String(x.combo)), ...haran(c,'outer')]);
    run('波乱9だけ（モデル順）',    c=>haran(c,'model'));
    run('波乱9だけ（外に限る）',    c=>haran(c,'outer'));
    console.log('  ※ 的中数に注目すること。波乱を足しても的中数が増えていなければ、');
    console.log('    波乱が当てた回は本線でも当てていたということ。投資だけが増える。');

    /* 「当たったときの払戻が大きいなら、的中率が低くても元が取れる」という考え方の検算。
       正しい考え方だが、このブロックでは成立していなかった。
       条件つき確率の上位を取ると、結局「安い組」が並ぶため。 */
    {
      let miss=0, saved=0, cost=0, back=0;
      const rows=[];
      for(const r of done){
        const info = payOf[r.name]; if(!info) continue;
        const c = toCombos(r);
        const main = c.slice(0,10).map(x=>String(x.combo));
        const H = [...new Set(haran(c,'model'))];
        cost += H.length*100;
        if(H.includes(info.result)) back += info.pay;
        if(!main.includes(info.result)){
          miss++; if(H.includes(info.result)) saved++;
          rows.push({pay:info.pay, result:info.result, rank:r.rank, name:r.name});
        }
      }
      console.log(`\n  本線10点が外したのは ${miss}レース。そのうち波乱で拾えたのは ${saved}レース。`);
      console.log('  本線が外した回の払戻と、モデルの順位');
      rows.sort((a,b)=>b.pay-a.pay).slice(0,6).forEach(x=>
        console.log(`    ¥${String(x.pay).padStart(6)}  ${x.result}  ${String(x.rank).padStart(3)}番目  ${x.name}`));
      console.log('  高配当ほどモデルの順位が遠い。波乱ブロックは上位9点しか取らないので届かない。');
      console.log(`  波乱ブロック単体  投資¥${cost.toLocaleString()} 払戻¥${back.toLocaleString()}`);
      console.log('  損益分岐に必要な的中数（1回あたりの払戻別）');
      for(const X of [5000,10000,20000,30000]){
        const n = cost/X;
        console.log(`    1回¥${String(X).padStart(6)} なら ${n.toFixed(1)}回／${done.length}レース必要`);
      }
      /* ここは以前「2回あたって平均¥1,275」と固定文で書いていた。
         レースを足しても書き換わらず、古い数字が残り続けた。計算に変えた。 */
      {
        const hits=[];
        for(const r of done){ const info=payOf[r.name]; if(!info) continue;
          const H=[...new Set(haran(toCombos(r),'model'))];
          if(H.includes(info.result)) hits.push(info.pay); }
        const avg = hits.length ? Math.round(hits.reduce((a,c)=>a+c,0)/hits.length) : 0;
        console.log('  「当たれば大きい」は正しい考え方だが、このブロックの実測は');
        console.log(`  ${hits.length}回あたって平均¥${avg.toLocaleString()}。`+
          (hits.length&&Math.max(...hits)<10000
            ? '安い組ばかりで、高配当は1回も取れていない。'
            : `いちばん大きいのは¥${Math.max(...hits).toLocaleString()}。`));
      }
    }
  }

  /* 「至極の一点1点 / 本線n点 / 波乱m点」で買ったら
     ==================================================================
     2026-10-24に本人から出た買い方。index.html の buyPlan() がその形を決める。
     ここは同じ関数を呼んで、57レースで実際にいくらになるかを測るだけ。

     至極の一点は本線の中に入っている（1位の組だから）。別枠ではない。
     なので買う組は main+ana 点。至極に厚く賭けるかどうかは、点数とは別の話。
     点数は index.html の BUY_POINTS で決まる（ここには書き写さない）。 */
  {
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p}));
    const done = base.map((r,i)=>({r, R:RACES[i]})).filter(x=>x.R && x.R.pay!=null);
    const plan = (x, m) => WIN.buyPlan(toC(x.r), {anaMode:m});

    console.log(`\n=== 「至極の一点 / ${L_MAIN} / ${L_ANA}」で買ったら ===`);
    console.log(`  対象 ${done.length}レース。1点100円で統一。`);
    const run = (label, pick, mode) => {
      let inv=0, hits=[];
      for(const x of done){
        const ks=[...new Set(pick(plan(x, mode)))];
        inv += ks.length*100;
        if(ks.includes(x.R.result)) hits.push(x.R.pay);
      }
      const back = hits.reduce((a,c)=>a+c,0);
      const cut  = hits.length ? back-Math.max(...hits) : 0;
      console.log(`  ${label.padEnd(22)} 投資¥${String(inv).padStart(6)}  `+
        `回収率${String(Math.round(back/inv*100)).padStart(4)}%  `+
        `最大1件除くと${String(Math.round(cut/inv*100)).padStart(4)}%  `+
        `的中${String(hits.length).padStart(2)}/${done.length}`);
    };
    run('至極の一点だけ（1点）', p=>[p.best]);
    run(`本線だけ（${PTS.main}点）`,      p=>p.main);
    console.log('  ─ 波乱の取り方① 荒れ予想と同じ（本命が飛んだ場合に限った確率）─');
    run(`  波乱だけ（${PTS.ana}点）`,       p=>p.ana, 'cond');
    run(`  ${L_ALL}`, p=>p.all, 'cond');
    console.log('  ─ 波乱の取り方② 素の確率順で本命以外を取る ─');
    run(`  波乱だけ（${PTS.ana}点）`,       p=>p.ana, 'prob');
    run(`  ${L_ALL}`, p=>p.all, 'prob');
    /* 2つの取り方が同じ数字になったので、本当に同じ買い目なのかを数えて確かめる。
       同じに見えて実はモードが渡っていない、という間違いを防ぐため。 */
    {
      let diff=0, bothHit=0, onlyCond=0, onlyProb=0;
      for(const x of done){
        const a=plan(x,'cond').ana, b=plan(x,'prob').ana;
        if(JSON.stringify(a)!==JSON.stringify(b)) diff++;
        const ha=a.includes(x.R.result), hb=b.includes(x.R.result);
        if(ha&&hb) bothHit++; else if(ha) onlyCond++; else if(hb) onlyProb++;
      }
      console.log(`  ※ 2つの取り方で買い目が違ったのは ${diff}/${done.length}レース。`);
      console.log(`    的中の内訳 両方${bothHit}件 / ①だけ${onlyCond}件 / ②だけ${onlyProb}件。`);
    }
    console.log(`  ※ ${L_ANA}は本線と重ならない組だけを取っている（重複買いはしない）。`);
    console.log('  ※ 波乱を足すと的中は増えるが、増えた分の払戻が投資に追いついていない。');
    console.log('    足すかどうかは「当たる回数を増やしたいか」と「回収率を守りたいか」の選択。');
  }

  /* 1着を当てたのに外すとき、正解は何番目にあるのか
     ==================================================================
     2026-10-26 福岡1R。モデルは1号艇を89.4%と見て、実際に1号艇が勝った。
     なのに本線10点は外れ。正解 1-6-5 はモデルの14番目だった。
     19点まで買っていれば ¥3,610（17番人気）が取れていた。

     これは今までずっと出ている形で、本人も「1着は当たるが並びで外す」と
     言っている。では『1着が当たった回だけ』に限ると、正解はどこにあるのか。
     そこが11〜19番に集中しているなら、点数の増やし方に意味が出てくる。
     散らばっているだけなら、増やしても投資が増えるだけ。 */
  {
    console.log('\n=== 1着を当てた回、正解は何番目にあったか ===');
    const done = base.map((r,i)=>({r, R:RACES[i]})).filter(x=>x.R && x.R.pay!=null);
    const headHit = done.filter(x=>x.r.head === String(x.R.result).split('-')[0]);
    const headMiss = done.filter(x=>x.r.head !== String(x.R.result).split('-')[0]);
    const dist = set => {
      const b = {'1-10':0, '11-19':0, '20-30':0, '31以降':0};
      for(const x of set){ const k=x.r.rank;
        if(k<=10) b['1-10']++; else if(k<=19) b['11-19']++; else if(k<=30) b['20-30']++; else b['31以降']++; }
      return b;
    };
    const row = (label, set) => {
      if(!set.length){ console.log(`  ${label.padEnd(26)} 0件`); return; }
      const b = dist(set);
      console.log(`  ${label.padEnd(26)} ${String(set.length).padStart(3)}件  `+
        Object.entries(b).map(([k,v])=>`${k} ${String(v).padStart(2)}件(${String(Math.round(v/set.length*100)).padStart(2)}%)`).join('  '));
    };
    row('1着を当てた回', headHit);
    row('1着を外した回', headMiss);

    /* 1着が当たった回だけに限って、点数ごとの回収率を見る。
       「1着が当たるレースでは点数を増やす価値があるか」の答えになる。
       ただし1着が当たるかどうかは、買ったあとにしか分からない。
       なので『1着の確率が高いレースだけ』でも同じことを見る。 */
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p}));
    const curve = (label, set) => {
      if(set.length < 5){ console.log(`  ${label}: ${set.length}件しかないので出さない`); return; }
      console.log(`  ${label}（${set.length}レース）`);
      for(const n of [10, 12, 15, 19, 24]){
        let inv=0, pays=[];
        for(const x of set){
          const list = toC(x.r).sort((a,b)=>b.p-a.p).slice(0,n).map(c=>String(c.combo));
          inv += n*100;
          if(list.includes(x.R.result)) pays.push(x.R.pay);
        }
        const back=pays.reduce((a,c)=>a+c,0);
        const cut = pays.length ? back-Math.max(...pays) : 0;
        console.log(`    ${String(n).padStart(2)}点  回収率${String(Math.round(back/inv*100)).padStart(4)}%  `+
          `最大1件除くと${String(Math.round(cut/inv*100)).padStart(4)}%  的中${pays.length}/${set.length}`);
      }
    };
    curve('1着を当てた回だけ（買ったあとにしか分からない）', headHit);
    const favHigh = done.filter(x=>{
      const p1 = Object.entries(x.r.probOf).filter(([k])=>k[0]===x.r.head).reduce((t,[,v])=>t+v,0);
      return p1 >= 0.60;
    });
    curve('モデルの1着確率が60%以上のレース（買う前に分かる）', favHigh);
    console.log('  ※ 上は後知恵なので参考。下が実際に使える条件。');
  }
  /* 優勝戦・準優勝戦・特選は、ふつうのレースと違うのか
     ==================================================================
     2026-10-25、若松11Rが優勝戦なので調べた。
     番組名で分けるのは乱暴だが、名前はそのまま記録に入っているので使える。
     「優勝戦・準優・特選・選抜」をひとまとめにして、残りと比べる。

     上位メンバーが揃うぶん力が接近し、1号艇が絶対ではなくなる——という
     よく言われる話が、手元の記録でも出るかどうか。 */
  {
    console.log('\n=== 優勝戦・準優・特選は、ふつうのレースと違うのか ===');
    const isBig = n => /優勝戦|準優|特選|選抜/.test(n);
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p}));
    const all = base.map((r,i)=>({r, R:RACES[i]})).filter(x=>x.R && x.R.pay!=null);
    const row = (label, set) => {
      if(!set.length){ console.log(`  ${label.padEnd(20)} 0件`); return; }
      const lane1 = set.filter(x=>String(x.R.result)[0]==='1').length;
      const big   = set.filter(x=>x.R.pay>=10000).length;
      const ranks = set.map(x=>x.r.rank);
      const avg   = ranks.reduce((a,c)=>a+c,0)/ranks.length;
      let inv=0, pays=[];
      for(const x of set){
        const pl = WIN.buyPlan(toC(x.r));
        inv += pl.main.length*100;
        if(pl.main.includes(x.R.result)) pays.push(x.R.pay);
      }
      const back = pays.reduce((a,c)=>a+c,0);
      const cut  = pays.length ? back-Math.max(...pays) : 0;
      console.log(`  ${label.padEnd(20)} ${String(set.length).padStart(3)}件  `+
        `1号艇1着 ${String(Math.round(lane1/set.length*100)).padStart(3)}%  `+
        `高配当 ${String(Math.round(big/set.length*100)).padStart(3)}%  `+
        `正解の順位 平均${avg.toFixed(1).padStart(5)}  `+
        `${L_MAIN} ${String(Math.round(back/inv*100)).padStart(4)}%`+
        `（最大1件除くと${String(Math.round(cut/inv*100)).padStart(4)}%）  `+
        `的中${pays.length}/${set.length}`);
    };
    row('ふつうのレース',      all.filter(x=>!isBig(x.R.name)));
    row('優勝戦・準優・特選', all.filter(x=>isBig(x.R.name)));
    console.log('  ※ 件数が少ないので、ここの数字で買い方を決めないこと。');
    console.log('    言えるのは「1号艇が絶対ではなくなる傾向が、手元でも同じ向きに出ている」まで。');
  }
  /* 当たっても負けるレース（ガチガチのとき本線買いは成立しない）
     ==================================================================
     2026-10-25 若松8R を見て本人が「ガチガチだね」と言った。そのとおりで、
     至極の一点 1-2-3 がそのまま当たったのに払戻は ¥320。
     当時は本線10点＝¥1,000だったので、当たっても -¥680 だった。
     （点数は BUY_POINTS で変わる。下の計算は pl.main.length から出しているので
      書き写した数字ではない。本線が6点なら境目は6倍、10点なら10倍になる）
     7R も同じで、至極の一点 1-3-2 が当たって ¥490（-¥510）。

     つまり買う前に分かることがある。
     本線の中に、オッズが「本線の点数」倍を下回る組がどれだけあるか。
     正解がそこに入ると、当たっても投資額を下回る。
     これは予想の当たり外れとは別の、買い方の問題。

     ここでは、それが実際にどれだけ起きているかを数える。 */
  {
    console.log('\n=== 当たっても負けたレース（ガチガチ） ===');
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p}));
    const done = base.map((r,i)=>({r, R:RACES[i]})).filter(x=>x.R && x.R.pay!=null && ODDS[x.R.name]);
    let hit=0, lost=0, lostYen=0, wonYen=0;
    const rows=[];
    for(const x of done){
      const pl = WIN.buyPlan(toC(x.r));
      if(!pl.main.includes(x.R.result)) continue;
      hit++;
      const cost = pl.main.length*100;
      if(x.R.pay < cost){ lost++; lostYen += cost - x.R.pay;
        rows.push({name:x.R.name, res:x.R.result, pay:x.R.pay, diff:cost-x.R.pay}); }
      else wonYen += x.R.pay - cost;
    }
    console.log(`  ${L_MAIN}が当たったのは ${hit}/${done.length}レース。`);
    console.log(`  そのうち、当たったのに赤字だったのは ${lost}レース（${Math.round(lost/hit*100)}%）。`);
    console.log(`  当たって負けた分の合計 -¥${lostYen.toLocaleString()} ／ 当たって勝った分 +¥${wonYen.toLocaleString()}`);
    rows.sort((a,b)=>b.diff-a.diff);
    console.log('  当たったのに負けた額の大きい順');
    for(const r of rows.slice(0,8))
      console.log(`    -¥${String(r.diff).padStart(4)}  ${r.res}  払戻¥${String(r.pay).padStart(5)}  ${r.name}`);

    /* 買う前に分かるか。本線のオッズを見れば分かる。 */
    console.log('');
    console.log(`  ${L_MAIN}のうち「当たっても¥${(PTS.main*100).toLocaleString()}に届かない組」が何点あるか`);
    const buckets = {};
    for(const x of done){
      const pl = WIN.buyPlan(toC(x.r));
      const o = ODDS[x.R.name];
      const cheap = pl.main.filter(k=>o[k]!=null && o[k]*100 < pl.main.length*100).length;
      buckets[cheap] = (buckets[cheap]||0) + 1;
    }
    for(const k of Object.keys(buckets).map(Number).sort((a,b)=>a-b))
      console.log(`    ${String(k).padStart(2)}点が${PTS.main}倍未満  ${buckets[k]}レース`);
    /* では「安い組が多いレースは買わない」としたら、通算は良くなるのか。
       当たって負けた合計は -¥4,270、当たって勝った合計は +¥44,650 なので、
       見送りが勝ちも一緒に切ってしまうなら意味が無い。実際に数える。 */
    console.log('');
    console.log(`  「${PTS.main}倍未満がN点以上なら買わない」としたら`);
    for(const cut of [1,2,3,4]){
      let inv=0, back=0, hits=0, skipped=0;
      for(const x of done){
        const pl = WIN.buyPlan(toC(x.r));
        const o = ODDS[x.R.name];
        const cheap = pl.main.filter(k=>o[k]!=null && o[k]*100 < pl.main.length*100).length;
        if(cheap >= cut){ skipped++; continue; }
        inv += pl.main.length*100;
        if(pl.main.includes(x.R.result)){ back += x.R.pay; hits++; }
      }
      const n = done.length - skipped;
      console.log(`    ${cut}点以上で見送り  買うのは${String(n).padStart(2)}/${done.length}レース  `+
        `回収率${String(inv?Math.round(back/inv*100):0).padStart(4)}%  的中${hits}/${n}`);
    }
    {
      let inv=0, back=0, hits=0;
      for(const x of done){
        const pl = WIN.buyPlan(toC(x.r));
        inv += pl.main.length*100;
        if(pl.main.includes(x.R.result)){ back += x.R.pay; hits++; }
      }
      console.log(`    （見送らない）      買うのは${done.length}/${done.length}レース  `+
        `回収率${String(Math.round(back/inv*100)).padStart(4)}%  的中${hits}/${done.length}`);
    }
    console.log('    ※ 見送ると当たりも一緒に減る。回収率が上がるかどうかで判断すること。');

    /* 【判定・2026-10-25に先に書いた】ガチガチのレースを見送るか
       ==============================================================
       上の表を見てから書いているので、いまあるレースでは判定しない。
       「2点以上で見送り」が160%といちばん高いが、買うのは27レースで的中8件。
       数レースの高配当が作った数字の可能性が高い。

       判定⑦ 本線10点のうちオッズ10倍未満が2点以上なら、そのレースは買わない
         これから足すレースが30件たまった時点で、その30件だけを見る。
           ・見送った場合の回収率が、見送らない場合より高い
           ・いちばん大きい払戻の1件を除いても、やはり高い
         両方を満たしたら採る。満たさなければ採らない。あとから緩めない。

       オッズは締切時オッズで判定する。予想の時点では締切前の値しか無いので、
       実際に使うときは「見送るかどうかの判断も当てにならない」ことに注意する。 */
    {
      const PREREG_CHALK_NAMES = new Set([
        '若松12R 一般特選(10/23)',
        '若松11R 予選特選(10/23)',
        '尼崎4R 予選(10/23)',
        '尼崎2R 予選(10/23)',
        '平和島4R 予選(10/23)',
        '若松9R 予選(10/23)',
        '唐津6R 予選(10/21)',
        '唐津5R 予選(10/21)',
        '唐津4R 予選(10/21)',
        '唐津3R 予選(10/21)',
        '唐津2R 予選(10/21)',
        '唐津1R 予選(10/21)',
        '唐津12R 予選(10/20)',
        '唐津11R 予選(10/20)',
        '唐津10R 予選(10/20)',
        '唐津9R 予選(10/20)',
        '唐津8R 予選(10/20)',
        '唐津6R 予選(10/20)',
        '唐津7R 予選(10/20)',
        '唐津4R 予選(10/20)',
        '唐津5R 予選(10/20)',
        '唐津3R 予選(10/20)',
        '唐津2R 予選(10/20)',
        '唐津1R 予選(10/20)',
        '大村12R 発祥地選抜',
        '若松11R 準優勝戦',
        '若松10R 準優勝戦',
        '桐生8R 女子',
        '桐生9R 男子',
        '桐生12R 特選',
        '徳山1R 一般',
        '徳山2R 特選',
        '徳山3R 特賞',
        '徳山4R 予選',
        '徳山5R 予選',
        '徳山6R 予選',
        '三国1R 一般',
        '三国3R 一般',
        '三国5R 一般',
        '三国6R 一般',
        '三国7R 一般',
        '三国8R 一般',
        '三国9R 一般',
        '三国10R 準優勝戦',
        '三国11R 準優勝戦',
        '三国12R 準優勝戦',
        '下関1R 予選',
        '徳山1R 朝トク予選',
        '下関2R 予選',
        '徳山2R 狙いトク特選',
        '徳山3R 決めトク特賞',
        '徳山4R ガチトク予選',
        '徳山5R 予選 4日目',
        '下関10R 予選特賞',
        '下関11R 予選特選',
        '若松11R 準優勝戦(10/24)',
        '若松12R 一般(10/24)',
        '若松1R 一般戦(10/24)',
        '若松2R 一般戦(10/24)',
        '若松3R 一般戦(10/24)',
        '若松4R 一般戦(10/24)',
        '若松5R 進入固定戦隊(10/24)',
        '若松6R 一般戦(10/24)',
        '若松7R 一般戦(10/24)',
        '若松8R エイトビート(10/24)',
        '若松9R 準優勝戦(10/24)',
        '若松10R 準優勝戦(10/24)',
        '三国3R (10/25)',
        '多摩川8R 予選(10/25)',
        '若松5R 進入固定戦隊(10/25)',
        '若松6R 一般戦(10/25)',
        '若松7R 一般戦(10/25)',
      ]);
      const fwd = done.filter(x=>!PREREG_CHALK_NAMES.has(x.R.name));
      console.log('');
      console.log('  【判定・2026-10-25に先に書いた】判定⑦ ガチガチのレースを見送るか');
      const need = 30;
      if(fwd.length < need){
        console.log(`    いま ${fwd.length}/${need} 件。たまったら判定する。`);
      } else {
        const use = fwd.slice(0, need);
        /* 判定⑦は 2026-10-25 に「本線10点のうち10倍未満が2点以上」と書いて凍結した。
           そのあと 2026-10-29 に買う点数を 本線6点＋波乱4点 に変えたが、
           ここで BUY_POINTS を使うと、凍結した条件の意味そのものが変わる
           （6点で6倍未満を数えることになり、書いた条件とは別の判定になる）。
           事前登録は「結果を見てから条件を動かさない」ためにあるので、
           判定⑦だけは書いた日の10点・10倍に固定する。
           いまの買い方での同じ検査は、上の「当たっても負けたレース」の節が
           BUY_POINTS に追従して出している。 */
        const PREREG7_MAIN = 10;
        const run = skip => {
          const pays=[]; let inv=0;
          for(const x of use){
            const pl = WIN.buyPlan(toC(x.r), {main:PREREG7_MAIN});
            const o = ODDS[x.R.name];
            const cheap = pl.main.filter(k=>o[k]!=null && o[k]*100 < PREREG7_MAIN*100).length;
            if(skip && cheap >= 2) continue;
            inv += pl.main.length*100;
            if(pl.main.includes(x.R.result)) pays.push(x.R.pay);
          }
          const back = pays.reduce((a,c)=>a+c,0);
          const cut  = pays.length ? back-Math.max(...pays) : 0;
          return {pct: inv?back/inv*100:0, cutPct: inv?cut/inv*100:0};
        };
        const A = run(true), B = run(false);
        const a = A.pct > B.pct, b2 = A.cutPct > B.cutPct;
        console.log(`    ${a?'○':'×'} 見送るほうが回収率が高い        ${Math.round(A.pct)}% / ${Math.round(B.pct)}%`);
        console.log(`    ${b2?'○':'×'} 最大1件を除いてもなお高い      ${Math.round(A.cutPct)}% / ${Math.round(B.cutPct)}%`);
        console.log(`    → ${a&&b2 ? '見送りを採る。' : '欠けたので捨てる。見送らない。'}`);
      }
      console.log(`    （凍結したのは今日時点の ${PREREG_CHALK_NAMES.size} レース）`);
    }
    console.log('  ※ ここが多いレースは、当たっても取り返せない。');
    console.log('    予想の良し悪しではなく、そのレースを買うかどうかの判断材料。');
  }
  /* 展示を待たずに出した買い目は、どれだけ違うか
     ==================================================================
     2026-10-25 に「買い目は締切10分前までに欲しい」と言われた。
     展示は実測で締切12〜17分前に出るので間に合うが、出が遅い日もある。
     そこで predict.js は、展示の前にも「暫定の買い目」を出すようにした。

     では暫定はどれだけ当てになるのか。ここで測る。
     やり方は単純で、記録済みのレースから展示の項目だけを消して採点し直し、
     買い目と回収率がどう変わるかを見る。消すのは
       展示タイム / 展示ST / 展示F / チルト / 進入
     の5つ。欠測は0点にせず、残りの項目で重みを割り直す作りなので止まらない。 */
  {
    console.log('\n=== 展示を待たずに出した買い目は、どれだけ違うか ===');
    const strip = RACES.map(R => ({...R, B: R.B.map(b => ({...b,
      exT:null, exST:null, exF:null, tilt:null, entry:null}))}));
    const noEx = runWith({}, null, {races: strip, detail:true});
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p}));
    const done = base.map((r,i)=>({r, R:RACES[i], n:noEx[i]})).filter(x=>x.R && x.R.pay!=null);

    const money = (label, pick, which) => {
      let inv=0, hits=[];
      for(const x of done){
        const pl = WIN.buyPlan(toC(which==='ex' ? x.r : x.n));
        const ks = [...new Set(pick(pl))];
        inv += ks.length*100;
        if(ks.includes(x.R.result)) hits.push(x.R.pay);
      }
      const back = hits.reduce((a,c)=>a+c,0);
      const cut  = hits.length ? back-Math.max(...hits) : 0;
      console.log(`  ${label.padEnd(24)} 回収率${String(Math.round(back/inv*100)).padStart(4)}%  `+
        `最大1件除くと${String(Math.round(cut/inv*100)).padStart(4)}%  的中${String(hits.length).padStart(2)}/${done.length}`);
    };
    console.log(`  対象 ${done.length}レース。展示ありが確定版、展示なしが暫定版。`);
    money(`確定（展示あり）${L_MAIN}`, p=>p.main, 'ex');
    money(`暫定（展示なし）${L_MAIN}`, p=>p.main, 'no');
    money(`確定（展示あり）${PTS_ALL}点`, p=>p.all,  'ex');
    money(`暫定（展示なし）${PTS_ALL}点`, p=>p.all,  'no');

    /* 買い目そのものがどれだけ入れ替わるか。回収率だけだと、
       たまたま同じ回数当たっただけなのか中身が同じなのか分からない。 */
    let same=0, overlap=0, headSame=0, rankDiff=[];
    for(const x of done){
      const A = WIN.buyPlan(toC(x.r));
      const B = WIN.buyPlan(toC(x.n));
      if(A.best===B.best) same++;
      overlap += A.main.filter(k=>B.main.includes(k)).length;
      if(String(A.best)[0]===String(B.best)[0]) headSame++;
      rankDiff.push(Math.abs(x.r.rank - x.n.rank));
    }
    console.log(`  至極の一点が同じ      ${same}/${done.length}レース`);
    console.log(`  1着に選ぶ艇が同じ     ${headSame}/${done.length}レース`);
    console.log(`  ${L_MAIN}の重なり      平均${(overlap/done.length).toFixed(1)}/${PTS.main}点`);
    const rd = rankDiff.reduce((a,c)=>a+c,0)/rankDiff.length;
    console.log(`  正解の順位の動き      平均${rd.toFixed(1)}番（120通り中）`);
    console.log('  ※ 暫定でも1着に選ぶ艇はあまり変わらない。変わるのは2着3着の並び。');
    console.log('    展示を待てるなら待つ。待てないなら暫定で買う根拠はここにある。');
  }
  /* 締切前のオッズは、締切時とどれだけ違うか
     ==================================================================
     2026-10-25 多摩川8R で間違えた。締切15分前のオッズで
       「市場は1号艇を35.5%と見ている。モデルは52.9%。+17.3pt 食い違う」
     と書いたが、締切時の市場は51.4%だった。食い違っていない。
     1号艇はF持ちで、市場がそれを嫌っている——という説明まで付けたが、
     そんな事実は無かった。早い時間のオッズは金額が薄いだけだった。

     予想のときは締切前の値しか無いので、それで出すしかない。
     まずいのは、それを「市場の見方」として読みに使ったこと。
     どれだけ当てにならないかを測って、毎回そこに書く。 */
  {
    console.log('\n=== 締切前のオッズは、締切時とどれだけ違うか ===');
    const share = (o, a) => {
      const t = Object.keys(o).reduce((s,k)=>s+0.75/o[k], 0);
      return Object.keys(o).filter(k=>k[0]===String(a)).reduce((s,k)=>s+0.75/o[k], 0) / t;
    };
    const names = Object.keys(ODDS_LIVE).filter(n=>ODDS[n]);
    if(!names.length){ console.log('  締切前と締切時の両方があるレースがまだ無い。'); }
    else {
      console.log('  レース                        締切何分前  1号艇の市場確率（前→締切時）  いちばん動いた艇');
      const all=[]; const lane1=[];
      for(const n of names){
        const L=ODDS_LIVE[n], a=L.odds, b=ODDS[n];
        if(Object.keys(a).length!==120 || Object.keys(b).length!==120) continue;
        let big=null;
        for(let l=1;l<=6;l++){
          const d=(share(b,l)-share(a,l))*100;
          all.push(Math.abs(d));
          if(l===1) lane1.push(d);
          if(!big || Math.abs(d)>Math.abs(big.d)) big={l, d};
        }
        const d1=(share(b,1)-share(a,1))*100;
        console.log(`  ${n.padEnd(26)} ${String(L.minutes).padStart(6)}分  `+
          `${(share(a,1)*100).toFixed(1)}% → ${(share(b,1)*100).toFixed(1)}%`+
          `（${d1>=0?'+':''}${d1.toFixed(1)}pt）  `+
          `${big.l}号艇 ${big.d>=0?'+':''}${big.d.toFixed(1)}pt`);
      }
      const avg = all.reduce((a,c)=>a+c,0)/all.length;
      console.log(`  ずれの平均 ${avg.toFixed(1)}pt / 最大 ${Math.max(...all).toFixed(1)}pt（${all.length}件の艇×レース）`);
      const up = lane1.filter(d=>d>0).length;
      console.log(`  1号艇は ${up}/${lane1.length} レースで締切に向けて上がっている`+
        `（平均 ${(lane1.reduce((a,c)=>a+c,0)/lane1.length>=0?'+':'')}`+
        `${(lane1.reduce((a,c)=>a+c,0)/lane1.length).toFixed(1)}pt）。`);
      console.log('  締切間際の金は本命に寄る。早い時間のオッズは1号艇を低く見せる。');
      console.log('  つまり「モデルのほうが1号艇を高く見ている」は、早く取っただけで作れてしまう。');
      console.log('  ※ まだ件数が少ない。何分前なら使えるかの線は引けていない。');
    }
  }
  /* 至極の一点だけ厚く賭けたら
     ==================================================================
     2026-10-24に本人から出た買い方。至極を500〜1000円、ほかは100円。

     結論は算数で先に分かる。至極の一点だけを買ったときの回収率が100%を
     下回っているなら、そこに金を寄せるほど全体の回収率はその値に引っ張られる。
     ただし「どれくらい下がるか」は実際に計算しないと分からないので、出す。

     金額ごとに投資も払戻も変わるので、点数ではなく円で並べる。 */
  {
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p}));
    const done = base.map((r,i)=>({r, R:RACES[i]})).filter(x=>x.R && x.R.pay!=null);

    console.log('\n=== 至極の一点だけ厚く賭けたら ===');
    console.log(`  対象 ${done.length}レース。至極以外はすべて100円。`);

    /* 払戻は「100円賭けたときの金額」なので、賭け金が X 円なら X/100 倍になる。 */
    const run = (label, topYen, use) => {
      let inv=0, back=0, hits=0, topHits=0;
      for(const x of done){
        const pl = WIN.buyPlan(toC(x.r));
        const ks = [...new Set(use(pl))];
        for(const k of ks) inv += (k===pl.best ? topYen : 100);
        if(ks.includes(x.R.result)){
          hits++;
          const yen = (x.R.result===pl.best ? topYen : 100);
          if(x.R.result===pl.best) topHits++;
          back += x.R.pay * (yen/100);
        }
      }
      console.log(`  ${label.padEnd(30)} 投資¥${String(inv).padStart(7)}  `+
        `払戻¥${String(Math.round(back)).padStart(7)}  `+
        `収支${(back-inv>=0?'+':'-')}¥${Math.abs(Math.round(back-inv)).toLocaleString().padStart(7)}  `+
        `回収率${String(Math.round(back/inv*100)).padStart(4)}%  的中${hits}（うち至極${topHits}）`);
    };

    console.log(`  ── ${L_MAIN}だけ ──`);
    for(const y of [100,500,1000]) run(`至極¥${y} ＋ 残り${PTS.main-1}点¥100`, y, p=>p.main);
    console.log(`  ── ${L_MAIN}＋${L_ANA}（${PTS_ALL}点）──`);
    for(const y of [100,500,1000]) run(`至極¥${y} ＋ 残り${PTS_ALL-1}点¥100`, y, p=>p.all);

    /* なぜ下がるのかを、数字で示しておく。 */
    {
      let n=0, back=0;
      for(const x of done){
        const pl = WIN.buyPlan(toC(x.r));
        if(x.R.result===pl.best){ n++; back += x.R.pay; }
      }
      const pct = back/(done.length*100)*100;
      console.log(`  至極の一点だけを100円で買ったときの回収率は ${Math.round(pct)}%`+
                  `（${n}/${done.length}レース、払戻合計¥${back.toLocaleString()}）。`);
      console.log('  100%を下回っているので、ここに金を寄せるほど全体はこの値に近づく。');
      console.log('  至極を厚くするのが有利になるのは、至極だけの回収率が100%を超えてから。');
      console.log(`  ※ 的中${n}件だけの数字なので、1件の高配当で簡単にひっくり返る。`);
      console.log('    「いまは下がる」であって「ずっと下がる」ではない。');
    }
  }
  /* 穴（高配当）は獲りにいけるのか
     ==================================================================
     きっかけは 2026-10-24 若松12R。2-4-5 ¥95,310（93番人気）を取り逃がした。
     「こういうのを穴予想で取りたい」という話になったので、まず測る。

     既にある波乱ブロックは回収率50%で負けている。足せば取れるものではない。
     なので順序を変える。「どう買うか」の前に「荒れるレースを事前に見分けられるか」。
     見分けられないなら、穴は広く買うしかなく、広く買うと回収率は下がる（30点で65%）。

     候補の指標は、すべて予想の時点で手に入るものだけで作る。
     結果を見てから指標を足さないこと。足したくなったら、それは後知恵。 */
  {
    const toC = r => Object.entries(r.probOf).map(([combo,p])=>({combo,p})).sort((a,b)=>b.p-a.p);
    const done = base.map((r,i)=>({r, R:RACES[i]})).filter(x=>x.R && x.R.pay!=null);
    const BIG = 10000;   /* 高配当の線。ここを動かすと結論も動くので、先に決めて固定する。 */

    console.log('\n=== 穴（高配当）は獲りにいけるのか ===');
    console.log(`  高配当 = 払戻 ¥${BIG.toLocaleString()} 以上。対象 ${done.length}レース。`);

    const big = done.filter(x=>x.R.pay>=BIG);
    console.log(`\n  高配当は ${big.length}/${done.length} レース（${(big.length/done.length*100).toFixed(0)}%）。`);
    console.log('  モデルがその正解を何番目に置いていたか（120通り中）');
    big.sort((a,b)=>b.R.pay-a.R.pay).forEach(x=>{
      console.log(`    ¥${String(x.R.pay).padStart(6)}  ${x.R.result}  ${String(x.r.rank).padStart(3)}番目  ${x.R.name}`);
    });
    const inN = n => big.filter(x=>x.r.rank<=n).length;
    console.log(`  うち 10点以内 ${inN(10)}件 / 20点以内 ${inN(20)}件 / 30点以内 ${inN(30)}件 / 60点以内 ${inN(60)}件`);
    console.log('  ※ 高配当を「広く買って」取るには何点必要か、がここで分かる。');

    /* 指標。すべて「1号艇が弱い」の言い換えで、予想時点の値だけを使う。 */
    const lowest = (B, key) => {
      const v = B.map(b=>b[key]);
      if(v.some(x=>x==null)) return null;          /* 欠測があれば判定しない。推測しない。 */
      return v[0] === Math.min(...v);
    };
    const highest = (B, key) => {                   /* 展示タイムは小さいほど速い */
      const v = B.map(b=>b[key]);
      if(v.some(x=>x==null)) return null;
      return v[0] === Math.max(...v);
    };
    const IND = {
      'A 1号艇のモーターが最下位': x=>lowest(x.R.B,'mot'),
      'B 1号艇がB級':             x=>/^B/.test(x.R.B[0].g),
      'C 1号艇の展示タイムが最も遅い': x=>highest(x.R.B,'exT'),
      'D 1号艇の全国勝率が最下位':   x=>lowest(x.R.B,'nat'),
      'E モデルの1号艇1着確率<45%': x=>x.fav1 < 0.45,
      'F 展示進入が枠なりでない':    x=>{
        const e = x.R.B.map(b=>b.entry);
        if(e.some(v=>v==null)) return null;
        return e.filter((v,i)=>v!==i+1).length >= 2;
      },
    };
    for(const x of done){
      x.fav1 = Object.entries(x.r.probOf).filter(([k])=>k[0]==='1').reduce((t,[,p])=>t+p,0);
      x.won1 = x.R.result[0]==='1';
    }

    const buy = (x, n, skipFav) => {
      let c = toC(x.r).map(y=>String(y.combo));
      if(skipFav) c = c.filter(k=>k[0]!=='1');
      return c.slice(0,n);
    };
    const ret = (set, n, skipFav) => {
      let inv=0, back=0, hit=0;
      for(const x of set){ const ks=buy(x,n,skipFav); inv+=ks.length*100;
        if(ks.includes(x.R.result)){ back+=x.R.pay; hit++; } }
      return inv ? {pct:back/inv*100, hit, n:set.length, inv, back} : null;
    };

    console.log('\n  指標ごとの内訳（該当したレースだけを見る）');
    console.log('  指標                        該当  1号艇1着  高配当   10点(最大1件除く)  30点(除く)  1抜き20点(除く)');
    const base1 = ret(done,10), base3 = ret(done,30);
    /* 回収率は1件の高配当で簡単に跳ねる。最大の1件を除いた値を必ず並べる。
       これを見ずに「この指標は儲かる」と言わないこと。 */
    const retCut = (set, n, skipFav) => {
      const rows=[]; let inv=0;
      for(const x of set){ const ks=buy(x,n,skipFav); inv+=ks.length*100;
        if(ks.includes(x.R.result)) rows.push(x.R.pay); }
      if(!inv) return null;
      const back=rows.reduce((a,c)=>a+c,0);
      const cut = rows.length ? back-Math.max(...rows) : 0;
      return {pct:back/inv*100, cutPct:cut/inv*100, hit:rows.length};
    };
    const row = (label, set) => {
      if(!set.length){ console.log(`  ${label.padEnd(26)}   0件`); return; }
      const w1 = set.filter(x=>x.won1).length;
      const bg = set.filter(x=>x.R.pay>=BIG).length;
      const r1 = retCut(set,10), r3 = retCut(set,30), rx = retCut(set,20,true);
      console.log(`  ${label.padEnd(26)} ${String(set.length).padStart(3)}件  `+
        `${String(Math.round(w1/set.length*100)).padStart(5)}%  `+
        `${String(Math.round(bg/set.length*100)).padStart(4)}%  `+
        `${String(Math.round(r1.pct)).padStart(4)}%${String(Math.round(r1.cutPct)).padStart(5)}%  ${String(Math.round(r3.pct)).padStart(4)}%${String(Math.round(r3.cutPct)).padStart(5)}%  ${String(Math.round(rx.pct)).padStart(4)}%${String(Math.round(rx.cutPct)).padStart(5)}%`);
    };
    row('（全レース）', done);
    for(const [label, f] of Object.entries(IND)){
      const set = done.filter(x=>f(x)===true);
      const na  = done.filter(x=>f(x)===null).length;
      row(label + (na?` ※欠測${na}`:''), set);
    }
    console.log('');
    console.log('  指標の裏返し（該当しなかった側）。片側だけ見ると差があるように錯覚する。');
    for(const [label, f] of Object.entries(IND)){
      row('　↑の該当外 ' + label.slice(0,1), done.filter(x=>f(x)===false));
    }
    console.log('');
    console.log(`  ※ 全レースの基準は 10点${Math.round(base1.pct)}% / 30点${Math.round(base3.pct)}%。`);

    /* ここまでで分かったことを、そのまま書く。
       ・高配当そのものは予測できていない。どの指標でも高配当率は12%前後から動かない。
       ・一方「1号艇が飛ぶレース」は指標Eで 43% 対 76% に割れている。件数も28対29で足りている。
       つまり狙いどころは「高配当を当てにいく」ではなく「1号艇を外す場面を選ぶ」。 */
    console.log('\n  高配当レースの1着艇（偏っているか）');
    {
      const cnt={}; for(const x of big) cnt[x.R.result[0]]=(cnt[x.R.result[0]]||0)+1;
      console.log('    ' + [1,2,3,4,5,6].map(n=>`${n}号艇 ${cnt[n]||0}件`).join(' / '));
      const all={}; for(const x of done) all[x.R.result[0]]=(all[x.R.result[0]]||0)+1;
      console.log(`    （全${done.length}レースの1着）` + [1,2,3,4,5,6].map(n=>`${n}号艇 ${all[n]||0}件`).join(' / '));
    }

    console.log('\n  E（モデルの1号艇1着確率<45%）に当たったレースで、1号艇を1着から外して買ったら');
    {
      const setE = done.filter(x=>x.fav1<0.45);
      for(const n of [6,10,15,20,30,40]){
        const r = retCut(setE,n,true);
        console.log(`    ${String(n).padStart(2)}点  回収率${String(Math.round(r.pct)).padStart(4)}%  `+
          `最大1件除くと${String(Math.round(r.cutPct)).padStart(4)}%  的中${r.hit}/${setE.length}`);
      }
      console.log('    ※ どの点数でも100%前後まで。最大1件を除くと全部100%を割る。');
      console.log('      いまの段階では「買えば勝てる」とは言えない。');
    }

    console.log('\n  E と F を重ねたら（件数が落ちるので参考値）');
    {
      const f = IND['F 展示進入が枠なりでない'];
      const both = done.filter(x=>x.fav1<0.45 && f(x)===true);
      const w1 = both.filter(x=>x.won1).length;
      console.log(`    該当 ${both.length}件  1号艇1着 ${both.length?Math.round(w1/both.length*100):0}%`);
      if(both.length){
        const r = retCut(both,20,true);
        console.log(`    1号艇抜き20点  回収率${Math.round(r.pct)}%  最大1件除くと${Math.round(r.cutPct)}%  的中${r.hit}/${both.length}`);
      }
      console.log('    ※ 10件未満なので、ここの数字で方針を決めないこと。');
    }


    /* 【判定・2026-10-24に先に書いた】穴の狙い方を採るか
       ==================================================================
       上の表を見てから書いているので、いまある57レースでは判定しない。
       PREREG_UPSET_NAMES に今日時点の57レース名を凍結し、
       これから足すレースだけで判定する。条件はここで決めて、あとから緩めない。

       判定⑤ E条件（モデルの1号艇1着確率<45%）のレースで、1号艇を1着から外した上位10点
         これから足すレースのうちEに該当したものが20件たまった時点で、その20件だけを見る。
           ・回収率が100%以上
           ・いちばん大きい払戻の1件を除いても100%以上
         両方満たせば採る。満たさなければ採らない。

       判定⑥ F条件（展示進入が枠なりでない）のレースで、1号艇を1着から外した上位20点
         同じく、これから足すFの該当レースが12件たまった時点で、同じ2条件で判定する。
         いまの8件では 1号艇1着13%（全体66%）と差が大きいが、件数が足りない。 */
    {
      const PREREG_UPSET_NAMES = new Set([
      /* 2026-10-24に追加した若松1R〜10R。判定の対象には入れない。
         理由：同じ日・同じ水面の11R・12Rを先に見て、そこから判定⑤⑥を書いた。
         同じ日の残りは、天候も水面も出走選手も重なっていて、独立した前向きの
         材料ではない。これを判定に使うと、自分で見た日で自分の仮説を採点する
         ことになる。だから凍結側に入れる。
         （判定④については、これらを入れれば一般級の件数は一気に増えるが、
           同じ理由で入れない。件数を早く揃えることより、独立性のほうが大事。） */
      '若松1R 一般戦(10/24)',
      '若松2R 一般戦(10/24)',
      '若松3R 一般戦(10/24)',
      '若松4R 一般戦(10/24)',
      '若松5R 進入固定戦隊(10/24)',
      '若松6R 一般戦(10/24)',
      '若松7R 一般戦(10/24)',
      '若松8R エイトビート(10/24)',
      '若松9R 準優勝戦(10/24)',
      '若松10R 準優勝戦(10/24)',
      '若松12R 一般特選(10/23)',
      '若松11R 予選特選(10/23)',
      '尼崎4R 予選(10/23)',
      '尼崎2R 予選(10/23)',
      '平和島4R 予選(10/23)',
      '若松9R 予選(10/23)',
      '唐津6R 予選(10/21)',
      '唐津5R 予選(10/21)',
      '唐津4R 予選(10/21)',
      '唐津3R 予選(10/21)',
      '唐津2R 予選(10/21)',
      '唐津1R 予選(10/21)',
      '唐津12R 予選(10/20)',
      '唐津11R 予選(10/20)',
      '唐津10R 予選(10/20)',
      '唐津9R 予選(10/20)',
      '唐津8R 予選(10/20)',
      '唐津6R 予選(10/20)',
      '唐津7R 予選(10/20)',
      '唐津4R 予選(10/20)',
      '唐津5R 予選(10/20)',
      '唐津3R 予選(10/20)',
      '唐津2R 予選(10/20)',
      '唐津1R 予選(10/20)',
      '大村12R 発祥地選抜',
      '若松11R 準優勝戦',
      '若松10R 準優勝戦',
      '桐生8R 女子',
      '桐生9R 男子',
      '桐生12R 特選',
      '徳山1R 一般',
      '徳山2R 特選',
      '徳山3R 特賞',
      '徳山4R 予選',
      '徳山5R 予選',
      '徳山6R 予選',
      '三国1R 一般',
      '三国3R 一般',
      '三国5R 一般',
      '三国6R 一般',
      '三国7R 一般',
      '三国8R 一般',
      '三国9R 一般',
      '三国10R 準優勝戦',
      '三国11R 準優勝戦',
      '三国12R 準優勝戦',
      '下関1R 予選',
      '徳山1R 朝トク予選',
      '下関2R 予選',
      '徳山2R 狙いトク特選',
      '徳山3R 決めトク特賞',
      '徳山4R ガチトク予選',
      '徳山5R 予選 4日目',
      '下関10R 予選特賞',
      '下関11R 予選特選',
      '若松11R 準優勝戦(10/24)',
      '若松12R 一般(10/24)',
      ]);
      const fwd = done.filter(x=>!PREREG_UPSET_NAMES.has(x.R.name));
      const fIdx = IND['F 展示進入が枠なりでない'];
      const judge = (label, set, need, n) => {
        console.log(`\n  【判定・2026-10-24に先に書いた】${label}`);
        if(set.length < need){
          console.log(`    いま ${set.length}/${need} 件。たまったら判定する。`);
          if(set.length){
            const r = retCut(set,n,true);
            console.log(`    （参考 回収率${Math.round(r.pct)}% / 最大1件除くと${Math.round(r.cutPct)}%`+
                        ` / 的中${r.hit}件。件数が足りないので根拠にしない）`);
          }
          return;
        }
        const use = set.slice(0, need);           /* 先に20件そろった分だけで判定する */
        const r = retCut(use, n, true);
        const a = r.pct >= 100, b = r.cutPct >= 100;
        console.log(`    ${a?'○':'×'} 回収率100%以上        ${Math.round(r.pct)}%`);
        console.log(`    ${b?'○':'×'} 最大1件を除いても100%以上 ${Math.round(r.cutPct)}%`);
        console.log(`    → ${a&&b ? 'この買い方を採る。' : '欠けたので捨てる。採らない。'}`);
      };
      judge('判定⑤ E条件のレースで1号艇抜き10点を買うか',
            fwd.filter(x=>x.fav1<0.45), 20, 10);
      judge('判定⑥ F条件（進入変更）のレースで1号艇抜き20点を買うか',
            fwd.filter(x=>fIdx(x)===true), 12, 20);
      console.log(`\n  （凍結したのは今日時点の ${PREREG_UPSET_NAMES.size} レース。`+
                  `これ以降に足した ${fwd.length} レースだけで判定する）`);
    }

    console.log('  ※ 該当件数が10件を切る行は、偶然の幅のほうが大きい。数字を信じないこと。');
  }

  /* 1着が決まったあと、2着は誰か（モデルは「どう勝ったか」を見ていない）
     ==================================================================
     きっかけは 2026-10-22 若松10R。本人が 4-全-5 で 4-3-5 を取ったときの説明。
       「3が凹んで4がいったら、5はついていける確率が高い。
         でも等級が低いから腕がまだない。前走や成績は悪くないから3着には残る」
     これは条件つきの読みで、モデルにはその考え方が無い。

     モデルの2着は Plackett-Luce で s_b/(total - s_a) と決まる。
     つまり「1着が誰か」で分母が変わるだけで、
     「その1着がどうやって勝ったか」はまったく見ていない。
     2号艇が1着ということは1号艇を飲んでいるはずだが、
     モデルはそれでも「2着は1号艇」と言う。

     ここで毎回測る。結果を見てから基準を変えないよう、判定を先に書く。 */
  {
    const own = runWith();
    const rows = [];
    for(let i=0;i<RACES.length;i++){
      const R = RACES[i]; if(!R.result) continue;
      const r = own[i]; if(!r || r.name !== R.name) continue;
      const [a,b] = R.result.split('-').map(Number);
      if(a === 1) continue;                      /* 1号艇が勝った回は対象外 */
      const cond = {}; let tot = 0;
      for(const [k,p] of Object.entries(r.probOf)){
        if(+k[0] !== a) continue;
        cond[+k[2]] = (cond[+k[2]]||0) + p; tot += p;
      }
      rows.push({ win:a, second:b, p1:(cond[1]||0)/tot, name:R.name });
    }
    console.log('\n=== 1号艇以外が1着のとき、1号艇は2着に残るか ===');
    if(!rows.length){ console.log('  対象レースがまだありません。'); }
    else{
      const show = (label, a) => {
        if(!a.length){ console.log(`  ${label} 0件`); return; }
        const hit = a.filter(x=>x.second===1).length;
        const exp = a.reduce((t,x)=>t+x.p1, 0);
        console.log(`  ${label}  ${a.length}件  実際 ${hit}回  モデルの予想 ${exp.toFixed(1)}回  `+
                    `差 ${(hit-exp>=0?'+':'')}${(hit-exp).toFixed(1)}`);
      };
      show('全体                 ', rows);
      show('2号艇が1着（内を飲む）', rows.filter(x=>x.win===2));
      show('3号艇が1着            ', rows.filter(x=>x.win===3));
      show('4号艇以上が1着        ', rows.filter(x=>x.win>=4));
      console.log('  2着は1着より外か内か');
      for(const wv of [2,3,4,5,6]){
        const a = rows.filter(x=>x.win===wv); if(!a.length) continue;
        console.log(`    ${wv}号艇が1着: 外${a.filter(x=>x.second>wv).length}回 / `+
          `内${a.filter(x=>x.second<wv).length}回   2着の枠 → ${a.map(x=>x.second).join(',')}`);
      }
      console.log('  理屈はこう。2号艇が1着なら1号艇を飲んでいるので1号艇は沈む。');
      console.log('  3号艇が1着なら差しが多いので1号艇は粘れる。');
      console.log('  モデルはこの区別をしていない。');

      /* 先に決めた判定（2026-10-22）。結果を見てから変えない。
         二項検定（片側）で、モデルの言う確率より実際が少ないかを見る。 */
      const g2 = rows.filter(x=>x.win===2);
      const hit2 = g2.filter(x=>x.second===1).length;
      const pbar = g2.length ? g2.reduce((t,x)=>t+x.p1,0)/g2.length : 0;
      const C = (n,k)=>{ let r=1; for(let i=0;i<k;i++) r=r*(n-i)/(i+1); return r; };
      let pv = 0;
      for(let x=0; x<=hit2; x++) pv += C(g2.length,x)*Math.pow(pbar,x)*Math.pow(1-pbar,g2.length-x);
      console.log('\n  【判定・2026-10-22に先に書いた】2着の条件つき補正を入れるか');
      console.log('    対象は「2号艇が1着になったレース」。20件たまった時点で判定する。');
      console.log(`    いま ${g2.length}/20 件  1号艇が2着 ${hit2}回 / モデルの平均予想 ${(pbar*100).toFixed(0)}%`);
      if(g2.length >= 20){
        console.log(`    二項検定（片側） p=${pv.toFixed(4)}  → ${pv<0.05?'0.05未満。補正を入れる。':'0.05以上。入れない。'}`);
      }else{
        console.log(`    （参考 p=${pv.toFixed(4)}。件数が足りないので根拠にしない）`);
      }
      console.log('    条件は「p<0.05」だけ。あとから緩めない。');
    }
  }

  base.forEach(x=>console.log(
    `  ${x.name.padEnd(12)} 結果 ${x.result}${x.pop?`(${x.pop}番人気)`:''} は ${String(x.rank).padStart(3)} 番目`+
    `   採点順 ${x.order.join(' ')}`));
  console.log('  '+line(summarize(base))+'\n');

  console.log('=== 実績の重みを下げ、展示の重みを上げた場合 ===');
  const grid=[];
  for(const shift of [0,0.02,0.04,0.06,0.08]){
    const patch={ national:0.11-shift*0.6, local:0.08-shift*0.4,
                  exST:0.07+shift*0.5, exTime:0.08+shift*0.5 };
    const s=summarize(runWith(patch));
    grid.push({shift,...s});
    console.log(`  実績${(0.19-shift).toFixed(2)} / 展示${(0.15+shift).toFixed(2)}   `+line(s));
  }
  const best=grid.reduce((a,c)=>c.avg<a.avg?c:a);
  console.log(`\n  平均が最小なのは shift=${best.shift}（実績${(0.19-best.shift).toFixed(2)} / 展示${(0.15+best.shift).toFixed(2)}）`);
  console.log('  ※ n が少ないうちは平均が1レースで大きく動く。採用は慎重に。\n');

  console.log('=== 勝率バンドの影響（重みは既定のまま） ===');
  [[3.0,8.0],[2.5,7.5],[2.0,7.5],[1.5,7.5],[2.0,8.0]].forEach(bd=>{
    console.log(`  勝率 ${bd[0].toFixed(1)}〜${bd[1].toFixed(1)}  `+line(summarize(runWith({}, {winRate:bd}))));
  });

  console.log('\n=== 買い方ごとの回収率（1レース1,200円で統一） ===');
  console.log('  ※ 件数が少ないうちは偶然の幅が大きい。傾向を見るだけで、これで買い方を決めない。');
  const PAID = base.filter(r=>r.pay);
  const stakeTable = [];
  /* 1点・2点は予算を使い切らない。点数を絞る側の目安として並べる。 */
  for(const n of [1,2]){
    let inv=0, ret=0, hits=0;
    for(const r of PAID){ inv += 100*n;
      if(r.rank<=n){ ret += r.pay; hits++; } }
    stakeTable.push({label:`${n}点 100円ずつ`, inv, ret, hits});
  }
  /* 均等買い */
  for(const n of [3,4,6,8,10,12,15]){
    const unit = Math.floor(1200/n/100)*100;
    if(unit<100) continue;
    let inv=0, ret=0, hits=0;
    for(const r of PAID){ inv += unit*n;
      if(r.rank<=n){ ret += r.pay/100*unit; hits++; } }
    stakeTable.push({label:`${n}点 均等 ${unit}円`, inv, ret, hits});
  }
  /* 確率に応じて傾ける（100円単位、最低100円） */
  for(const n of [6,8,12]){
    let inv=0, ret=0, hits=0;
    for(const r of PAID){
      const ps = r.probs.slice(0,n), sum = ps.reduce((a,c)=>a+c,0);
      let amt = ps.map(p=>Math.max(100, Math.round(1200*p/sum/100)*100));
      /* 合計が1200円を超えたら後ろから削る */
      let total = amt.reduce((a,c)=>a+c,0);
      for(let i=n-1;i>=0 && total>1200;i--){
        while(amt[i]>100 && total>1200){ amt[i]-=100; total-=100; }
      }
      inv += total;
      if(r.rank<=n){ ret += r.pay/100*amt[r.rank-1]; hits++; }
    }
    stakeTable.push({label:`${n}点 確率比例`, inv, ret, hits});
  }
  console.log('  買い方              投資      払戻      回収率   的中');
  for(const t of stakeTable){
    console.log(`  ${t.label.padEnd(18)}${String(t.inv).padStart(7)}円${String(Math.round(t.ret)).padStart(8)}円`+
      `${(t.ret/t.inv*100).toFixed(0).padStart(8)}%   ${t.hits}/${PAID.length}`);
  }
  /* 回収率だけを見ると必ず騙される。ここまでで2回それをやりかけた。
       15レース時点で「1点買い96%」→ 19レースで76%
       12レース時点で「期待値方式21%」→ 13レースで73%
     どちらも1〜2レースが数字を作っていた。
     だから100%を超えた買い方は、必ず中身を割って見る。 */
  const over = stakeTable.filter(t=>t.ret/t.inv >= 1.0);
  if(over.length){
    console.log('\n  100%を超えた買い方の中身（1〜2レースが作っていないか）');
    for(const t of over){
      const m = t.label.match(/^(\d+)点/);
      if(!m) continue;
      const n = Number(m[1]);
      const unit = Math.max(100, Math.floor(1200/n/100)*100);
      const rows = PAID.map(r=>({ name:r.name,
        d: (r.rank<=n ? r.pay/100*unit : 0) - unit*n }));
      const tot = rows.reduce((a,c)=>a+c.d,0);
      const top = [...rows].sort((a,b)=>b.d-a.d).slice(0,2);
      const topSum = top.reduce((a,c)=>a+c.d,0);
      const restInv = (rows.length-2)*unit*n;
      const restRet = restInv + (tot - topSum);
      console.log(`    ${t.label}`);
      console.log(`      いちばん効いた2レース: `+
        top.map(x=>`${x.name} ${x.d>=0?'+':''}${x.d.toLocaleString()}円`).join(' / '));
      console.log(`      その2つを除いた残り${rows.length-2}レースの回収率 `+
        `${(restRet/restInv*100).toFixed(0)}%`);
      let win=0; const N=20000;
      for(let i=0;i<N;i++){ let t2=0;
        for(let j=0;j<rows.length;j++) t2 += rows[Math.floor(Math.random()*rows.length)].d;
        if(t2>0) win++; }
      console.log(`      引き直してプラスになる割合 ${(win/N*100).toFixed(0)}%`+
        `（50%に近いほど、ただの運）`);
    }
    console.log('    → 残りの回収率が100%を大きく下回るなら、その買い方はまだ根拠にならない。');
  }

  console.log('\n  レース別の払戻（100円あたり）');
  PAID.forEach(r=>console.log(`    ${r.name.padEnd(12)} ${r.result}  ${String(r.pay).padStart(6)}円  `+
    `${String(r.pop||'?').padStart(2)}番人気  評価${String(r.rank).padStart(3)}番目`));

  console.log('\n=== 1着だけを見た場合の成績（3連単とは別に測る） ===');
  {
    let hit=0, n=0; const lines=[];
    for(const x of base){
      const top = Number(x.order[0].split('(')[0]);
      const win = Number(x.result.split('-')[0]);
      n++; if(top===win) hit++;
      lines.push(`  ${x.name.padEnd(12)} モデル1位 ${top}号艇 / 実際の1着 ${win}号艇  ${top===win?'○':'×'}`);
    }
    lines.forEach(l=>console.log(l));
    console.log(`\n  1着の的中 ${hit}/${n}（${(hit/n*100).toFixed(0)}%）`);
    console.log('  ※ 3連単で当てるより、ここが本当の実力。買い方を考えるときの土台になる。');
  }

  console.log('\n=== 券種を変えれば勝てるのか ===');
  {
    /* 3連単120通りの確率から、他の券種の確率を足し合わせて作る。
       払戻を記録してあるレースだけで比べる。 */
    const withPay = base.filter(x=>x.pays);
    if(withPay.length){
      const all = [];
      for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ if(b===a) continue;
        for(let c=1;c<=6;c++){ if(c===a||c===b) continue; all.push(`${a}-${b}-${c}`); } }
      const TYPES = [['tan','単勝',6],['ni','2連単',30],['nifuku','2連複',15],
                     ['sanfuku','3連複',20],['san','3連単',120]];
      const keyOf = (t,a,b,c)=>
        t==='tan' ? String(a)
        : t==='ni' ? `${a}-${b}`
        : t==='nifuku' ? [a,b].sort().join('=')
        : t==='sanfuku' ? [a,b,c].sort().join('=') : `${a}-${b}-${c}`;
      const ranks = {}; TYPES.forEach(([t])=>ranks[t]=[]);
      console.log('  結果がモデルの何番目だったか\n');
      console.log('  レース          単勝  2連単 2連複 3連複 3連単');
      for(const x of withPay){
        const [ra,rb,rc] = x.result.split('-').map(Number);
        const line = [];
        for(const [t] of TYPES){
          const m = {};
          all.forEach((k,i)=>{ const [a,b,c]=k.split('-').map(Number);
            const kk = keyOf(t,a,b,c); m[kk] = (m[kk]||0) + x.probs[i]; });
          const target = keyOf(t,ra,rb,rc);
          const rk = Object.keys(m).sort((p1,p2)=>m[p2]-m[p1]).indexOf(target)+1;
          ranks[t].push(rk); line.push(String(rk).padStart(4));
        }
        console.log(`  ${x.name.padEnd(12)} ${line.join('  ')}`);
      }
      console.log('\n  予算1,200円で上位N点を均等に買った場合の回収率');
      for(const [t,name,total] of TYPES){
        const out = [];
        for(const n of [1,2,3,4,6,8,12]){
          if(n > total) break;
          const unit = Math.floor(1200/n/100)*100; if(unit < 100) continue;
          let inv=0, ret=0, hit=0;
          withPay.forEach((x,i)=>{ inv += unit*n;
            if(ranks[t][i] <= n){ ret += (t==='san'?x.pay:x.pays[t])/100*unit; hit++; } });
          out.push(`${n}点 ${String(Math.round(ret/inv*100)).padStart(4)}%(${hit}/${withPay.length})`);
        }
        console.log(`  ${name.padEnd(6)} ${out.join('  ')}`);
      }
      console.log('\n  ※ 100%を超えている数字があっても、1レースの高配当が持っていることが多い。');
      console.log('     件数が少ないうちは、ここから券種を決めないこと。');
      console.log('     単勝が一度も100%を超えないのは、1着の予想が「常に1号艇」と同成績で、');
      console.log('     しかも単勝はいちばん効率よく値付けされているから。');
    }
  }

  console.log('\n=== モデルの確率 vs 市場の確率（回収率の核心） ===');
  console.log('  市場の推定確率 = 0.75 ÷ オッズ（3連単の控除率25%を戻した値）');
  console.log('  期待値 = モデルの確率 × オッズ。1.00を超える組だけが買う価値を持つ。\n');
  console.log('  レース          結果    配当   モデル  市場   期待値');
  let evSum = 0, evN = 0, mpSum = 0, mkSum = 0;
  const evGood = [], evBad = [];
  for(const x of base.filter(r=>r.pay)){
    const odds = x.pay/100, mp = x.probs[x.rank-1], market = 0.75/odds, ev = mp*odds;
    evSum += ev; evN++; mpSum += mp; mkSum += market;
    (ev >= 1 ? evGood : evBad).push(x);
    console.log(`  ${x.name.padEnd(12)} ${x.result}  ${String(x.pay).padStart(6)}円  `+
      `${(mp*100).toFixed(1).padStart(5)}%  ${(market*100).toFixed(1).padStart(5)}%  `+
      `${ev.toFixed(2).padStart(5)}  ${ev>=1?'★':''}`);
  }
  if(evN){
    const sum = a => a.reduce((s,x)=>s+x.pay,0);
    console.log(`\n  期待値1.00以上だった的中 ${evGood.length}件  払戻合計 ${sum(evGood).toLocaleString()}円`);
    console.log(`  期待値1.00未満だった的中 ${evBad.length}件  払戻合計 ${sum(evBad).toLocaleString()}円`);
    console.log(`\n  的中した組に付いていた確率の平均   モデル ${(mpSum/evN*100).toFixed(1)}%  /  市場 ${(mkSum/evN*100).toFixed(1)}%`);
    console.log('  この2つが近ければ、モデルの確率は市場と同じくらい校正されている。');
    console.log('  モデルが大きく低ければ自信不足、大きく高ければ自信過剰ということ。');
    console.log('\n  ※ 当たった組のオッズしか分からないので、これは「当たったレースだけ」の集計。');
    console.log('     買った全点での本当の回収率は、アプリのSTEP8に払戻を入れて');
    console.log('     「期待値ごとの回収率」の表で確かめること。');
  }

  console.log('\n=== 1着の当て方を点数化する（モデル vs 市場） ===');
  console.log('  「いちばん離れた艇が来たか」は1艇しか見ていない弱い物差し。');
  console.log('  6艇ぜんぶの確率を使って、実際に来た艇にどれだけ確率を置けていたかで測る。');
  console.log('  対数スコア = ln(来た艇に置いた確率)。0に近いほど良い。');
  console.log('  枠順の平年値（1号艇55%…）を第3の比較相手として並べる。\n');
  {
    const PRIOR = {1:.55,2:.14,3:.12,4:.11,5:.06,6:.02};
    const rows = [];
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const map = ODDS[R.name];
      if(!map || Object.keys(map).length !== 120) continue;
      const ks = Object.keys(map);
      const md = {}, mk = {};
      for(let a=1;a<=6;a++){
        md[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + (x.probOf[k]||0), 0);
        mk[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + 0.75/map[k], 0);
      }
      const nm = Object.values(md).reduce((a,c)=>a+c,0);
      const nk = Object.values(mk).reduce((a,c)=>a+c,0);
      const win = Number(R.result.split('-')[0]);
      rows.push({ name:R.name, win, pre: R.preClose || null,
                  m: md[win]/nm, k: mk[win]/nk, p: PRIOR[win],
                  top: Math.max(...Object.values(mk))/nk });
    }
    if(!rows.length){ console.log('  実オッズのあるレースがまだ無い'); }
    else {
      console.log('  レース          1着   モデル   市場    枠順のみ');
      rows.forEach(r=>console.log(`  ${r.name.padEnd(14)}${r.win}号艇  `+
        `${(r.m*100).toFixed(1).padStart(5)}%  ${(r.k*100).toFixed(1).padStart(5)}%  ${(r.p*100).toFixed(1).padStart(5)}%`));
      const ln = a => a.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0) / a.length;
      const lm = ln(rows.map(r=>r.m)), lk = ln(rows.map(r=>r.k)), lp = ln(rows.map(r=>r.p));
      console.log(`\n  対数スコア（0に近いほど良い）  モデル ${lm.toFixed(3)}  市場 ${lk.toFixed(3)}  枠順のみ ${lp.toFixed(3)}`);
      const better = rows.filter(r=>r.m > r.k).length;
      console.log(`  来た艇に市場より高い確率を置けた回数  ${better}/${rows.length}`);
      console.log(`  ${lm > lk ? 'いまのところモデルのほうが上。' : 'いまのところ市場のほうが上。'}`);

      /* 締切前のオッズは市場が未完成なので、市場に不利。除いた数字も出す。 */
      const fin = rows.filter(r=>!r.pre);
      if(fin.length && fin.length < rows.length){
        const lnf = a => a.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0) / a.length;
        console.log(`\n  締切時オッズだけの${fin.length}レースに絞ると  `+
          `モデル ${lnf(fin.map(r=>r.m)).toFixed(3)}  市場 ${lnf(fin.map(r=>r.k)).toFixed(3)}`);
        console.log(`  （締切前オッズの${rows.length-fin.length}レースを除いた。`+
                    `市場を正しく評価するため）`);
      }

      /* 合計だけ見ると「どの1レースが効いているか」が隠れる。
         1レースで大きく勝った回が全体をひっくり返していないかを必ず確かめる。 */
      const diff = rows.map(r=>({ name:r.name, d: Math.log(Math.max(r.m,1e-6)) - Math.log(Math.max(r.k,1e-6)) }));
      console.log('\n  レースごとの「モデル − 市場」（プラスならモデルの勝ち）');
      diff.forEach(x=>console.log(`    ${x.name.padEnd(16)}${x.d>=0?'+':''}${x.d.toFixed(3)}`));
      const tot = diff.reduce((t,x)=>t+x.d,0);
      const sortedByAbs = [...diff].sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
      const top2 = sortedByAbs.slice(0,2);
      const top2sum = top2.reduce((t,x)=>t+x.d,0);
      console.log(`\n    合計 ${tot>=0?'+':''}${tot.toFixed(3)}`);
      console.log(`    いちばん大きい2レース（${top2.map(x=>x.name).join(' / ')}）だけで `+
                  `${top2sum>=0?'+':''}${top2sum.toFixed(3)}`);
      console.log(`    その2つを除いた残り${diff.length-2}レースの合計 `+
                  `${tot-top2sum>=0?'+':''}${(tot-top2sum).toFixed(3)}`);
      if(Math.abs(top2sum) > Math.abs(tot)){
        console.log('    → **勝ち負けの向きが、2レースだけで決まっている。**');
        console.log('       残りを見ると逆の結論になる。合計を信じてはいけない。');
      }

      /* 引き直し（ブートストラップ）。50%に近いほど「どちらとも言えない」。 */
      let winCount = 0; const N = 20000;
      for(let i=0;i<N;i++){
        let t = 0;
        for(let j=0;j<diff.length;j++) t += diff[Math.floor(Math.random()*diff.length)].d;
        if(t > 0) winCount++;
      }
      const pct = winCount/N*100;
      console.log(`\n    同じ${diff.length}レースを重複ありで引き直すと、モデルが勝つ割合 ${pct.toFixed(0)}%`);
      console.log('    （50%に近いほど「どちらが上とも言えない」。95%を超えて初めて差と呼べる）');

      /* 市場がどれだけ強気だったかで分けてみる。
         いまのところ、モデルが勝っているのは市場が極端に強気だった回に偏っている。 */
      const byTop = rows.map((r,i)=>({ top:r.top, d:diff[i].d })).sort((a,b)=>a.top-b.top);
      const half = Math.floor(byTop.length/2);
      const mean = a => a.length ? a.reduce((t,x)=>t+x.d,0)/a.length : NaN;
      console.log('\n  市場の1番人気の確率で半分に分けると');
      console.log(`    市場が控えめな${half}レース（〜${(byTop[half-1].top*100).toFixed(0)}%）  平均 `+
                  `${mean(byTop.slice(0,half))>=0?'+':''}${mean(byTop.slice(0,half)).toFixed(3)}`);
      console.log(`    市場が強気な${byTop.length-half}レース（${(byTop[half].top*100).toFixed(0)}%〜）  平均 `+
                  `${mean(byTop.slice(half))>=0?'+':''}${mean(byTop.slice(half)).toFixed(3)}`);
      console.log('    仮説: 市場が極端に強気なとき、モデルは言い切らないぶん得をする。');
      console.log('    まだ仮説。件数を増やして同じ向きが続くかを見る。');
    }
  }

  console.log('\n=== モデルは枠ごとに確率を付けすぎ／付けなさすぎていないか ===');
  console.log('  1着の対数スコアで市場に負けているが、どこで負けているのかは別の話。');
  console.log('  枠ごとに「モデルが平均で何%と言ったか」と「実際に何%勝ったか」を並べる。');
  console.log('  オッズの有無に関係なく全レースが使えるので、いちばん件数が多い物差し。\n');
  {
    const n = base.length;
    const said = {1:0,2:0,3:0,4:0,5:0,6:0}, won = {1:0,2:0,3:0,4:0,5:0,6:0};
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const w = Number(R.result.split('-')[0]);
      won[w]++;
      for(let a=1;a<=6;a++)
        said[a] += Object.keys(x.probOf).filter(k=>k[0]===String(a))
                         .reduce((t,k)=>t + x.probOf[k], 0);
    }
    console.log('  枠   モデルの平均   実際に勝った   差');
    for(let a=1;a<=6;a++){
      const m = said[a]/n, r = won[a]/n, d = (m-r)*100;
      console.log(`  ${a}    ${(m*100).toFixed(1).padStart(6)}%   `+
        `${(r*100).toFixed(1).padStart(6)}% (${won[a]}/${n})   ${d>=0?'+':''}${d.toFixed(1)}pt`);
    }
    /* ここでの比較相手は「この17レースの実績」ではなく、競艇場の公表イン率。
       17レースの勝率はぶれが大きすぎて、真の値の代わりにならない。
       イン率は何千レースもの集計なので、そちらのほうがはるかに確かな物差し。 */
    const m1 = said[1]/n, r1 = won[1]/n;
    const rates = [...new Set(base.map(x=>{
      const R = RACES.find(r=>r.name===x.name);
      return (typeof VENUE_IN_RATE === 'object' && VENUE_IN_RATE[R.jcd]) || null;
    }).filter(Boolean))];
    const inRate = rates.length ? rates.reduce((a,c)=>a+c,0)/rates.length/100 : 0.55;
    var binomAtLeast = (k,nn,p)=>{ let t=0;
      const C=(nn,r)=>{ let v=1; for(let i=0;i<r;i++) v=v*(nn-i)/(i+1); return v; };
      for(let i=k;i<=nn;i++) t += C(nn,i)*Math.pow(p,i)*Math.pow(1-p,nn-i); return t; };
    const pAtLeast = binomAtLeast(won[1], n, inRate);
    console.log(`\n  1号艇: モデルの平均 ${(m1*100).toFixed(1)}%  /  `+
                `この${n}レースの実績 ${(r1*100).toFixed(1)}%  /  `+
                `競艇場の公表イン率 ${(inRate*100).toFixed(0)}%`);
    console.log(`  実績${won[1]}/${n}が公表イン率から出る確率は ${(pAtLeast*100).toFixed(0)}%。`+
      (pAtLeast > 0.05
        ? ' 珍しくないので、この実績を真の値と思ってはいけない。'
        : ' さすがに偏っている。'));
    if(m1 < inRate - 0.05){
      console.log(`  **ただしモデルの${(m1*100).toFixed(1)}%は、公表イン率${(inRate*100).toFixed(0)}%も下回っている。**`);
      console.log('  イン率は何千レースもの集計なので、こちらとのズレは件数のせいにできない。');
      console.log('  モデルは1号艇を構造的に低く見ている可能性がある。');
    } else if(m1 > inRate + 0.05){
      console.log(`  モデルの${(m1*100).toFixed(1)}%は公表イン率を上回っている。`);
    } else {
      console.log('  モデルの平均は公表イン率とおおむね合っている。');
    }
    console.log('  ※ 重みをいじる前に、まず「どこまでなら重みで動くのか」を下で測る。');

    /* 競艇場ごとに分ける。全部が同じ場のデータだと
       「その場だから」なのか「モデルだから」なのかが分けられない。 */
    const byV = {};
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const v = R.jcd;
      byV[v] = byV[v] || { n:0, said:0, won:0, name:(HTML.match(new RegExp(`'${v}':\\{name:'([^']+)'`))||[])[1] || v };
      byV[v].n++;
      if(Number(R.result.split('-')[0]) === 1) byV[v].won++;
      byV[v].said += Object.keys(x.probOf).filter(k=>k[0]==='1')
                           .reduce((t,k)=>t + x.probOf[k], 0);
    }
    console.log('\n  競艇場ごとの1号艇（件数が偏っていないかを必ず見る）');
    console.log('    場        件数  モデルの平均  実際に勝った  公表イン率');
    for(const [v,o] of Object.entries(byV).sort((a,b)=>b[1].n-a[1].n)){
      const ir = VENUE_IN_RATE[v];
      console.log(`    ${String(o.name).padEnd(8)}${String(o.n).padStart(3)}件  `+
        `${(o.said/o.n*100).toFixed(1).padStart(7)}%  ${(o.won/o.n*100).toFixed(1).padStart(9)}%`+
        ` (${o.won}/${o.n})  ${ir!=null?ir+'%':'?'}`);
    }
    /* 場ごとの勝率は件数が少なすぎて真の値にならない。
       比べる相手は必ず公表イン率のほう。
       場をまたいで同じ向きのズレが出るなら、それはモデルの性質。 */
    console.log('\n  公表イン率との差（モデル − 公表）。場をまたいで同じ向きか');
    let wsum = 0, wn = 0;
    for(const [v,o] of Object.entries(byV).sort((a,b)=>b[1].n-a[1].n)){
      const ir = VENUE_IN_RATE[v]; if(ir==null) continue;
      const d = (o.said/o.n - ir/100) * 100;
      const pk = binomAtLeast(o.won, o.n, ir/100);
      console.log(`    ${String(o.name).padEnd(8)}${String(o.n).padStart(3)}件  `+
        `差 ${d>=0?'+':''}${d.toFixed(1)}pt   `+
        `実績${o.won}/${o.n}が公表イン率から出る確率 ${(pk*100).toFixed(0)}%`);
      wsum += d*o.n; wn += o.n;
    }
    if(wn){
      const avg = wsum/wn;
      console.log(`    件数で重みづけした平均の差  ${avg>=0?'+':''}${avg.toFixed(1)}pt`);
      console.log(Math.abs(avg) < 6
        ? '    → 場をまたいで数pt。小さいので、これだけで重みを動かす理由にはならない。'
        : '    → 場をまたいで同じ向きに大きくズレている。重みを見直す材料になる。');
    }

    const big = Object.values(byV).sort((a,b)=>b.n-a.n)[0];
    if(big && big.n / n > 0.5){
      console.log(`    → ${big.name}だけで全体の${(big.n/n*100).toFixed(0)}%。`+
                  `いまの結論は「${big.name}での結論」でしかない。`);
      console.log('       他場のレースを足すまで、モデル全体の性質とは呼べない。');
    }
  }

  console.log('\n=== 1号艇の低さは、重みをいじれば直るのか ===');
  console.log('  「直すべきか」の前に「直せるのか」を見る。');
  console.log('  枠の重み(W.lane)と、確率の広がりを決める温度(TEMPERATURE)を動かして、');
  console.log('  モデルの1号艇平均が公表イン率に近づくか、そのとき順位の成績が落ちないかを測る。\n');
  {
    const n = base.length;
    const lane1 = res => res.reduce((t,x)=>t + Object.keys(x.probOf)
      .filter(k=>k[0]==='1').reduce((u,k)=>u + x.probOf[k], 0), 0) / res.length;
    const logScore = res => {
      const rows = [];
      for(const x of res){
        const R = RACES.find(r=>r.name===x.name);
        const map = ODDS[R.name];
        if(!map || Object.keys(map).length !== 120) continue;
        const w = Number(R.result.split('-')[0]);
        const md = Object.keys(x.probOf).filter(k=>k[0]===String(w))
                         .reduce((t,k)=>t + x.probOf[k], 0);
        rows.push(md);
      }
      return rows.length ? rows.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0)/rows.length : NaN;
    };
    /* 市場の対数スコアを、モデルとまったく同じレースの集合で出す。
       ------------------------------------------------------------------
       ここは -0.965 と数字を直接書いていた。レースを足しても書き換わらないので、
       レースが30件・オッズが21件になった時点で、
       「モデルは30件、市場は昔の21件」を並べて比べていた。
       比べ方そのものが壊れていたので、同じ集合から毎回計算する。 */
    const marketLogScore = res => {
      const rows = [];
      for(const x of res){
        const R = RACES.find(r=>r.name===x.name);
        const map = ODDS[R.name];
        if(!map || Object.keys(map).length !== 120) continue;   /* モデル側と同じ条件 */
        const w = R.result.split('-')[0];
        let tot = 0, win = 0;
        for(const k in map){ const q = 1/map[k]; tot += q; if(k[0] === w) win += q; }
        rows.push(win/tot);
      }
      return rows.length ? { ll: rows.reduce((t,v)=>t + Math.log(v), 0)/rows.length, n: rows.length }
                         : { ll: NaN, n: 0 };
    };
    const show = (label, res) => {
      const st = summarize(res);
      console.log(`  ${label.padEnd(26)}1号艇 ${(lane1(res)*100).toFixed(1).padStart(5)}%  `+
        `対数 ${logScore(res).toFixed(3)}  平均順位 ${st.avg.toFixed(1)}  12点 ${st.in12}/${st.n}`);
    };
    console.log('  設定                        モデルの1号艇  1着の対数  3連単の順位');
    show('いまのまま', base);
    /* 温度を下げると確率の差が開く（自信を強める）。枠の重みは動かさない。 */
    for(const t of [10, 9, 8, 7]){
      const patched = HTML.replace('const TEMPERATURE = 11;', `const TEMPERATURE = ${t};`);
      if(patched === HTML){ console.log('  TEMPERATUREの箇所が見つからない'); break; }
      show(`温度 ${t}（11→${t}）`, runWith({},null,{html:patched}));
    }
    /* 枠の重みを増やす。増やしたぶんは全国勝率から取る（合計を変えない）。 */
    for(const add2 of [0.04, 0.08, 0.12]){
      show(`枠の重み +${add2.toFixed(2)}`, runWith({lane:0.14+add2, national:0.11-add2}));
    }
    /* 先に基準を書く（2026-10-08）
       ------------------------------------------------------------------
       上の表で「枠の重み +0.12」が市場の対数スコアを初めて上回った。
       だがこれは7通り試して、いちばん良かったものを同じデータから選んだ数字。
       「外にA級なし」でまったく同じ選び方をして、前向きに試したら2/5になった。
       同じ間違いを繰り返さないため、ここでは採用せず、先に判定を書いておく。

       【判定】下に並べた30レース以外（＝これから足すレース）で、
               オッズ付きが15レースたまった時点で、
               次の2つをどちらも満たせば「枠の重み +0.12」を採用する。
                 1. その15レースだけで、1着の対数スコアが いまの設定より良い
                 2. その15レースだけで、1着の対数スコアが 市場より良い
               1つでも欠ければ捨てて、いまのままにする。
       この条件は結果を見てから変えない。 */
    const PREREG_LANE_NAMES = new Set([
  '若松11R 準優勝戦',
  '若松10R 準優勝戦',
  '桐生8R 女子',
  '桐生9R 男子',
  '桐生12R 特選',
  '徳山1R 一般',
  '徳山2R 特選',
  '徳山3R 特賞',
  '徳山4R 予選',
  '徳山5R 予選',
  '徳山6R 予選',
  '三国1R 一般',
  '三国3R 一般',
  '三国5R 一般',
  '三国6R 一般',
  '三国7R 一般',
  '三国8R 一般',
  '三国9R 一般',
  '三国10R 準優勝戦',
  '三国11R 準優勝戦',
  '三国12R 準優勝戦',
  '下関1R 予選',
  '徳山1R 朝トク予選',
  '下関2R 予選',
  '徳山2R 狙いトク特選',
  '徳山3R 決めトク特賞',
  '徳山4R ガチトク予選',
  '徳山5R 予選 4日目',
  '下関10R 予選特賞',
  '下関11R 予選特選'
    ]);
    {
      const fwd = base.filter(x=>!PREREG_LANE_NAMES.has(x.name));
      const fwdOdds = fwd.filter(x=>{
        const m = ODDS[x.name]; return m && Object.keys(m).length === 120;
      });
      console.log('\n  【判定・2026-10-08に先に書いた】枠の重み +0.12 を採用するか');
      if(fwdOdds.length < 15){
        console.log(`    これから足すレースで判定する。いま ${fwdOdds.length}/15 レース。`);
        console.log('    （上の表は、設定を選んだのと同じ30レースで測った数字。根拠にしない）');
      }else{
        const now  = logScore(fwdOdds);
        const plus = logScore(runWith({lane:0.26, national:-0.01})
                       .filter(x=>!PREREG_LANE_NAMES.has(x.name)));
        const mk2  = marketLogScore(fwdOdds);
        const c1 = plus > now, c2 = plus > mk2.ll;
        console.log(`    ${c1?'○':'×'} いまの設定より良い   +0.12 ${plus.toFixed(3)} / いま ${now.toFixed(3)}`);
        console.log(`    ${c2?'○':'×'} 市場より良い         +0.12 ${plus.toFixed(3)} / 市場 ${mk2.ll.toFixed(3)}`);
        console.log(`    → ${c1&&c2 ? '2つとも満たした。採用する。' : '欠けたので捨てる。いまのままにする。'}`);
      }
    }
    {
      const mk = marketLogScore(base);
      console.log(`\n  市場の1着対数スコアは ${mk.ll.toFixed(3)}（同じ${mk.n}レースで計算）。`);
      console.log('  上の「1着の対数」も同じ'+mk.n+'レースなので、そのまま比べられる。');
      console.log('  ※ 以前はここに -0.965 と直接書いていた。レースを足しても書き換わらず、');
      console.log('    モデル30件と市場21件を並べて比べていた。計算に変えた。');
    }
    console.log('  ※ どれかが良く見えても、まだ変えない。17レースでは選んだ時点で');
    console.log('     その17レースに合わせただけになる。次の10レースでも同じ向きなら考える。');
  }

  console.log('\n=== 展示STは本番STを言い当てているか ===');
  console.log('  展示STは採点の中でも重い項目のひとつ。');
  console.log('  「展示で遅い艇は本番でも遅い」が本当かどうかは、両方を並べないと分からない。');
  console.log('  結果画面のスタート情報から本番STを写した回だけが対象（actualST）。\n');
  {
    const withST = RACES.filter(r=>r.actualST);
    if(!withST.length){
      console.log('  本番STを記録したレースがまだ無い。');
      console.log('  結果画面の「スタート情報」の6つの数字を actualST に写すと、ここで測れる。');
    } else {
      const pairs = [];
      for(const R of withST){
        R.B.forEach((b,i)=>{
          const a = R.actualST[i+1];
          if(b.exST==null || a==null) return;
          /* 展示でFだった艇は、本番の出方と別物なので外す */
          if(b.exF === 'F') return;
          pairs.push({race:R.name, lane:i+1, ex:b.exST, ac:a});
        });
      }
      console.log('  レース          枠   展示ST  本番ST   差');
      pairs.forEach(x=>console.log(`  ${x.race.padEnd(14)}${x.lane}   `+
        `${x.ex.toFixed(2).padStart(5)}  ${x.ac.toFixed(2).padStart(5)}  ${(x.ac-x.ex>=0?'+':'')}${(x.ac-x.ex).toFixed(2)}`));
      const n = pairs.length;
      const mean = a => a.reduce((t,v)=>t+v,0)/a.length;
      const ex = pairs.map(x=>x.ex), ac = pairs.map(x=>x.ac);
      const mx = mean(ex), my = mean(ac);
      let num=0, dx=0, dy=0;
      for(let i=0;i<n;i++){ num+=(ex[i]-mx)*(ac[i]-my); dx+=(ex[i]-mx)**2; dy+=(ac[i]-my)**2; }
      const r = (dx&&dy) ? num/Math.sqrt(dx*dy) : 0;
      console.log(`\n  ${n}艇分。展示STの平均 ${mx.toFixed(3)} / 本番STの平均 ${my.toFixed(3)}`);
      console.log(`  相関 ${r.toFixed(2)}（1に近いほど「展示が速い艇は本番も速い」）`);
      const shift = my - mx;
      const allFaster = pairs.every(x=>x.ac < x.ex);
      console.log(`  本番のほうが速い艇 ${pairs.filter(x=>x.ac<x.ex).length}/${n}`+
                  `（平均で ${shift>=0?'+':''}${shift.toFixed(3)} 秒）`);
      if(allFaster && n >= 6){
        console.log('  ※ 全艇が本番のほうが速い。展示のスタートは競っていないので');
        console.log('     押していないだけ、という説明が付く。ただし件数が要る。');
        console.log('     もしこれが続くなら、展示STは「絶対値」ではなく');
        console.log('     「そのレースの中での速い遅い」として使うほうが筋が通る。');
      }
      if(n < 30){
        console.log('  ※ 30艇分に満たないので、この相関はまだ読まないこと。');
        console.log('     符号が逆でも偶然の幅に入る。');
      } else if(r < 0.2){
        console.log('  ※ 展示STは本番STをほとんど言い当てていない。');
        console.log('     ただし「本番STを当てていない」＝「採点に役立たない」ではない。');
        console.log('     重みを下げたら成績がどうなるかを、そのまま下で測る。');
      }

      /* 相関が低いことと、重みを下げるべきことは別。
         ここを分けずに「当てていないから外そう」とやると、実際には悪くなる。
         だから相関の直後に、必ず重みを振った結果を並べる。 */
      console.log('\n  展示STの重みを下げたらどうなるか（減らしたぶんは展示タイムへ回す）');
      console.log('    設定                        1着の対数  平均順位  6点     12点');
      const W0 = 0.07, WT0 = 0.08;
      const showW = (label, patch) => {
        const r2 = runWith(patch, null, {});
        const st = summarize(r2);
        const rows2 = [];
        for(const y of r2){
          const R2 = RACES.find(q=>q.name===y.name); const m2 = ODDS[R2.name];
          if(!m2 || Object.keys(m2).length !== 120) continue;
          const w2 = Number(R2.result.split('-')[0]);
          rows2.push(Object.keys(y.probOf).filter(k=>k[0]===String(w2))
                           .reduce((t,k)=>t + y.probOf[k], 0));
        }
        const ls = rows2.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0)/rows2.length;
        console.log(`    ${label.padEnd(26)}${ls.toFixed(3).padStart(8)}  `+
          `${st.avg.toFixed(1).padStart(7)}  ${st.in6}/${st.n}   ${st.in12}/${st.n}`);
      };
      showW('いまのまま exST 0.07', {});
      for(const v of [0.03, 0]){
        showW(`exST ${v.toFixed(2)} / exTime ${(W0+WT0-v).toFixed(2)}`,
              { exST:v, exTime:W0+WT0-v });
      }
      console.log('    → 下げるほど悪くなるなら、相関が低くても外してはいけない。');
      console.log('       展示STは本番STそのものではなく、別の何か（気合い・');
      console.log('       仕上がり）を映している可能性がある。'); 
    }
  }

  /* 展示でフライングした艇は、本番で沈むのか。
     唐津8R〜11Rで「展示Fした艇が本番は普通に走って1着」が4回続いたので、
     印象ではなく数で見る。採点を通さず、生のデータだけで数える。
     着順は3連単の正解から分かる上位3艇しか取れないので、
     「3着以内に入ったか」だけを比べる。 */
  /* まるごと1日そろったレースだけで見る。
     ここまでのレースは「買ったレース」「送ってもらったレース」の寄せ集めで、
     選り好みが入っている。1日12レースが全部そろっていれば、その日については
     選り好みが無い。モデルと市場の比べ方として、こちらのほうが素性が良い。 */
  console.log('\n=== まるごと1日そろった日だけで見る（選り好みなし） ===');
  {
    const byDay = new Map();
    for(const r of RACES){
      if(!r.date || !r.jcd || !r.rno) continue;
      const k = `${r.date}|${r.jcd}`;
      if(!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    }
    /* 「そろった」の数え方。
       以前は12レース全部が記録にあることを求めていた。
       そのため1本でも採点できないレース（欠場で5艇）があると、
       残り11レースごとその日が捨てられていた。実際、2026-10-26 の常滑と福岡、
       10/28 の常滑が、1本の欠場だけで外れていた。
       採点できないレースを除いた残りは、レースを選んでいないので
       選り好みは入っていない。捨てる理由がない。

       そこで「記録にある、または採点できないと分かっている」で数える。
       採点できない理由は data/unscorable.js に書いてある（手では書かない）。 */
    const skipOf = (date,jcd) => new Set(
      UNSCORABLE.filter(u=>u.date===date && u.jcd===jcd).map(u=>u.rno));
    const full = [...byDay].filter(([k,list])=>{
      const [date,jcd]=k.split('|');
      const nos = new Set(list.map(r=>r.rno));
      const skip = skipOf(date,jcd);
      return [...Array(12)].every((_,i)=>nos.has(i+1) || skip.has(i+1));
    });
    /* 1日ぶんだけ見ても12レースしかなく、たまたまで上下する。
       「何日かたまって、はじめて意味を持つ」とだけ書いて合計を出していなかったので、
       たまった分をここで足す。これが選り好みの入っていない唯一の数字。 */
    const TOTAL = new Map();   /* 買い方 → {inv, back, races, won:[払戻…]} */
    /* 当たった払戻を1件ずつ持つ。合計だけでは
       「大穴1本で足りている」のか「散らばって足りている」のかが分からない。
       事前に決めた判定条件が「最大の1件を除いても100%以上」なので、
       この一覧が無いと判定できない。 */
    /* 判定⑧用。凍結した場日を除いた分だけを別に積む。
       「全部の合計」と「凍結後だけ」を取り違えないよう、入れものを分ける。 */
/* 【判定⑧】で判定に使ってよい場日の線引き。
       最初は「今日そろっている29場日」を名前で凍結した。これはすぐ破れた。
       同じ日のレースをあとから足せる（返還ありの取り込みを直した、欠場を
       除いて数えるようにした）ので、10/26〜10/28 の8場日が新しくそろい、
       「凍結後の新しい場日」として判定に入ってしまった。
       もう中身を見た日なのに、判定の材料になってしまう。

       一覧で凍結する限り、同じことが毎回起きる。
       日付で区切れば、あとから何本足しても破れない。 */
    const PREREG_ANA_AFTER = '2026-10-28';   /* この日までは判定に使わない */
    /* 【判定⑧】は「波乱8点だけ」で凍結してある。
       いまの買い方は 本線6点＋波乱4点 なので、上の積み上げ（FRESH_TOTAL）には
       波乱4点しか入らない。2026-10-30、判定⑧が波乱（8点）を探して
       undefined を読み、落ちた。

       凍結した条件は、いまの点数が何であっても同じものを測らなければ
       意味がない。判定⑧ぶんは、ここで別に積む。 */
    /* 判定⑦の PREREG7_MAIN と同じ扱い。凍結した点数は名前を付けて置く。
       直書きの 8 にすると、点数の直書きを見張る検査（test52）に当たるうえ、
       「なぜ8なのか」が読めなくなる。 */
    const PREREG8_ANA = 8;
    const ANA8 = {inv:0, races:0, won:[]};
    const FRESH_TOTAL = new Map();
    let FRESH_FLAG = false;      /* いま足している場日が凍結後かどうか */
    const addTotal = (label, inv, won, races) => {
      for(const M of FRESH_FLAG ? [TOTAL, FRESH_TOTAL] : [TOTAL]){
        if(!M.has(label)) M.set(label, {inv:0, races:0, won:[]});
        const t=M.get(label);
        t.inv+=inv; t.races+=races; t.won.push(...won);
      }
    };
    if(!full.length){
      console.log('  1日ぶんそろった日はまだ無い。');
    }else{
      for(const [k,list] of full){
        const [date,jcd] = k.split('|');
        FRESH_FLAG = date > PREREG_ANA_AFTER;   /* この日より後の場日だけ判定⑧に入れる */
        const names = new Set(list.map(r=>r.name));
        const sub = base.filter(x=>names.has(x.name));
        const lane1 = list.filter(r=>String(r.result).startsWith('1')).length;
        /* 欠場で採点できなかったレースがある日は11レースなどになる。
           12と書き決めていたせいで、1本欠けた日は丸ごと外れていた。
           実際の本数で出す（除いた本数も断る）。 */
        const N = list.length;
        const dropped = skipOf(date,jcd);
        console.log(`\n  ${date} 場コード${jcd}  ${N}レース`
          + (dropped.size ? `（${[...dropped].sort((a,b)=>a-b).join(',')}R は欠場で採点できないので除く）` : ''));
        const h1 = (map, boat) => Object.entries(map)
          .filter(([c])=>c.startsWith(boat+'-')).reduce((a,[,v])=>a+v, 0);
        const mdl1 = sub.length===N
          ? sub.reduce((a,x)=>a+h1(x.probOf,'1'),0)/N*100 : null;
        console.log(`    1号艇が1着      ${lane1}/${N} = ${(lane1/N*100).toFixed(0)}%`
                    + `  （この場の公表イン率 ${VENUE_IN_RATE[jcd] ?? '—'}%`
                    + (mdl1!=null ? ` / モデルの平均 ${mdl1.toFixed(1)}%` : '') + '）');
        if(sub.length===N){
          const ranks = sub.map(x=>x.rank);
          const avg = ranks.reduce((a,c)=>a+c,0)/N;
          console.log(`    3連単の順位     平均${avg.toFixed(1)}  `
            + `6点${ranks.filter(x=>x<=6).length}/${N} `
            + `12点${ranks.filter(x=>x<=12).length}/${N} `
            + `20点${ranks.filter(x=>x<=20).length}/${N}`);
          console.log(`    1着を当てた     ${sub.filter(x=>x.head===String(x.result).split('-')[0]).length}/${N}`);
        }
        /* その日を1日まるごと、決めた買い方で買ったらいくらになるか。
           1レースだけ当てた話はいくらでも作れるが、1日そろえると作れない。
           買い方は index.html の buyPlan()（至極1点 / 本線10点 / 波乱8点）。 */
        if(sub.length===N){
          const payOfDay = {}; for(const r of list) payOfDay[r.name]={pay:r.pay, result:String(r.result)};
          const toC = x => Object.entries(x.probOf).map(([combo,p])=>({combo,p}));
          const money = (label, pick) => {
            let inv=0, hits=[];
            for(const x of sub){
              const info = payOfDay[x.name]; if(!info || info.pay==null) continue;
              const ks=[...new Set(pick(WIN.buyPlan(toC(x))))];
              inv += ks.length*100;
              if(ks.includes(info.result)) hits.push(info.pay);
            }
            const back=hits.reduce((a,c)=>a+c,0);
            addTotal(label.trim(), inv, hits, N);
            console.log(`      ${label.padEnd(18)} 投資¥${String(inv).padStart(6)}  `+
              `払戻¥${String(back).padStart(6)}  収支${(back-inv>=0?'+':'')}¥${(back-inv).toLocaleString()}  `+
              `回収率${String(Math.round(back/inv*100)).padStart(4)}%  的中${hits.length}/${N}`);
          };
          /* レースごとに、どこで当たってどこで外したかを並べる。
             合計だけ見ると「惜しかった」のか「全然ちがった」のかが分からない。 */
          console.log(`    レースごと（${L_MAIN} / ${L_ANA}）`);
          console.log('      R   正解      払戻  人気  モデル順位  本線  波乱');
          for(const x of [...sub].sort((a,b)=>{
                const ra=list.find(r=>r.name===a.name).rno, rb=list.find(r=>r.name===b.name).rno;
                return ra-rb; })){
            const r = list.find(y=>y.name===x.name);
            const pl = WIN.buyPlan(toC(x));
            const res = String(r.result);
            const inMain = pl.main.includes(res), inAna = pl.ana.includes(res);
            console.log(`      ${String(r.rno).padStart(2)}  ${res.padEnd(8)}`+
              `¥${String(r.pay).padStart(6)}  ${String(r.pop).padStart(3)}  `+
              `${String(x.rank).padStart(8)}番目  `+
              `${inMain?'○ ':'× '}  ${inAna?'○':'×'}`);
          }
          /* 判定⑧ぶん（波乱8点だけ）。凍結の線より後の日だけ積む。
             買い方を変えても測るものが変わらないよう、ここで8点を指定する。 */
          if(FRESH_FLAG){
            for(const x of sub){
              const info = payOfDay[x.name]; if(!info || info.pay==null) continue;
              const ks = [...new Set(WIN.buyPlan(toC(x), {ana:PREREG8_ANA}).ana)];
              ANA8.inv += ks.length*100; ANA8.races++;
              if(ks.includes(info.result)) ANA8.won.push(info.pay);
            }
          }
          console.log('    この日を1日まるごと買ったら（1点100円）');
          money('至極の一点（1点）', p=>[p.best]);
          money(`本線（${PTS.main}点）`,      p=>p.main);
          money(`波乱（${PTS.ana}点）`,       p=>p.ana);
          money(`本線＋波乱（${PTS_ALL}点）`, p=>p.all);
          /* 至極を厚くした場合も同じ日で出す。払戻は100円あたりなので X/100 倍する。 */
          const weighted = (label, topYen, use) => {
            let inv=0, won=[];
            for(const x of sub){
              const info = payOfDay[x.name]; if(!info || info.pay==null) continue;
              const pl = WIN.buyPlan(toC(x));
              const ks = [...new Set(use(pl))];
              for(const k of ks) inv += (k===pl.best ? topYen : 100);
              if(ks.includes(info.result)){
                won.push(Math.round(info.pay * ((info.result===pl.best ? topYen : 100)/100)));
              }
            }
            const back=won.reduce((a,c)=>a+c,0), hits=won.length;
            addTotal(label.trim(), inv, won, N);
            console.log(`      ${label.padEnd(26)} 投資¥${String(inv).padStart(6)}  `+
              `払戻¥${String(Math.round(back)).padStart(6)}  `+
              `収支${(back-inv>=0?'+':'-')}¥${Math.abs(Math.round(back-inv)).toLocaleString()}  `+
              `回収率${String(Math.round(back/inv*100)).padStart(4)}%  的中${hits}/${N}`);
          };
          console.log('    至極を厚くしたら（ほかは100円のまま）');
          for(const y of [500,1000]){
            weighted(`${L_MAIN}・至極¥${y}`, y, p=>p.main);
            weighted(`${PTS_ALL}点・至極¥${y}`, y, p=>p.all);
          }
        }
        /* 1着の対数スコアを、この日のオッズがある分だけで比べる。
           1着の確率は「その艇が頭の組」を足し合わせて出す。市場は 0.75÷オッズ。 */
        const head1 = (map, boat) => Object.entries(map)
          .filter(([c])=>c.startsWith(boat+'-'))
          .reduce((a,[,v])=>a+v, 0);
        {
          let m=0, k2=0, n=0;
          for(const r of list){
            const o = ODDS[r.name]; if(!o) continue;
            const row = base.find(x=>x.name===r.name); if(!row) continue;
            const mk = Object.fromEntries(Object.entries(o).map(([c,v])=>[c, 0.75/v]));
            const mkTotal = Object.values(mk).reduce((a,c)=>a+c,0);
            const w = String(r.result).split('-')[0];
            const pm = head1(row.probOf, w);
            const pk = head1(mk, w) / mkTotal;     /* 合計1に直してから使う */
            if(!(pm>0) || !(pk>0)) continue;
            m += Math.log(pm); k2 += Math.log(pk); n++;
          }
          if(n) console.log(`    1着の対数スコア  モデル ${(m/n).toFixed(3)} / 市場 ${(k2/n).toFixed(3)}  （${n}レース）`);
        }
      }
      console.log('\n  ※ 1日は12レースしかない。ここの数字だけで買い方を決めないこと。');
      console.log('     選り好みの無い日が何日かたまって、はじめて意味を持つ。');

      /* たまった分の合計。レースを選んでいないので、ここだけが素性の良い数字。 */
      if(TOTAL.size){
        /* 本数は日によって違う（欠場の日は11本）。足し算で出す。
           days*12 と決め打ちしていたら、合計が実際より多く出ていた。 */
        const days=full.length;
        const races=full.reduce((a,[,l])=>a+l.length,0);
        console.log(`\n  ---- 上の ${days}場日 ＝ ${races}レースを全部あわせると（選り好みなし） ----`);
        for(const [label,t] of TOTAL){
          const back=t.won.reduce((a,c)=>a+c,0);
          const top=t.won.length?Math.max(...t.won):0;
          const less=back-top;
          console.log(`      ${label.padEnd(26)} 投資¥${String(t.inv).padStart(8)}  `+
            `払戻¥${String(back).padStart(8)}  `+
            `収支${(back-t.inv>=0?'+':'-')}¥${Math.abs(back-t.inv).toLocaleString()}  `+
            `回収率${String(Math.round(back/t.inv*100)).padStart(4)}%  `+
            `最大1件除くと${String(Math.round(less/t.inv*100)).padStart(4)}%  `+
            `的中${t.won.length}/${t.races}`);
        }
        console.log('      ※ 選んだレースだけを見た数字（上の「検証レース全体」）より低く出るのが普通。');
        console.log('         低いほうが実際に近い。');
        /* ここから下は「あとから当てた条件」であることを、はっきり書いておく。
           100%以上 かつ 最大1件除いても100%以上 という条件は前から決めてあるが、
           この348レースは条件を書いたあとに集めたものではなく、
           数字を見てから当てている。つまり◎が付いても判定に通ったことにはならない。
           ここは「判定⑧を書くきっかけになった数字」の置き場で、
           判定そのものは下の【判定⑧】でやる。 */
        console.log('\n      ---- 参考：条件（100%以上 かつ 最大1件除いても100%以上）に当てると ----');
        console.log('      ※ これは数字を見たあとに当てているので、判定ではない。下の判定⑧でやる。');
        for(const [label,t] of TOTAL){
          const back=t.won.reduce((a,c)=>a+c,0);
          const top=t.won.length?Math.max(...t.won):0;
          const a=back/t.inv*100, b=(back-top)/t.inv*100;
          const verdict = (a>=100 && b>=100) ? '条件を満たしている（ただし後出し）'
                        : (a>=100)           ? '大穴1本に頼っている'
                        :                      '満たしていない';
          console.log(`      ${label.padEnd(26)} ${verdict}`);
        }

        /* 【判定⑧・2026-10-28に先に書いた】波乱8点だけを買うか
           ------------------------------------------------------------
           上の合計で、波乱8点だけが 130%（最大1件除いて113%）になった。
           ほかの買い方は全部100%未満で、本線10点は63%。
           これは「数字を見てから気づいたこと」なので、そのまま採ってはいけない。
           丸亀の10月だけを切り出せば本線が107%に見えたのと同じ落とし穴。

           そこで 2026-10-28 までの日を対象外にし、
           それより後の日の場日だけで判定する。条件は⑤⑥⑦と同じ2つ。
             ・回収率100%以上
             ・最大の払戻1件を除いても100%以上
           必要数は15場日（180レース）。波乱8点の的中はおよそ7レースに1本で、
           180レースなら25本前後たまる。⑤⑥（20件・12件）より厚めにしたのは、
           波乱の払戻が大きく散らばり、少ない本数では当たり外れで決まるため。 */
        /* 判定⑧は 2026-10-28 に「波乱8点だけ」と書いて凍結した。
           翌日に買う点数を 本線6点＋波乱4点 に変えたが、判定⑧の問いは
           「波乱だけを買う形にするか」であって、今回の変更とは別の話。
           条件を書いた日の8点に固定する（BUY_POINTS を使うと意味が変わる）。 */
        console.log('\n  【判定⑧・2026-10-28に先に書いた】波乱8点だけを買うか（8点に固定）');
        {
          const NEED_DAYS = 15;
          const fresh = full.filter(([k])=>k.split('|')[0] > PREREG_ANA_AFTER);
          if(fresh.length < NEED_DAYS){
            console.log(`    いま ${fresh.length}/${NEED_DAYS} 場日。たまったら判定する。`);
            console.log(`    （${PREREG_ANA_AFTER} までの場日は判定に使わない。`
                      + `それより後の日だけで判定する）`);
            if(fresh.length && ANA8.inv){
              const back=ANA8.won.reduce((a,c)=>a+c,0), top=ANA8.won.length?Math.max(...ANA8.won):0;
              console.log(`    （参考 回収率${Math.round(back/ANA8.inv*100)}% / `
                        + `最大1件除くと${Math.round((back-top)/ANA8.inv*100)}% / `
                        + `的中${ANA8.won.length}件。場日が足りないので根拠にしない）`);
            }
          }else{
            const t = ANA8;
            const back=t.won.reduce((a,c)=>a+c,0), top=t.won.length?Math.max(...t.won):0;
            const a=back/t.inv*100, b=(back-top)/t.inv*100;
            console.log(`    対象 ${fresh.length}場日 = `
              + `${fresh.reduce((a,[,l])=>a+l.length,0)}レース（凍結分は除く）`);
            console.log(`    ${a>=100?'○':'×'} 回収率100%以上        ${Math.round(a)}%`);
            console.log(`    ${b>=100?'○':'×'} 最大1件を除いても100%以上 ${Math.round(b)}%`);
            console.log(`    → ${a>=100&&b>=100 ? '波乱8点を採る。' : '欠けたので捨てる。採らない。'}`);
          }
        }
        console.log('      ※ 判定が済むまで「波乱だけを買う」形にはしない。');
        console.log(`         いまの買い方は ${L_MAIN}＋${L_ANA}（${PTS_ALL}点）で、`
                  + `波乱だけを買っているわけではない。`);
      }
    }
  }

  /* 日別・場別の収支を、1場まるごとでなくても出す。
     きっかけは運用のほう。毎晩「今日いくらだった？」を手で数えていて、
     2026-10-26 は大村と桐生をまたいだので電卓仕事になった。
     「まるごと1日」セクションは12レース揃った日しか出ないので、
     途中参加の日は何も出ない。ここはレースが1本でも出す。

     ただし、ここに出る数字は「その日に買ったレース」の寄せ集めで、
     選り好みが入っている。買い方の良し悪しの証拠にはならない。
     用途は「今日の答え合わせ」だけ。判断には全96レースの数字を使う。 */
  console.log('\n=== 日別・場別の収支（答え合わせ用・選り好みあり） ===');
  {
    const byDay = new Map();
    for(const r of RACES){
      if(!r.date || !r.jcd || !r.rno || r.pay==null) continue;
      const k = `${r.date}|${r.jcd}`;
      if(!byDay.has(k)) byDay.set(k, []);
      byDay.get(k).push(r);
    }
    const keys = [...byDay.keys()].sort();
    if(!keys.length){
      console.log('  結果の出ているレースがまだ無い。');
    }else{
      const toC = x => Object.entries(x.probOf).map(([combo,p])=>({combo,p}));
      /* 日ごとの合計を最後にもう一度並べるので、先に貯めておく */
      const totals = [];
      for(const k of keys){
        const [date,jcd] = k.split('|');
        const list = [...byDay.get(k)].sort((a,b)=>a.rno-b.rno);
        const names = new Set(list.map(r=>r.name));
        const sub = base.filter(x=>names.has(x.name));
        if(!sub.length) continue;
        const rowOf = new Map(sub.map(x=>[x.name, x]));
        console.log(`\n  ${date} ${VENUE_NAME[jcd] ?? '場コード'+jcd}  ${list.length}レース`);
        /* 「安い組」= 本線のうち「当たっても投資額に届かない組」の数。
           境目は本線の点数で決まる（6点なら6倍、10点なら10倍）。
           ここは買う点数に追従させる。固定の10倍にしておくと、
           6点買いなのに10倍を基準にして、当たるのに赤字かどうかを取り違える。
           配信時に警告として出している数字そのもの。ここに並べておけば、
           警告が当たっていたかを毎回手で数えなくてよい。
           オッズを記録していないレースは — にする（0と区別する）。 */
        console.log(`      R   正解      払戻  人気  モデル順位  至極  本線  波乱  ${PTS.main}倍未満`);
        let invM=0, backM=0, hitM=0, invA=0, backA=0, hitA=0, invB=0, backB=0, hitB=0;
        const warnD=[], okD=[];   /* 警告ありのレースと、そうでないレース */
        for(const r of list){
          const x = rowOf.get(r.name); if(!x) continue;
          const pl = WIN.buyPlan(toC(x));
          const res = String(r.result);
          const inB = res===pl.best, inM = pl.main.includes(res), inA = pl.ana.includes(res);
          invB += 100; if(inB){ backB += r.pay; hitB++; }
          invM += pl.main.length*100; if(inM){ backM += r.pay; hitM++; }
          invA += pl.ana.length*100;  if(inA){ backA += r.pay; hitA++; }
          const o = ODDS[r.name];
          const cheap = o ? pl.main.filter(c=>o[c]!=null && o[c]<pl.main.length).length : null;
          if(cheap!=null){ if(cheap>=2) warnD.push({r,inM,pay:r.pay,n:pl.main.length});
                           else okD.push({r,inM,pay:r.pay,n:pl.main.length}); }
          console.log(`      ${String(r.rno).padStart(2)}  ${res.padEnd(8)}`+
            `¥${String(r.pay).padStart(6)}  ${String(r.pop ?? '—').padStart(3)}  `+
            `${String(x.rank).padStart(8)}番目  `+
            `${inB?'○ ':'× '}  ${inM?'○ ':'× '}  ${inA?'○':'×'}  `+
            `${cheap==null ? '    —' : String(cheap).padStart(5)}`+
            `${cheap!=null && cheap>=2 ? ' ←警告' : ''}`);
        }
        const line = (label, inv, back, hit, n) => {
          const d = back - inv;
          console.log(`      ${label.padEnd(18)} 投資¥${String(inv).padStart(6)}  `+
            `払戻¥${String(back).padStart(6)}  収支${d>=0?'+':'-'}¥${Math.abs(d).toLocaleString()}  `+
            `回収率${String(inv?Math.round(back/inv*100):0).padStart(4)}%  的中${hit}/${n}`);
        };
        const n = list.length;
        console.log('    この日の収支（1点100円）');
        line('至極の一点（1点）', invB, backB, hitB, n);
        line(`本線（${PTS.main}点）`,      invM, backM, hitM, n);
        line(`波乱（${PTS.ana}点）`,       invA, backA, hitA, n);
        line(`本線＋波乱（${PTS_ALL}点）`, invM+invA, backM+backA, hitM+hitA, n);
        /* 警告あり／なしで、その日の本線がどうだったか。
           手で分けていた作業をここに寄せる。件数が少ないので回収率は参考値。 */
        const split = (label, arr) => {
          if(!arr.length) return;
          const inv = arr.reduce((a,c)=>a+c.n*100,0);
          const back = arr.filter(c=>c.inM).reduce((a,c)=>a+c.pay,0);
          console.log(`      ${label.padEnd(18)} ${arr.length}レース  `+
            `収支${back-inv>=0?'+':'-'}¥${Math.abs(back-inv).toLocaleString()}  `+
            `回収率${String(Math.round(back/inv*100)).padStart(4)}%  `+
            `的中${arr.filter(c=>c.inM).length}/${arr.length}`);
        };
        if(warnD.length || okD.length){
          console.log(`    警告（${PTS.main}倍未満が2点以上）で分けた${L_MAIN}`);
          split('警告あり', warnD);
          split('警告なし', okD);
        }
        totals.push({date, jcd, n, invM, backM, hitM, invA, backA, hitA, warnD, okD});
      }
      /* 日をまたいだ合計。同じ日に2場まわった日はまとめて1行にする */
      const byDate = new Map();
      for(const t of totals){
        if(!byDate.has(t.date)) byDate.set(t.date, []);
        byDate.get(t.date).push(t);
      }
      console.log('\n  日ごとの合計（複数場まわった日はまとめ）');
      console.log(`      日付         場                 R   ${L_MAIN}             ${PTS_ALL}点`);
      for(const [date, ts] of [...byDate].sort()){
        const n   = ts.reduce((a,c)=>a+c.n,0);
        const iM  = ts.reduce((a,c)=>a+c.invM,0),  bM = ts.reduce((a,c)=>a+c.backM,0);
        const hM  = ts.reduce((a,c)=>a+c.hitM,0);
        const iAll= iM + ts.reduce((a,c)=>a+c.invA,0);
        const bAll= bM + ts.reduce((a,c)=>a+c.backA,0);
        const hAll= hM + ts.reduce((a,c)=>a+c.hitA,0);
        const vs  = ts.map(t=>VENUE_NAME[t.jcd] ?? t.jcd).join('・');
        const fmt = (i,b,h) => `${(b-i>=0?'+':'-')}¥${String(Math.abs(b-i).toLocaleString()).padEnd(7)}`+
                               `${String(i?Math.round(b/i*100):0).padStart(4)}% ${h}/${n}`;
        console.log(`      ${date}  ${vs.padEnd(16)}${String(n).padStart(3)}   `+
                    `${fmt(iM,bM,hM)}   ${fmt(iAll,bAll,hAll)}`);
      }
      /* 警告あり／なしの通し合計。これは全レースぶんなので、
         日ごとの数字より意味がある（それでも寄せ集めではある）。 */
      {
        const allW = totals.flatMap(t=>t.warnD), allO = totals.flatMap(t=>t.okD);
        const row = (label, arr) => {
          if(!arr.length){ console.log(`      ${label.padEnd(10)} 0レース`); return; }
          const inv = arr.reduce((a,c)=>a+c.n*100,0);
          const hits = arr.filter(c=>c.inM).map(c=>c.pay);
          const back = hits.reduce((a,c)=>a+c,0);
          const top = hits.length ? Math.max(...hits) : 0;
          console.log(`      ${label.padEnd(10)} ${String(arr.length).padStart(3)}レース  `+
            `回収率${String(Math.round(back/inv*100)).padStart(4)}%  `+
            `最大1件除くと${String(Math.round((back-top)/inv*100)).padStart(4)}%  `+
            `的中${hits.length}/${arr.length}`);
        };
        console.log(`\n  警告（${PTS.main}倍未満が2点以上）で分けた${L_MAIN}・通し`);
        row('警告あり', allW);
        row('警告なし', allO);
        console.log('      ※ これは配信時に警告を出したかどうかで分けただけ。');
        console.log('         「警告ありは見送る」と決める前に、判定⑦の条件で確かめること。');
      }
      console.log('\n  ※ ここは「買ったレースだけ」の寄せ集め。良い日も悪い日も、');
      console.log('     レースを選んだ結果が入っている。買い方を変える根拠にはしないこと。');
      console.log('     根拠に使うのは全96レースの数字と、先に条件を書いた判定だけ。');
    }
  }

  /* 展示の情報を入れると、本当に読みが良くなるのか。
     きっかけは 2026-10-23 若松12R。展示が来る前の予想では正解 3-1-4 が4番目、
     展示（と進入変更）を入れ直したら12番目に下がり、本線10点から外れた。
     1件では何も言えないので、記録ぜんぶで測る。
     展示タイム・展示ST・展示Fの3つを落として、同じレースを採点し直す。 */
  /* 1点100円で上位N点を買ったら、という素朴な表。
     index.html の説明文がこの数字を引用しているので、ここを唯一の出どころにする。
     （以前は29レース時点の数字が画面に焼き付いたままになっていた） */
  console.log('\n=== 上位N点を1点100円で買ったら（全レース） ===');
  {
    const withPay = base.filter(r=>r.pay);
    const rows = [1,6,8,10,12,15,18,19,20,30].map(n=>{
      const hit = withPay.filter(r=>r.rank<=n);
      const inv = 100*n*withPay.length;
      const ret = hit.reduce((s,r)=>s+r.pay,0);
      return {n, pct:Math.round(ret/inv*100), hit:hit.length};
    });
    console.log(`  対象 ${withPay.length}レース`);
    for(const r of rows)
      console.log(`  ${String(r.n).padStart(2)}点  回収率${String(r.pct).padStart(4)}%  的中${r.hit}/${withPay.length}`);
    const best = rows.reduce((a,b)=>b.pct>a.pct?b:a);
    console.log(`  いちばん高いのは ${best.n}点（${best.pct}%）。`);
    console.log('  ※ 1レースの高配当で簡単に入れ替わる。山の位置を信じ込まないこと。');
  }

  /* 級別でメンバーの強さが変わると、モデルの当たり方も変わるのか。
     記録には A1だけ6人のレース（G1）と、A1が0〜1人のレース（一般）が
     どちらもまとまった数ある。混ぜたまま平均を見ていると、
     「どっちが得意か」が見えない。 */
  console.log('\n=== メンバーの強さで分けて見る（A1が何人いるか） ===');
  {
    const groups = [
      ['A1が6人（G1級）',   r=>r.B.filter(b=>b.g==='A1').length===6],
      ['A1が2〜5人',        r=>{const n=r.B.filter(b=>b.g==='A1').length; return n>=2&&n<=5;}],
      ['A1が0〜1人（一般級）', r=>r.B.filter(b=>b.g==='A1').length<=1],
    ];
    const idx = new Map(RACES.map((r,i)=>[r.name,i]));
    console.log('  группа'.replace('группа','　　　　　　　　　') +
      '件数  3連単の平均順位  10点的中  1着的中  1着の対数（モデル/市場）');
    for(const [label, pick] of groups){
      const sel = RACES.filter(pick);
      if(!sel.length) continue;
      const rows = sel.map(r=>base[idx.get(r.name)]).filter(Boolean);
      const ranks = rows.map(x=>x.rank);
      const avg = ranks.reduce((a,c)=>a+c,0)/ranks.length;
      const in10 = ranks.filter(x=>x<=10).length;
      const topHit = rows.filter(x=>x.head===String(x.result).split('-')[0]).length;
      /* 1着の対数スコアは、オッズのあるレースだけで比べる */
      const h1 = (map,b)=>Object.entries(map).filter(([k])=>k.startsWith(b+'-'))
                           .reduce((a,[,v])=>a+v,0);
      let m=0,k=0,n=0;
      for(const r of sel){
        const o=ODDS[r.name]; if(!o) continue;
        const row=base[idx.get(r.name)]; if(!row) continue;
        const mk=Object.fromEntries(Object.entries(o).map(([c,v])=>[c,0.75/v]));
        const tot=Object.values(mk).reduce((a,c)=>a+c,0);
        const w=String(r.result).split('-')[0];
        const pm=h1(row.probOf,w), pk=h1(mk,w)/tot;
        if(pm>0&&pk>0){ m+=Math.log(pm); k+=Math.log(pk); n++; }
      }
      console.log(`  ${label.padEnd(16)}${String(sel.length).padStart(3)}件  `
        + `${avg.toFixed(1).padStart(10)}  ${String(in10+'/'+sel.length).padStart(8)}  `
        + `${String(topHit+'/'+sel.length).padStart(7)}  `
        + (n ? `${(m/n).toFixed(3)} / ${(k/n).toFixed(3)}（${n}件）` : '—'));
    }
    console.log('  ※ 件数が違うので、的中数は割合で見ること。');
    /* 買ったらどうなるか。ここがいちばん知りたいところ。 */
    console.log('\n  上位10点を1点100円で買ったら');
    for(const [label, pick] of groups){
      const sel = RACES.filter(r=>pick(r) && r.pay);
      if(!sel.length) continue;
      const rows = sel.map(r=>({r, x:base[idx.get(r.name)]})).filter(o=>o.x);
      const inv = 100*10*rows.length;
      const hit = rows.filter(o=>o.x.rank<=10);
      const ret = hit.reduce((a,o)=>a+o.r.pay,0);
      /* 大きい1件に引っぱられていないか、いちばん高い払戻を抜いて並べる */
      const top = hit.length ? Math.max(...hit.map(o=>o.r.pay)) : 0;
      const ret2 = ret - top;
      console.log(`  ${label.padEnd(16)}${String(rows.length).padStart(3)}件  `
        + `投資${String(inv.toLocaleString()).padStart(7)}円  払戻${String(ret.toLocaleString()).padStart(7)}円  `
        + `回収率${String(Math.round(ret/inv*100)).padStart(4)}%  `
        + `／ いちばん大きい1件(¥${top.toLocaleString()})を除くと ${Math.round(ret2/inv*100)}%`);
    }
    console.log('  ※ 件数が少ない。ここから「一般戦だけ買う」と決める前に、');
    console.log('     先に条件を書いてから足すレースで確かめること。');

    /* 2026-10-24に先に書いた判定。
       当て方（的中率・市場との差）は一般級がはっきり上だが、
       回収率はそうでもない。一般級の116%も、いちばん大きい1件を除くと93%。
       当たりやすいレースは配当も安い、というだけかもしれない。
       「一般戦だけ買う」を採るかどうかは、ここから足すレースで決める。
       下の名前はその時点で持っていた55件。 */
    const PREREG_CLASS_NAMES = new Set([
      /* 2026-10-24に追加した若松1R〜10R。判定の対象には入れない。
         理由：同じ日・同じ水面の11R・12Rを先に見て、そこから判定⑤⑥を書いた。
         同じ日の残りは、天候も水面も出走選手も重なっていて、独立した前向きの
         材料ではない。これを判定に使うと、自分で見た日で自分の仮説を採点する
         ことになる。だから凍結側に入れる。
         （判定④については、これらを入れれば一般級の件数は一気に増えるが、
           同じ理由で入れない。件数を早く揃えることより、独立性のほうが大事。） */
      '若松1R 一般戦(10/24)',
      '若松2R 一般戦(10/24)',
      '若松3R 一般戦(10/24)',
      '若松4R 一般戦(10/24)',
      '若松5R 進入固定戦隊(10/24)',
      '若松6R 一般戦(10/24)',
      '若松7R 一般戦(10/24)',
      '若松8R エイトビート(10/24)',
      '若松9R 準優勝戦(10/24)',
      '若松10R 準優勝戦(10/24)',
      '若松12R 一般特選(10/23)',
      '若松11R 予選特選(10/23)',
      '尼崎4R 予選(10/23)',
      '尼崎2R 予選(10/23)',
      '平和島4R 予選(10/23)',
      '若松9R 予選(10/23)',
      '唐津6R 予選(10/21)',
      '唐津5R 予選(10/21)',
      '唐津4R 予選(10/21)',
      '唐津3R 予選(10/21)',
      '唐津2R 予選(10/21)',
      '唐津1R 予選(10/21)',
      '唐津12R 予選(10/20)',
      '唐津11R 予選(10/20)',
      '唐津10R 予選(10/20)',
      '唐津9R 予選(10/20)',
      '唐津8R 予選(10/20)',
      '唐津6R 予選(10/20)',
      '唐津7R 予選(10/20)',
      '唐津4R 予選(10/20)',
      '唐津5R 予選(10/20)',
      '唐津3R 予選(10/20)',
      '唐津2R 予選(10/20)',
      '唐津1R 予選(10/20)',
      '大村12R 発祥地選抜',
      '若松11R 準優勝戦',
      '若松10R 準優勝戦',
      '桐生8R 女子',
      '桐生9R 男子',
      '桐生12R 特選',
      '徳山1R 一般',
      '徳山2R 特選',
      '徳山3R 特賞',
      '徳山4R 予選',
      '徳山5R 予選',
      '徳山6R 予選',
      '三国1R 一般',
      '三国3R 一般',
      '三国5R 一般',
      '三国6R 一般',
      '三国7R 一般',
      '三国8R 一般',
      '三国9R 一般',
      '三国10R 準優勝戦',
      '三国11R 準優勝戦',
      '三国12R 準優勝戦',
      '下関1R 予選',
      '徳山1R 朝トク予選',
      '下関2R 予選',
      '徳山2R 狙いトク特選',
      '徳山3R 決めトク特賞',
      '徳山4R ガチトク予選',
      '徳山5R 予選 4日目',
      '下関10R 予選特賞',
      '下関11R 予選特選',
    ]);
    {
      const fwd = RACES.filter(r=>!PREREG_CLASS_NAMES.has(r.name)
                                && r.pay && r.B.filter(b=>b.g==='A1').length<=1);
      console.log('\n  【判定・2026-10-24に先に書いた】一般級（A1が0〜1人）だけ買うか');
      if(fwd.length < 20){
        console.log(`    これから足す一般級のレースで判定する。いま ${fwd.length}/20 件。`);
        console.log('    20件たまった時点で、その20件だけを見て');
        console.log('      ・上位10点の回収率が100%以上');
        console.log('      ・いちばん大きい払戻の1件を除いても100%以上');
        console.log('    の両方を満たしたら「一般級だけ買う」を採る。満たさなければ採らない。');
        console.log('    条件はこれだけ。あとから緩めない。');
      }else{
        const sel = fwd.slice(0,20).map(r=>({r, x:base[idx.get(r.name)]})).filter(o=>o.x);
        const inv = 100*10*sel.length;
        const hit = sel.filter(o=>o.x.rank<=10);
        const ret = hit.reduce((a,o)=>a+o.r.pay,0);
        const top = hit.length ? Math.max(...hit.map(o=>o.r.pay)) : 0;
        const c1 = ret/inv >= 1, c2 = (ret-top)/inv >= 1;
        console.log('    判定に使う20レース（この判定を書いたあと最初に足した20件）で測った。');
        console.log(`    ${c1?'○':'×'} 回収率100%以上              ${Math.round(ret/inv*100)}%`);
        console.log(`    ${c2?'○':'×'} 最大の1件を除いても100%以上  ${Math.round((ret-top)/inv*100)}%`);
        console.log(c1&&c2 ? '    → 2つとも満たした。一般級だけ買う。'
                           : '    → 欠けたので捨てる。レースの選び方は変えない。');
      }
    }
  }

  console.log('\n=== 展示の情報は、読みを良くしているのか ===');
  {
    const stripped = RACES.map(r=>({ ...r,
      B: r.B.map(b=>({ ...b, exST:null, exT:null, exF:null })) }));
    const off = runWith({}, null, {races:stripped});
    const line = (a)=> {
      const ranks = a.map(x=>x.rank);
      const avg = ranks.reduce((s,c)=>s+c,0)/ranks.length;
      return `平均順位 ${avg.toFixed(1)}  6点${ranks.filter(x=>x<=6).length}/${ranks.length}`
           + ` 12点${ranks.filter(x=>x<=12).length}/${ranks.length}`
           + ` 19点${ranks.filter(x=>x<=19).length}/${ranks.length}`;
    };
    console.log('  展示あり（いまのまま）  ' + line(base));
    console.log('  展示なし（3項目を落とす）' + line(off));
    const up = base.filter((x,i)=> x.rank < off[i].rank).length;
    const dn = base.filter((x,i)=> x.rank > off[i].rank).length;
    console.log(`  展示を入れて順位が上がったレース ${up}件 / 下がった ${dn}件 / 変わらず ${base.length-up-dn}件`);
    console.log('  ※ 平均順位は1回の大外しで動く。6点・12点・19点の的中数のほうを見ること。');
  }

  console.log('\n=== 展示でフライングした艇は、本番で沈むのか ===');
  {
    const rows = [];
    for(const r of RACES){
      const top3 = String(r.result).split('-').map(Number);
      r.B.forEach((b,i)=>{
        const lane = i+1;
        rows.push({ lane, f: !!b.exF, in3: top3.includes(lane) });
      });
    }
    const show = (label, list) => {
      if(!list.length){ console.log(`  ${label.padEnd(22)} 0件`); return; }
      const f  = list.filter(x=>x.f), nf = list.filter(x=>!x.f);
      const pct = a => a.length ? (a.filter(x=>x.in3).length/a.length*100).toFixed(1)+'%' : '—';
      console.log(`  ${label.padEnd(22)}`
        + `展示F ${String(f.length).padStart(3)}艇 → 3着以内 ${pct(f).padStart(6)}`
        + `   /   F無し ${String(nf.length).padStart(3)}艇 → ${pct(nf).padStart(6)}`);
    };
    console.log('  3着以内に入った割合を、展示Fの有無で比べる。');
    console.log('  （枠によってFの出やすさも3着以内の入りやすさも違うので、枠でも分けて見る）\n');
    show('全体', rows);
    show('1号艇', rows.filter(x=>x.lane===1));
    show('2・3号艇', rows.filter(x=>x.lane===2||x.lane===3));
    show('4〜6号艇', rows.filter(x=>x.lane>=4));
    const f = rows.filter(x=>x.f), nf = rows.filter(x=>!x.f);
    const d = (f.filter(x=>x.in3).length/f.length - nf.filter(x=>x.in3).length/nf.length)*100;
    console.log(`\n  全体の差 ${d>=0?'+':''}${d.toFixed(1)}pt（プラスなら「展示Fした艇のほうがよく3着以内に入っている」）`);
    console.log('  採点では展示Fに -3点 を入れている。上の差がマイナスでなければ、その根拠は弱い。');
    console.log('  ただし枠ごとの件数が少ないうちは、ここから重みを動かさないこと。');
  }

  console.log('\n=== 「誰が絡むか」と「どの順番か」を分けて見る ===');
  console.log('  モデルの採点上位3艇が、実際の上位3着とそのまま同じ顔ぶれだったか。');
  console.log('  順番は問わない。3連単で外していても、顔ぶれが合っているなら');
  console.log('  外しているのは順番だけ、ということになる。\n');
  {
    let setHit = 0, exact = 0, n = 0, head = 0;
    const rows = [];
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      if(!x.order) continue;
      n++;
      const top3 = x.order.slice(0,3).map(o=>Number(o[0]));
      const real = R.result.split('-').map(Number);
      const same = top3.slice().sort().join() === real.slice().sort().join();
      const ex = top3.join() === real.join();
      if(same) setHit++;
      if(ex) exact++;
      if(top3[0] === real[0]) head++;
      rows.push({ name:R.name, model:top3.join('-'), real:R.result, same, ex });
    }
    if(!n){ console.log('  detail なしで走っているので測れない'); }
    else {
      console.log('  レース                 モデル上位3  実際     顔ぶれ  並びまで');
      rows.forEach(r=>console.log(`  ${r.name.padEnd(20)}${r.model.padEnd(12)}${r.real.padEnd(9)}`+
        `${r.same?'○':'×'}      ${r.ex?'○':'×'}`));
      console.log(`\n  顔ぶれが合った  ${setHit}/${n} (${(setHit/n*100).toFixed(0)}%)`);
      console.log(`  並びまで合った  ${exact}/${n} (${(exact/n*100).toFixed(0)}%)`);
      console.log(`  頭だけ合った    ${head}/${n} (${(head/n*100).toFixed(0)}%)`);
      console.log('\n  参考: でたらめに3艇選んで顔ぶれが合う確率は 1/20 = 5%、');
      console.log('        顔ぶれが合ったうえで並びまで合う確率は 1/6 = 17%。');
      if(setHit/n > 0.2 && exact/setHit < 0.5)
        console.log('  → 顔ぶれは当てられているが、並べ方で落としている。');
    }
  }

  console.log('\n=== 番組表だけで分かること（級別の並び） ===');
  console.log('  1日の番組表に載っているのは、レース番号・締切・選手名・級別だけ。');
  console.log('  そこから「荒れそうなレース」を選べるかを測る。');
  console.log('  狙いは穴だったが、出てきた答えは逆だった。\n');
  {
    const P = [];
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name); if(!R.pay) continue;
      const map = ODDS[R.name];
      let topMk = null;
      if(map && Object.keys(map).length===120){
        const ks = Object.keys(map), mk = [];
        for(let a=1;a<=6;a++) mk.push(ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t+0.75/map[k],0));
        const nn = mk.reduce((a,c)=>a+c,0); topMk = Math.max(...mk)/nn;
      }
      P.push({ name:R.name, pay:R.pay, rank:x.rank, topMk,
               outA: R.B.slice(2).some(b=>b.g==='A1'||b.g==='A2') });
    }
    const med = a => { const q=a.slice().sort((x,y)=>x-y);
      return q.length%2 ? q[(q.length-1)/2] : (q[q.length/2-1]+q[q.length/2])/2; };
    const hi = P.filter(r=>r.outA), lo = P.filter(r=>!r.outA);
    const line = (label,a) => {
      if(!a.length){ console.log(`  ${label.padEnd(16)}0件`); return; }
      console.log(`  ${label.padEnd(16)}${String(a.length).padStart(2)}件  `+
        `配当の中央値 ¥${String(med(a.map(r=>r.pay))).padStart(6)}  `+
        `モデルの平均順位 ${(a.reduce((s,r)=>s+r.rank,0)/a.length).toFixed(1).padStart(5)}番目`);
    };
    line('外にA級あり', hi);
    line('外にA級なし', lo);

    /* 市場がすでに織り込んでいるかを見る。
       織り込んでいるなら、この情報で先回りはできない。 */
    const wk = P.filter(r=>r.topMk!=null);
    const avg = a => a.length ? (a.reduce((s,r)=>s+r.topMk,0)/a.length*100).toFixed(1) : '—';
    console.log(`\n  市場の1番人気の確率  外にA級あり ${avg(wk.filter(r=>r.outA))}%  /  `+
                `外にA級なし ${avg(wk.filter(r=>!r.outA))}%`);
    console.log('  → 市場は「外にA級がいると荒れる」をすでに値段に入れている。');
    console.log('     番組表で気づけることは、オッズにもう書いてある。');

    /* 買ったらどうなるか。ここが本番。 */
    const ret = (a,n) => { let inv=0, r=0, h=0;
      for(const x of a){ inv += 100*n; if(x.rank<=n){ r += x.pay; h++; } }
      return { rate: inv ? r/inv*100 : 0, h, n:a.length }; };
    console.log('\n  買った場合の回収率');
    console.log('    点数   外にA級あり        外にA級なし');
    for(const n of [6,10,12]){
      const a = ret(hi,n), b = ret(lo,n);
      console.log(`    ${String(n).padStart(2)}点   ${a.rate.toFixed(0).padStart(4)}% (${a.h}/${a.n})`+
                  `        ${b.rate.toFixed(0).padStart(4)}% (${b.h}/${b.n})`);
    }
    console.log('    → 荒れそうなレースを選ぶと、モデルがいちばん当てられないレースを買うことになる。');

    /* 「外にA級なし」だけを6点で買った場合を、いつもの3段階で検定する。 */
    {
      const n = 6;
      const d = lo.map(r=>({ name:r.name, v:(r.rank<=n?r.pay:0) - 100*n }));
      const inv = d.length*100*n;
      const tot = d.reduce((s,x)=>s+x.v,0);
      const top2 = [...d].sort((a,b)=>b.v-a.v).slice(0,2);
      const restInv = (d.length-2)*100*n;
      const restRet = restInv + (tot - top2.reduce((s,x)=>s+x.v,0));
      let win=0; const N=20000;
      for(let i=0;i<N;i++){ let t=0;
        for(let j=0;j<d.length;j++) t += d[Math.floor(Math.random()*d.length)].v;
        if(t>0) win++; }
      const pct = win/N*100;
      console.log(`\n  「外にA級なし」を6点で買った場合（${d.length}レース）`);
      console.log(`    回収率 ${((tot+inv)/inv*100).toFixed(0)}%`);
      console.log(`    いちばん効いた2レースを除くと ${restInv>0?(restRet/restInv*100).toFixed(0):'—'}%`);
      console.log(`    引き直してプラスになる割合 ${pct.toFixed(0)}%`);
      if(d.length < 20){
        console.log(`\n    ※ まだ${d.length}レース。引き直しが高く出ても、それは`);
        console.log('       「この数レースが揃っていた」という意味しかない。');
        console.log('       見ていないレースについては何も言えない。');
      }
      console.log('\n    【先に決めておく】');
      console.log('    「外にA級なし」が20レースそろった時点で、6点均等が');
      console.log('      ・回収率100%以上');
      console.log('      ・いちばん効いた2レースを除いても100%以上');
      console.log('      ・引き直してプラスになる割合が95%以上');
      console.log('    の3つすべてを満たしていたら、条件として採用する。');
      console.log('    1つでも欠けたら捨てる。（結果を見てから基準を決めないため）');
      const needed = Math.max(0, 20 - d.length);
      if(needed) console.log(`    あと${needed}レース。`);
    }
  }

  console.log('\n=== 当地勝率は効いているか ===');
  console.log('  1号艇の当地勝率で全レースを半分に割り、実際の勝率とモデルの見方を比べる。');
  console.log('  当地の記録が無い艇（loc が null）は対象外。\n');
  {
    const rows = [];
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const b1 = R.B[0];
      if(b1.loc == null) continue;
      rows.push({ loc:b1.loc, won:Number(R.result.split('-')[0])===1,
                  p:Object.keys(x.probOf).filter(k=>k[0]==='1')
                          .reduce((t,k)=>t + x.probOf[k], 0) });
    }
    rows.sort((a,b)=>a.loc-b.loc);
    const half = Math.floor(rows.length/2);
    const lo = rows.slice(0, half), hi = rows.slice(half);
    const show = (label, a) => {
      const w = a.filter(x=>x.won).length;
      console.log(`  ${label.padEnd(24)}実際に1着 ${w}/${a.length} (${(w/a.length*100).toFixed(0)}%)`+
        `   モデルの平均 ${(a.reduce((t,x)=>t+x.p,0)/a.length*100).toFixed(1)}%`);
    };
    show(`当地が低い${lo.length}レース（〜${lo[lo.length-1].loc.toFixed(2)}）`, lo);
    show(`当地が高い${hi.length}レース（${hi[0].loc.toFixed(2)}〜）`, hi);
    const wl = lo.filter(x=>x.won).length/lo.length, wh = hi.filter(x=>x.won).length/hi.length;
    const pl = lo.reduce((t,x)=>t+x.p,0)/lo.length, ph = hi.reduce((t,x)=>t+x.p,0)/hi.length;
    console.log(`\n  実際の差 ${((wh-wl)*100>=0?'+':'')}${((wh-wl)*100).toFixed(0)}pt   `+
                `モデルが付けている差 ${((ph-pl)*100>=0?'+':'')}${((ph-pl)*100).toFixed(1)}pt`);
    if(wh <= wl && ph > pl + 0.05){
      console.log('  → 実際には差が出ていないのに、モデルは大きな差を付けている。');
    }

    /* 効いていないように見えても、重みを下げた結果を測るまで動かさない。
       展示STのときは相関0.11でも下げると悪くなった。 */
    console.log('\n  当地の重みを下げたらどうなるか（減らしたぶんは全国勝率へ回す）');
    console.log('    設定                        1着の対数  平均順位  6点     12点');
    const L0 = 0.08, N0 = 0.11;
    const showW = (label, patch) => {
      const r2 = runWith(patch, null, {});
      const st = summarize(r2);
      const a = [];
      for(const y of r2){
        const R2 = RACES.find(q=>q.name===y.name); const m2 = ODDS[R2.name];
        if(!m2 || Object.keys(m2).length !== 120) continue;
        const w2 = Number(R2.result.split('-')[0]);
        a.push(Object.keys(y.probOf).filter(k=>k[0]===String(w2))
                     .reduce((t,k)=>t + y.probOf[k], 0));
      }
      const l = a.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0)/a.length;
      console.log(`    ${label.padEnd(26)}${l.toFixed(3).padStart(8)}  `+
        `${st.avg.toFixed(1).padStart(7)}  ${st.in6}/${st.n}   ${st.in12}/${st.n}`);
    };
    showW('いまのまま local 0.08', {});
    for(const v of [0.04, 0]) showW(`local ${v.toFixed(2)} / national ${(L0+N0-v).toFixed(2)}`,
                                    { local:v, national:L0+N0-v });
    console.log('');
    console.log('    【先に決めておく】いまは変えない。差が小さすぎて件数の中に埋もれている。');
    console.log('    40レースそろった時点で、local 0.04 が 0.08 より');
    console.log('      ・1着の対数が良い');
    console.log('      ・3連単の12点的中が落ちていない');
    console.log('    の両方を満たしていたら 0.04 に下げる。満たさなければ据え置く。');
    console.log('    （結果を見てから基準を決めないために、先に書いておく）');
  }

  console.log('\n=== 市場と食い違ったレースは儲かるのか ===');
  {
    const withOdds = base.filter(x=>ODDS[x.name]);
    if(withOdds.length){
      console.log('  1着の確率をモデルと市場で比べ、いちばん離れた艇の差（pt）を出す。');
      console.log('  「市場が見落としている情報をモデルが見ている」なら、差の大きいレースが儲かるはず。\n');
      console.log('  レース          最大の差  その艇  モデル  市場   実際  期待値で買った結果');
      for(const x of withOdds){
        const O = ODDS[x.name];
        const win = Number(x.result.split('-')[0]);
        let top = null;
        for(let a=1;a<=6;a++){
          const mk = Object.keys(O).filter(k=>k[0]===String(a)).reduce((s2,k)=>s2+0.75/O[k],0);
          const mp = allCombos.reduce((s2,k)=>s2 + (k[0]===String(a) ? x.probOf[k] : 0), 0);
          const d = Math.abs(mp-mk);
          if(!top || d>top.d) top = { a, d, mp, mk };
        }
        /* 期待値1.10以上・確率2%以上で買っていたら、いくらになったか */
        const picks = allCombos.map(k=>({k, p:x.probOf[k], o:O[k], ev:x.probOf[k]*O[k]}))
          .filter(c=>c.p>=0.02 && c.ev>=1.10).sort((a,b)=>b.ev-a.ev).slice(0,12);
        const hit = picks.find(c=>c.k===x.result);
        /* 1点あたりは100円単位に丸める。実際に出す金額は「丸めた単価×点数」で、
           予算1,200円ではない。以前はここで予算をまるごと使ったことにしていて、
           買っていない分まで損に数えていた（8点なら800円しか出していないのに
           1,200円払ったことになっていた）。 */
        const unit = picks.length ? Math.max(100, Math.floor(1200/picks.length/100)*100) : 0;
        const spend = unit * picks.length;
        const back = hit ? x.pay/100*unit : 0;
        console.log(`  ${x.name.padEnd(12)} ${top.d>=0 ? (top.d*100).toFixed(1).padStart(5) : ''}pt  ${top.a}号艇  `+
          `${(top.mp*100).toFixed(1).padStart(5)}% ${(top.mk*100).toFixed(1).padStart(5)}%  ${win}号艇  `+
          `${picks.length}点 ${hit?'的中':'不的中'} ${String(back-spend).padStart(6)}円`);
      }
      console.log('\n  ※ 差が大きくても、賭けているのが2着3着の並びなら当たらない。');
      console.log('     モデルが市場より正しかったレース（三国3R）でも、買った点は全部外れている。');
      {
        let inv=0, ret=0, hits=0, n=0;
        for(const x of withOdds){
          const O = ODDS[x.name];
          const picks = allCombos.map(k=>({k, p:x.probOf[k], o:O[k], ev:x.probOf[k]*O[k]}))
            .filter(c=>c.p>=0.02 && c.ev>=1.10).sort((a,b)=>b.ev-a.ev).slice(0,12);
          if(!picks.length) continue;
          n++;
          const unit = Math.max(100, Math.floor(1200/picks.length/100)*100);
          inv += unit*picks.length;
          const hit = picks.find(c=>c.k===x.result);
          if(hit){ ret += x.pay/100*unit; hits++; }
        }
        console.log(`\n  期待値方式の通算  ${n}レース  投資${inv.toLocaleString()}円  `+
          `払戻${ret.toLocaleString()}円  回収率${(ret/inv*100).toFixed(0)}%  的中${hits}/${n}`);
      }
    }
  }

  console.log('\n=== 手書き補正の点検 ===');
  console.log('  採点の重み(W)と違い、下の補正は結果から決めたものではなく手で書いた値。');
  console.log('  何件に当たっていて、外すと順位がどう動くかを毎回ここで見る。\n');
  const allB = [].concat(...RACES.map(r=>r.B.map(b=>({...b, ws:r.ws, wave:r.wave, wind:r.wind}))));
  const counts = [
    ['F持ち',            allB.filter(b=>b.F).length,       'if(b.flagF)  bump(', 'if(false)  bump('],
    ['L持ち',            allB.filter(b=>b.L).length,       null, null],
    ['展示F',            allB.filter(b=>b.exF).length,
      '  if(b.exhibitionSTFlag)\n    bump(-3,', '  if(false)\n    bump(-3,'],
    ['チルト0.5以上',      allB.filter(b=>b.tilt>=0.5).length,
      'if(crs>=4) bump(+3.0,', 'if(false) bump(+3.0,'],
    ['部品交換',          allB.filter(b=>b.parts).length,   'if(b.partsChange) bump(', 'if(false) bump('],
    ['進入変更（内へ/外へ）',
      [].concat(...RACES.map(r=>r.B.filter((b,i)=>b.entry && b.entry!==i+1))).length,
      '  if(b.entryCourse){\n    if(crs > b.lane)', '  if(false){\n    if(crs > b.lane)'],
    ['風（風速4m以上）',    allB.filter(b=>b.ws>=4 && b.wind).length, null, null],
    ['波（波高5cm以上）',   allB.filter(b=>b.wave>=5).length,
      '  if(wv!==null && wv>=5){', '  if(false){'],
    ['潮',               0,                                null, null],
  ];
  const baseRanks = base.map(r=>r.rank);
  const fmt = r => `[${r.map(x=>String(x).padStart(3)).join(' ')}] 平均${(r.reduce((a,c)=>a+c,0)/r.length).toFixed(1)} `+
                   `12点${r.filter(x=>x<=12).length}/${r.length}`;
  console.log(`  ${'補正'.padEnd(18)}該当   外した場合`);
  console.log(`  ${'（いまのまま）'.padEnd(17)}  —   ${fmt(baseRanks)}`);
  for(const [name, n, find, repl] of counts){
    if(n === 0){
      console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  一度も発動していない（検証できない）`);
      continue;
    }
    if(!find){ console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  外し方を用意していない`); continue; }
    const patched = HTML.split(find).join(repl);
    if(patched === HTML){ console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  該当箇所が見つからない（コードが変わった？）`); continue; }
    console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  ${fmt(runWith({},null,{html:patched}).map(r=>r.rank))}`);
  }

  /* 2026-10-23に先に書いた判定。
     「F持ちを外したほうが平均順位が良い」はずっと同じ向きに出ているが、
     この表は設定を選んだのと同じレースで測った数字なので根拠にならない。
     ここから足すレースだけで判定する。下の名前はその時点で持っていた34件。 */
  const PREREG_F_NAMES = new Set([
      '唐津3R 予選(10/20)',
      '唐津2R 予選(10/20)',
      '唐津1R 予選(10/20)',
      '大村12R 発祥地選抜',
      '若松11R 準優勝戦',
      '若松10R 準優勝戦',
      '桐生8R 女子',
      '桐生9R 男子',
      '桐生12R 特選',
      '徳山1R 一般',
      '徳山2R 特選',
      '徳山3R 特賞',
      '徳山4R 予選',
      '徳山5R 予選',
      '徳山6R 予選',
      '三国1R 一般',
      '三国3R 一般',
      '三国5R 一般',
      '三国6R 一般',
      '三国7R 一般',
      '三国8R 一般',
      '三国9R 一般',
      '三国10R 準優勝戦',
      '三国11R 準優勝戦',
      '三国12R 準優勝戦',
      '下関1R 予選',
      '徳山1R 朝トク予選',
      '下関2R 予選',
      '徳山2R 狙いトク特選',
      '徳山3R 決めトク特賞',
      '徳山4R ガチトク予選',
      '徳山5R 予選 4日目',
      '下関10R 予選特賞',
      '下関11R 予選特選',
  ]);
  {
    const patched = HTML.split('if(b.flagF)  bump(').join('if(false)  bump(');
    if(patched === HTML){
      console.log('\n  【判定・F持ち】該当箇所が見つからない（コードが変わった？）');
    } else {
      const off = runWith({},null,{html:patched});
      const fwdBase = base.filter(x=>!PREREG_F_NAMES.has(x.name));
      const fwdOff  = off .filter(x=>!PREREG_F_NAMES.has(x.name));
      const avg = a => a.length ? a.reduce((s,r)=>s+r.rank,0)/a.length : null;
      const in12 = a => a.filter(r=>r.rank<=12).length;
      console.log('\n  【判定・2026-10-23に先に書いた】F持ちの減点を半分にするか');
      if(fwdBase.length < 15){
        console.log('    これから足すレースで判定する。いま ' + fwdBase.length + '/15 レース。');
        if(fwdBase.length){
          console.log('    （参考）そのレースだけで  いまのまま 平均' + avg(fwdBase).toFixed(1) +
                      ' 12点' + in12(fwdBase) + '/' + fwdBase.length +
                      '  /  外すと 平均' + avg(fwdOff).toFixed(1) +
                      ' 12点' + in12(fwdOff) + '/' + fwdOff.length);
        }
        console.log('    15件たまった時点で、その15件だけを見て');
        console.log('      ・F持ちを外したほうが平均順位が良い');
        console.log('      ・12点の的中数が落ちていない');
        console.log('    の両方を満たしたら、減点を半分にする。満たさなければ据え置く。');
        console.log('    条件はこれだけ。あとから緩めない。');
      }else{
        /* 判定する側の15件だけを使う。あとから足したレースで薄めないよう、
           先頭15件（＝判定を書いたあと最初に足した15レース）に固定する。 */
        const by = a => [...a].sort((x,y)=> x.name < y.name ? -1 : 1);
        const base15 = fwdBase.slice(0, 15);
        const names15 = new Set(base15.map(x=>x.name));
        const off15 = fwdOff.filter(x=>names15.has(x.name));
        const c1 = avg(off15) < avg(base15);
        const c2 = in12(off15) >= in12(base15);
        console.log('    判定に使う15レース（この判定を書いたあと最初に足した15件）で測った。');
        console.log(`    ${c1?'○':'×'} 外したほうが平均順位が良い   外すと ${avg(off15).toFixed(1)} / いま ${avg(base15).toFixed(1)}`);
        console.log(`    ${c2?'○':'×'} 12点の的中数が落ちていない   外すと ${in12(off15)}/15 / いま ${in12(base15)}/15`);
        console.log(c1 && c2
          ? '    → 2つとも満たした。F持ちの減点を半分にする。'
          : '    → 欠けたので捨てる。F持ちの減点はいまのままにする。');
        if(fwdBase.length > 15)
          console.log(`    （判定後に足した ${fwdBase.length-15} レースは、この判定には入れない）`);
      }
    }
  }
  console.log('\n  外したほうが平均が良くなる補正は、値が大きすぎる可能性がある。');
  console.log('  ただし12点の的中数が変わらないなら、8レース程度では偶然の幅。すぐには変えないこと。');

  console.log('\n=== 当地勝率が無い選手（初出走）の扱い ===');
  console.log('  当地の重み 0.08（既定） '+line(summarize(runWith({}))));
  [0.06,0.04,0.02].forEach(v=>{
    console.log(`  当地の重み ${v.toFixed(2)}          `+
      line(summarize(runWith({local:v, national:0.11+(0.08-v)}))));
  });

  if(PENDING.length){
    console.log('\n=== 結果まちのレース（モデルの買い目と、市場との見方の差） ===');
    console.log('  結果が出たら pending.js から RACES へ移す。');
    /* 2026-10-23に起きたこと：若松11Rの予想を出すとき、使い捨てのスクリプトを
       書いてモデルを呼んだ。そこで項目名を averageST→avgST、b.flagF→flyingCount と
       取り違えており、平均STとF数がモデルに届かないまま採点していた。
       買い目は19点中17点しか合っておらず、確率も 12.22%→7.92% とずれていた。
       同じことを繰り返さないよう、買い目はここ（runWith を通る唯一の道）で出す。
       使い捨てのスクリプトでモデルを呼ばないこと。 */
    const res = runWith({},null,{races:PENDING, detail:true});
    res.forEach((r,i)=>{
      const R = PENDING[i];
      const map = ODDS[R.name];
      console.log(`\n  ${R.name}`);
      console.log(`  モデルの並び  ${r.order.join(' ')}`);
      {
        const sorted = Object.entries(r.probOf).sort((a,b)=>b[1]-a[1]);
        const head = {};
        for(const [k,v] of sorted) head[k[0]] = (head[k[0]]||0) + v;
        console.log('  1着確率（モデル）  ' + [1,2,3,4,5,6]
          .map(n=>`${n}号艇 ${((head[n]||0)*100).toFixed(1)}%`).join(' / '));
        console.log(`  至極の一点  ${sorted[0][0]}（${(sorted[0][1]*100).toFixed(2)}%）`);
        console.log('  確率順  ' + sorted.slice(0,19).map(([k,v],i)=>(i+1)+'.'+k+' '+(v*100).toFixed(1)+'%').join('  '));
        /* 2026-10-24に決めた買い方。至極の一点 / 本線10点 / 波乱8点 の3段で出す。
           形を決めるのは index.html の buyPlan() 一箇所だけ。ここでは呼ぶだけにする。
           57レースだったころの実測は 本線10点130% / 波乱8点だけ26% / 合わせて18点84%
           （当時の点数。いまの数字は下の行が出す）。
           波乱を足すと回収率は下がる。それを承知で買う形なので、毎回ここに書く。 */
        const plan = WIN.buyPlan(Object.entries(r.probOf).map(([combo,p])=>({combo,p})),
                                 );
        const fmt = list => { const c = WIN.compressCombos(list);
          return (c && c.ok) ? c.terms.map(t=>t.text).join(' / ') : list.join(' '); };
        const pc = k => ((r.probOf[k]||0)*100).toFixed(1) + '%';
        console.log('  ── 買い目 ──');
        console.log(`  至極の一点  ${plan.best}（${pc(plan.best)}）`);
        console.log(`  本線${plan.main.length}点    ${fmt(plan.main)}`);
        console.log(`  波乱 ${plan.ana.length}点    ${fmt(plan.ana)}`);
        console.log(`              （${plan.favourite}号艇が飛んだ場合に限った確率の上位。`+
                    `本線とは重ならない）`);
        console.log(`  合計 ${plan.all.length}点＝1点100円で ¥${(plan.all.length*100).toLocaleString()}。`+
                    `至極の一点は本線${plan.main.length}点の中に入っている（別枠ではない）。`);
        /* 数字は node sync-figures.js が書き換える（下の規則が見ている）。
           見出しは点数から作る。両方を書き写すと、点数を変えた日に
           「本線10点 71%」と出しながら中身は6点、という状態になる。
           PCT_MAIN のような変数にしようとして未定義のまま置いてしまい、
           結果待ちのレースがある日に落ちる状態を作った（ここで気づいた）。 */
        console.log(`  実測 ${L_MAIN}82% ／ ${L_ANA}だけ132% ／ ${PTS_ALL}点まとめて102%（769レース）。`);
      }
      if(!map){ console.log('  実オッズが odds.js に無いので市場とは比べられない'); return; }
      const ks = Object.keys(map);
      if(ks.length !== 120){ console.log(`  オッズが${ks.length}通りしかない（120通り必要）`); return; }
      const mk = {}, md = {};
      for(let a=1;a<=6;a++){
        mk[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + 0.75/map[k], 0);
        md[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + (r.probOf[k]||0), 0);
      }
      console.log('  1着確率   ' + [1,2,3,4,5,6]
        .map(n=>`${n}号艇 モデル${(md[n]*100).toFixed(1)}% 市場${(mk[n]*100).toFixed(1)}%`).join('\n            '));
      let gap = 0, gl = 0;
      for(let n=1;n<=6;n++){ const d=Math.abs(md[n]-mk[n]); if(d>gap){ gap=d; gl=n; } }
      console.log(`  一番食い違う艇  ${gl}号艇（${((md[gl]-mk[gl])*100>0?'+':'')}${((md[gl]-mk[gl])*100).toFixed(1)}pt）`);
      /* 2026-10-25 多摩川8R の失敗を繰り返さないための注意書き。
         締切15分前のオッズで「市場と+17.3pt 食い違う」と書いたが、
         締切時の市場はモデルとほぼ同じだった。食い違いはオッズの取得時刻が
         作っていただけ。予想時には締切前の値しか無いので、毎回ここに出す。 */
      {
        const L = ODDS_LIVE[R.name];
        const min = L ? L.minutes : null;
        const gap = Math.abs((md[gl]-mk[gl])*100);
        console.log('  ※ このオッズは締切前のライブ値です' +
          (min!=null ? `（締切${min}分前）` : '（何分前かは odds-live.js に未記録）') + '。');
        console.log('    実測では、締切2分前で最大1.1pt、12〜15分前で最大15.9ptずれました。');
        /* ここは『4/4レース、平均+6.3pt』と固定で書いていた。レースを足しても
           書き換わらないので計算に変える。これまで同じ失敗を何度もしている。 */
        {
          const sh = (o,a)=>{ const t=Object.keys(o).reduce((s2,k)=>s2+0.75/o[k],0);
            return Object.keys(o).filter(k=>k[0]===String(a)).reduce((s2,k)=>s2+0.75/o[k],0)/t; };
          const ds=[];
          for(const nm of Object.keys(ODDS_LIVE)){
            const L=ODDS_LIVE[nm], fin=ODDS[nm]; if(!fin) continue;
            if(Object.keys(L.odds).length!==120 || Object.keys(fin).length!==120) continue;
            ds.push((sh(fin,1)-sh(L.odds,1))*100);
          }
          if(ds.length){
            const up=ds.filter(d=>d>0).length;
            const avg=ds.reduce((a,c)=>a+c,0)/ds.length;
            console.log(`    ずれは1号艇が上がる向きに偏ります（${up}/${ds.length}レース、`+
              `平均${avg>=0?'+':''}${avg.toFixed(1)}pt）。`);
          }
        }
        if(gap >= 8 && (min==null || min >= 5)){
          console.log(`    いまの食い違い ${gap.toFixed(1)}pt は、締切までの値動きで消える大きさです。`);
          console.log('    この差を読みの根拠にしないこと。');
        }
      }
      const best = ks.map(k=>({k, ev:(r.probOf[k]||0)*map[k], p:r.probOf[k]||0, o:map[k]}))
                     .filter(x=>x.p >= 0.02).sort((a,b)=>b.ev-a.ev).slice(0,3);
      console.log('  期待値の上位  ' + (best.length
        ? best.map(x=>`${x.k} ${x.o}倍 期待値${x.ev.toFixed(2)}`).join(' / ')
        : '確率2%以上の組が無い'));
    });
  }
}
module.exports={RACES,runWith,summarize};
