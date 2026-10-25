/* 1レース分の買い目を出すまでを1コマンドにする
   ==================================================================
     node predict.js <場コード> <レース番号> [日付YYYYMMDD]

   なぜ作ったか。
   これまで毎回、出走表を取る→展示を待つ→オッズを取る→pending.js に書く
   →backtest.js を走らせる、を手でやっていた。手順が多いと取りこぼす。
   実際、項目名の取り違え・配列の穴・締切15分前のオッズを市場の見方として
   読む、という間違いを全部やっている。

   買い目はオッズを使っていない（出走表と直前情報だけ）。
   なので展示が出た時点で出せる。実測では展示は締切12〜16分前に出るので、
   買い目は締切11〜15分前に渡せる。これが「10分前までに欲しい」の答え。

   オッズは市場との比較にしか使わない。そしてその比較は、買う判断には使えない。
   締切3分前に取ったオッズでも、締切時までに1号艇が +5.6pt 動いた（若松5R 10/25）。
   市場が落ち着くころにはもう買えない。だから比較は「あとで答え合わせをするための
   記録」であって、買い目を決める材料ではない。買い目はオッズを一切見ていない。

   モデルは backtest.js 経由でしか呼ばない（使い捨てのスクリプトで呼ばない）。
   ここがやるのは、取得と pending.js への書き込みと、出力の抜き出しだけ。 */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const F=require('./fetch.js');
const ROOT=__dirname;

const [,, jcdArg, rnoArg, hdArg, ...flags] = process.argv;
if(!jcdArg || !rnoArg){
  console.log('使い方: node predict.js <場コード> <レース番号> [日付YYYYMMDD]');
  console.log('  例:   node predict.js 20 5');
  process.exit(1);
}
const JCD = String(jcdArg).padStart(2,'0');
const RNO = Number(rnoArg);
const HD  = hdArg || new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
const NOW_ONLY = flags.includes('--now');

const jst = () => new Date(Date.now()+9*3600*1000);
const hhmm = d => String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0');
const log = (...a) => console.log(...a);

/* ---- 出走表と締切時刻 ------------------------------------------- */
const get = (page) => {
  const url=`https://www.boatrace.jp/owpc/pc/race/${page}?rno=${RNO}&jcd=${JCD}&hd=${HD}`;
  return execFileSync('curl',['-sS','--fail','--max-time','60','-A','Mozilla/5.0',url],
                      {encoding:'utf8', maxBuffer:32*1024*1024});
};
const listHtml = get('racelist');
const cells = F.cells(listHtml).filter(x=>x&&x!=='|');
const ti = cells.findIndex(x=>/締切予定時刻/.test(x));
const times = ti<0 ? [] : cells.slice(ti+1, ti+13).filter(x=>/^\d{1,2}:\d{2}$/.test(x));
const closeAt = times[RNO-1] || null;
const titleCell = cells.find(x=>/\d+m$/.test(x) && /戦|選/.test(x));
const title = titleCell ? titleCell.replace(/\s*\d+m$/,'') : '';

const minsLeft = () => {
  if(!closeAt) return null;
  const [h,m] = closeAt.split(':').map(Number);
  const n = jst();
  const close = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), h, m);
  return Math.round((close - n.getTime())/60000);
};

/* 場名は index.html の VENUES から取る（二重に持たない） */
const venueName = (()=>{
  try{
    const {JSDOM}=require('jsdom');
    const d=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),
      {runScripts:'dangerously', url:'https://ken5moai.github.io/',
       beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
    const V=d.window.eval('VENUES');
    return (V[JCD]||{}).name || JCD;
  }catch(e){ return JCD; }
})();
const NAME = `${venueName}${RNO}R ${title}(${Number(HD.slice(4,6))}/${Number(HD.slice(6,8))})`;

log(`${NAME}`);
log(`  締切 ${closeAt||'(読めず)'}　いま ${hhmm(jst())}　残り ${minsLeft()??'?'}分`);

/* ---- ここから：暫定 → 確定 の2段で出す ------------------------- */
/* while で回すとCPUを食い続けるので、外の sleep を使う。 */
const sleep = sec => { try{ execFileSync('sleep',[String(sec)]); }catch(e){} };

const boats = F.parseRacelist(listHtml);
if(boats.length!==6) throw new Error(`出走表から6艇ぶん取れなかった（${boats.length}艇）`);
const n = x => x==null ? 'null' : String(x);
const cell = v => (typeof v==='number' && isFinite(v)) ? String(v) : JSON.stringify(String(v));

/* pending.js / odds.js / odds-live.js へ書く。同じ名前があれば置き換える
   （二重登録と配列の穴を避ける）。暫定で一度書き、展示が出たら上書きする。 */
const write = (before, odds, oddsMin) => {
  const lines = boats.map((bt,i)=>{
    const L=i+1, bb=before.boats[i]||{}, e=before.exSt[L]||{};
    const rec='['+(bt.rec||[]).map(r=>'['+cell(r[0])+','+String(r[1]).replace(/^0/,'')+','+cell(r[2])+']').join(',')+']';
    return ` {reg:'${bt.reg}',g:'${bt.g}',nat:${bt.nat},loc:${bt.loc},mot:${bt.mot},bt:${bt.bt},`+
      `st:${bt.st},F:${bt.F},exST:${n(e.st)},exF:${e.f?"'F'":'null'},exT:${n(bb.exT)},`+
      `tilt:${n(bb.tilt)},wt:${n(bb.wt)},entry:${n(before.entry[L])},rec:${rec}}`;
  });
  const ex = before.boats.filter(x=>x.exT!=null).length;
  const block =
`{name:'${NAME}',jcd:'${JCD}',rno:${RNO},date:'${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)}',`+
`result:null,pop:null,pay:null,wind:null,ws:${n(before.ws)},wave:${n(before.wave)},temp:null,wtemp:null,
 /* ${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)} ${hhmm(jst())} JST、predict.js で取得（締切${closeAt}の${oddsMin}分前）。
    展示は${ex===6?'6艇ぶんそろっている':`${ex}艇ぶんしか出ていない（残りは欠測）`}。進入は展示進入。
    本番進入は使わない（先読みになる）。
    水面気象は直前情報ページの「${before.weatherLabel||'?'}」の値。結果ページが出たら差し替える。
    オッズは締切${oddsMin}分前のライブ値。レース後に締切時オッズへ取り直すこと。 */
 B:[
${lines.join(',\n')}]}`;
  let p=fs.readFileSync(path.join(ROOT,'pending.js'),'utf8');
  const at=p.indexOf(`{name:'${NAME}'`);
  if(at>=0){
    let end=p.indexOf("\n{name:'", at); if(end<0) end=p.lastIndexOf('\n];');
    p = p.slice(0,at) + block + p.slice(end);
  } else {
    p = p.replace(/\n\];\s*$/, ',\n'+block+'\n];\n');
  }
  fs.writeFileSync(path.join(ROOT,'pending.js'), p);
  delete require.cache[require.resolve(path.join(ROOT,'pending.js'))];
  const P=require(path.join(ROOT,'pending.js'));
  if(P.some(r=>!r)) throw new Error('pending.js に穴ができた');

  const upsertOdds = (file, wrap) => {
    let t=fs.readFileSync(path.join(ROOT,file),'utf8');
    const ks=Object.keys(odds);
    let body='';
    for(let a2=1;a2<=6;a2++) body += ' '+ks.filter(k=>k[0]===String(a2)).sort().map(k=>`'${k}':${odds[k]}`).join(',')+',\n';
    const blk = wrap(body);
    const at2 = t.indexOf(`  '${NAME}':`);
    if(at2>=0){
      const end2 = t.indexOf('},\n', t.indexOf("'6-", at2))+3;
      t = t.slice(0,at2) + blk + t.slice(end2);
    } else {
      t = t.replace(/module\.exports = \{\n/, 'module.exports = {\n'+blk);
    }
    fs.writeFileSync(path.join(ROOT,file), t);
  };
  upsertOdds('odds.js',      bd => `  '${NAME}': {\n`+bd.replace(/,\n$/,'},\n'));
  upsertOdds('odds-live.js', bd => `  '${NAME}': { minutes: ${oddsMin}, odds: {\n`+
                                  bd.split('\n').map(x=>x?' '+x:x).join('\n').replace(/,\n$/,'}},\n'));
};

/* モデルは backtest.js 経由でしか呼ばない。ここは出力を抜き出すだけ。 */
const show = (label, provisional) => {
  const out = execFileSync(process.execPath,[path.join(ROOT,'backtest.js')],
    {encoding:'utf8', maxBuffer:64*1024*1024});
  const i = out.indexOf(`  ${NAME}\n`);
  if(i<0){ log('※ backtest.js の出力にこのレースが見つかりません。'); return; }
  let j = out.indexOf('\n\n  ', i+1); if(j<0) j = out.length;
  log('');
  log(`──────── ${label} ────────`);
  console.log(out.slice(i, j));
  if(!provisional) return;
  /* 暫定がどれだけ悪いかは、backtest.js の節から読む（固定値で書かない）。 */
  const g = re => (out.match(re)||[])[1];
  const exPct = g(/確定（展示あり）本線10点\s+回収率\s*(\d+)%/);
  const noPct = g(/暫定（展示なし）本線10点\s+回収率\s*(\d+)%/);
  const headSame = (out.match(/1着に選ぶ艇が同じ\s+(\d+\/\d+)レース/)||[])[1];
  const topSame  = (out.match(/至極の一点が同じ\s+(\d+\/\d+)レース/)||[])[1];
  const lap      = (out.match(/本線10点の重なり\s+平均([\d.]+)\/10点/)||[])[1];
  if(exPct && noPct){
    log('  ※ これは展示の前に出した暫定です。実測では確定版よりはっきり悪くなります。');
    log(`     本線10点の回収率  確定${exPct}%  →  暫定${noPct}%`);
    if(headSame) log(`     1着に選ぶ艇は ${headSame} レースで同じ。至極の一点が同じなのは ${topSame}。`);
    if(lap)      log(`     本線10点の重なりは平均 ${lap}/10点。変わるのは2着3着の並びです。`);
    log('     買うなら展示を待ってください。暫定は下見用です。');
  }
};

/* 展示を待つあいだは beforeinfo だけを見る。
   以前はオッズも毎回取っていて、30秒おきに2本ずつ投げていた。
   公式に無駄な負荷をかけるうえ、使うのは最後の1回だけなので意味が無い。 */
const peek = () => {
  const bf = F.parseBefore(get('beforeinfo'));
  return {bf, min: minsLeft(), ready: bf.boats.filter(x=>x.exT!=null).length===6};
};
const grab = () => {
  const g = peek();
  const od = F.parseOdds(get('odds3t'));
  if(Object.keys(od).length!==120) throw new Error(`オッズが${Object.keys(od).length}通りしかない`);
  return {...g, od};
};

let g = grab();
log(`  展示 ${g.ready?'あり':'まだ（欠測のまま出します）'}　オッズ120通り（締切${g.min}分前）`);
write(g.bf, g.od, g.min);
show(g.ready ? `確定の買い目（締切${g.min}分前）` : `暫定の買い目（展示前・締切${g.min}分前）`, !g.ready);

if(!g.ready && !NOW_ONLY){
  log('');
  log('  展示が出たら確定版を出します（10分前になったら打ち切ります）。');
  while(!g.ready){
    const left = minsLeft();
    if(left!=null && left <= 10){
      log(`  ${left}分前になりました。展示は出ていないので、上の暫定が最終です。`);
      break;
    }
    sleep(30);
    const q = peek();
    log(`  ${hhmm(jst())} 展示=${q.ready?'出た':'まだ'}（残り${q.min??'?'}分）`);
    if(q.ready) g = grab();   /* 出たときだけオッズも取る */
    else g = {...g, ready:false, min:q.min};
  }
  if(g.ready){
    write(g.bf, g.od, g.min);
    show(`確定の買い目（展示あり・締切${g.min}分前）`, false);
  }
}
const oddsMin = g.min;

/* ---- 最後にひとこと ---------------------------------------------- */
log('');
log('※ 上の「市場」との比較は、買う判断には使えません。');
log(`   このオッズは締切${oddsMin}分前の値です。締切3分前に取った回でも、`);
log('   締切までに市場の1号艇が +5.6pt 動きました（若松5R 10/25）。');
log('   市場が落ち着くころにはもう買えないので、比較はあとの答え合わせ用です。');
log('   買い目はオッズを一切見ていないので、この点は買い目に影響しません。');
log(`※ レース後に  node fetch.js ${Number(JCD)} ${RNO} ${HD}  で締切時オッズと結果を取り直してください。`);
