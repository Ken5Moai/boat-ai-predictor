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

   オッズは市場との比較にしか使わない。そこは締切に近いほど正確なので、
   何分前に取ったかを必ず添えて、近くないなら比較を参考扱いにする。

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

/* ---- 直前情報（展示が出るまで待つ） ------------------------------ */
/* while で回すとCPUを食い続けるので、外の sleep を使う。 */
const sleep = sec => { try{ execFileSync('sleep',[String(sec)]); }catch(e){} };
let before = F.parseBefore(get('beforeinfo'));
let ready = before.boats.filter(b=>b.exT!=null).length===6;
if(!ready && !NOW_ONLY){
  log('  展示はまだ出ていません。出るまで待ちます（10分前になったら打ち切ります）。');
  while(!ready){
    const left = minsLeft();
    if(left!=null && left <= 10){
      log(`  ${left}分前になったので、展示を待たずに出します（展示は欠測のまま）。`);
      break;
    }
    sleep(30);
    before = F.parseBefore(get('beforeinfo'));
    ready = before.boats.filter(b=>b.exT!=null).length===6;
    log(`  ${hhmm(jst())} 展示=${ready?'出た':'まだ'}（残り${minsLeft()??'?'}分）`);
  }
}
log(`  展示 ${ready?'あり':'欠測'}　進入 ${Object.keys(before.entry).length?JSON.stringify(before.entry):'欠測'}`);

/* ---- オッズ ------------------------------------------------------ */
const odds = F.parseOdds(get('odds3t'));
const oddsMin = minsLeft();
if(Object.keys(odds).length!==120) throw new Error(`オッズが${Object.keys(odds).length}通りしかない`);
log(`  オッズ 120通り（締切${oddsMin}分前に取得）`);

/* ---- pending.js / odds.js / odds-live.js へ書く ------------------- */
const boats = F.parseRacelist(listHtml);
if(boats.length!==6) throw new Error(`出走表から6艇ぶん取れなかった（${boats.length}艇）`);
const n = x => x==null ? 'null' : String(x);
const cell = v => (typeof v==='number' && isFinite(v)) ? String(v) : JSON.stringify(String(v));
const lines = boats.map((b,i)=>{
  const L=i+1, bb=before.boats[i]||{}, e=before.exSt[L]||{};
  const rec='['+(b.rec||[]).map(r=>'['+cell(r[0])+','+String(r[1]).replace(/^0/,'')+','+cell(r[2])+']').join(',')+']';
  return ` {reg:'${b.reg}',g:'${b.g}',nat:${b.nat},loc:${b.loc},mot:${b.mot},bt:${b.bt},`+
    `st:${b.st},F:${b.F},exST:${n(e.st)},exF:${e.f?"'F'":'null'},exT:${n(bb.exT)},`+
    `tilt:${n(bb.tilt)},wt:${n(bb.wt)},entry:${n(before.entry[L])},rec:${rec}}`;
});
const block =
`{name:'${NAME}',jcd:'${JCD}',rno:${RNO},date:'${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)}',`+
`result:null,pop:null,pay:null,wind:null,ws:${n(before.ws)},wave:${n(before.wave)},temp:null,wtemp:null,
 /* ${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)} ${hhmm(jst())} JST、predict.js で取得（締切${closeAt}の${oddsMin}分前）。
    進入は展示進入。本番進入は使わない（先読みになる）。
    水面気象は直前情報ページの「${before.weatherLabel||'?'}」の値。結果ページが出たら差し替える。
    オッズは締切${oddsMin}分前のライブ値。レース後に締切時オッズへ取り直すこと。 */
 B:[
${lines.join(',\n')}]}`;

/* 同じ名前が既にあれば置き換える（二重登録と配列の穴を避ける） */
const upsertPending = () => {
  let p=fs.readFileSync(path.join(ROOT,'pending.js'),'utf8');
  const at=p.indexOf(`{name:'${NAME}'`);
  if(at>=0){
    let end=p.indexOf("\n{name:'", at); if(end<0) end=p.lastIndexOf('\n];');
    p = p.slice(0,at) + block + p.slice(end);
    log('  pending.js の同じレースを置き換えました');
  } else {
    p = p.replace(/\n\];\s*$/, ',\n'+block+'\n];\n');
  }
  fs.writeFileSync(path.join(ROOT,'pending.js'), p);
  const P=require(path.join(ROOT,'pending.js'));
  if(P.some(r=>!r)) throw new Error('pending.js に穴ができた。書き戻して確認すること。');
};
const upsertOdds = (file, wrap) => {
  let s=fs.readFileSync(path.join(ROOT,file),'utf8');
  const ks=Object.keys(odds);
  let body='';
  for(let a=1;a<=6;a++) body += ' '+ks.filter(k=>k[0]===String(a)).sort().map(k=>`'${k}':${odds[k]}`).join(',')+',\n';
  const blk = wrap(body);
  const at = s.indexOf(`  '${NAME}':`);
  if(at>=0){
    const end = s.indexOf('},\n', s.indexOf("'6-", at))+3;
    s = s.slice(0,at) + blk + s.slice(end);
  } else {
    s = s.replace(/module\.exports = \{\n/, 'module.exports = {\n'+blk);
  }
  fs.writeFileSync(path.join(ROOT,file), s);
};
upsertPending();
upsertOdds('odds.js',      b => `  '${NAME}': {\n`+b.replace(/,\n$/,'},\n'));
upsertOdds('odds-live.js', b => `  '${NAME}': { minutes: ${oddsMin}, odds: {\n`+
                                b.split('\n').map(x=>x?' '+x:x).join('\n').replace(/,\n$/,'}},\n'));

/* ---- モデルを呼ぶ（backtest.js 経由だけ） ------------------------- */
log('');
const out = execFileSync(process.execPath,[path.join(ROOT,'backtest.js')],
  {encoding:'utf8', maxBuffer:64*1024*1024});
const i = out.indexOf(`  ${NAME}\n`);
if(i<0){ log('※ backtest.js の出力にこのレースが見つかりません。pending.js を確認してください。'); process.exit(1); }
let j = out.indexOf('\n\n  ', i+1); if(j<0) j = out.length;
console.log(out.slice(i, j));

/* ---- オッズの信頼度をひとこと ------------------------------------ */
log('');
if(oddsMin!=null && oddsMin > 8){
  log(`※ オッズは締切${oddsMin}分前の値です。実測では10分以上前だと市場の1着確率が`);
  log('   最大15.9ptずれました（しかも1号艇が上がる向きに偏ります）。');
  log('   上の「市場」との差は根拠にしないでください。買い目はオッズを使っていないので影響しません。');
}else if(oddsMin!=null){
  log(`※ オッズは締切${oddsMin}分前の値です。この距離なら実測のずれは小さめ（2分前で最大1.1pt）。`);
}
log(`※ レース後に  node fetch.js ${Number(JCD)} ${RNO} ${HD}  で締切時オッズと結果を取り直してください。`);
