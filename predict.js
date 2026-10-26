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
let closeAt = times[RNO-1] || null;
const titleCell = cells.find(x=>/\d+m$/.test(x) && /戦|選/.test(x));
const title = titleCell ? titleCell.replace(/\s*\d+m$/,'') : '';

const minsLeft = () => {
  if(!closeAt) return null;
  const [h,m] = closeAt.split(':').map(Number);
  const n = jst();
  const close = Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate(), h, m);
  return Math.round((close - n.getTime())/60000);
};

/* 締切時刻を読み直す。
   出走表の「締切予定時刻」は固定ではなく、レースが遅れると後ろにずれる。
   2026-10-25 若松8R で実際に起きた。20:55に読んだ一覧は21:17だったが、
   本当の締切は21:22。古い時刻のまま数えて10分前の打ち切りを5分早く発動させ、
   21:13に出ていた展示を取り逃がして暫定のまま出してしまった。
   ずれたら黙って使わず、必ず画面に出す。 */
const refreshClose = (html) => {
  const cs = F.cells(html).filter(x=>x&&x!=='|');
  const k = cs.findIndex(x=>/締切予定時刻/.test(x));
  if(k<0) return;
  const ts = cs.slice(k+1, k+13).filter(x=>/^\d{1,2}:\d{2}$/.test(x));
  const t = ts[RNO-1];
  if(t && t !== closeAt){
    log(`  ※ 締切が ${closeAt} → ${t} にずれました（レースの進行が遅れています）。`);
    closeAt = t;
  }
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
    /* 結果待ちが0件のときは配列が空なので、カンマを付けると先頭に穴ができる。
       2026-10-26 福岡1R で実際に起きた（前夜に全部記録して空になっていた）。
       中身があるかどうかで分ける。 */
    const empty = /module\.exports = \[\s*\];?\s*$/.test(p);
    p = empty
      ? p.replace(/module\.exports = \[\s*\];?\s*$/, 'module.exports = [\n'+block+'\n];\n')
      : p.replace(/\n\];\s*$/, ',\n'+block+'\n];\n');
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
const show = (label, provisional, odds) => {
  const out = execFileSync(process.execPath,[path.join(ROOT,'backtest.js')],
    {encoding:'utf8', maxBuffer:64*1024*1024});
  const i = out.indexOf(`  ${NAME}\n`);
  if(i<0){ log('※ backtest.js の出力にこのレースが見つかりません。'); return; }
  let j = out.indexOf('\n\n  ', i+1); if(j<0) j = out.length;
  log('');
  log(`──────── ${label} ────────`);
  console.log(out.slice(i, j));
  /* 買い目のオッズを見て「当たっても元が取れない点」を数える。
     2026-10-26 福岡1R で、モデルの1号艇が89.4%だったのを見て
     『ガチガチだから当たっても赤字』と口で言ったが、実際のオッズは
     10点中9点が10倍超で、結果は 1-6-5 ¥3,610（17番人気）だった。
     1着の堅さと3連単の配当は別物で、そこを混同していた。
     口で判断せず、昨日測った指標（10倍未満が何点か）をここで出す。

     実測（77レース・締切時オッズ）
       本線10点が当たったうち、当たっても赤字だったのは13/33（39%）
       10倍未満が0点  15レース ／ 1点 12 ／ 2点 19 ／ 3点 11 ／ 4点 6 */
  {
    const m = odds ? out.slice(i, j).match(/本線10点\s+(.+)/) : null;
    if(m){
      const expand = t => { const o=[];
        for(const term of t.trim().split(' / ')){ const [A,B,C]=term.split('-');
          for(const a of A) for(const b of B) for(const c of C)
            if(a!==b && b!==c && a!==c) o.push(`${a}-${b}-${c}`); }
        return [...new Set(o)]; };
      const list = expand(m[1]);
      const cost = list.length*100;
      const cheap = list.filter(k=>odds[k]!=null && odds[k]*100 < cost);
      log('');
      log(`  ── 当たっても元が取れるか（本線${list.length}点＝¥${cost.toLocaleString()}）──`);
      if(!cheap.length){
        log(`     10倍未満は0点。どれが来ても投資は回収できます。`);
      } else {
        log(`     当たっても¥${cost.toLocaleString()}に届かない組が ${cheap.length}点あります:`);
        log(`       ${cheap.map(k=>`${k} ${odds[k]}倍（¥${Math.round(odds[k]*100).toLocaleString()}）`).join(' / ')}`);
        if(cheap.length>=2)
          log('     ※ 昨日の集計では、10倍未満が2点以上のレースを見送ると回収率が上がりました');
        log('       （116%→160%。ただし的中が8/27に減る数字なので、判定⑦として検証中です）');
      }
      const best = (out.slice(i,j).match(/至極の一点\s+(\S+)/)||[])[1];
      if(best && odds[best]!=null)
        log(`     至極の一点 ${best} は ${odds[best]}倍（¥${Math.round(odds[best]*100).toLocaleString()}）`);
      log('     ※ このオッズは締切前の値なので、締切までに動きます。');
    }
  }

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
  const html = get('beforeinfo');
  refreshClose(html);          /* 直前情報ページにも同じ締切一覧が載っている */
  const bf = F.parseBefore(html);
  return {bf, min: minsLeft(), ready: bf.boats.filter(x=>x.exT!=null).length===6};
};
const grab = () => {
  const g = peek();
  const od = F.parseOdds(get('odds3t'));
  if(Object.keys(od).length!==120) throw new Error(`オッズが${Object.keys(od).length}通りしかない`);
  return {...g, od};
};

/* 締切まで間があるうちは、30秒おきに叩いても展示は出ない。
   公式に無駄な負荷をかけるだけなので、20分前になるまで待つ。
   実測では展示は締切12〜17分前に出る。 */
{
  let left = minsLeft();
  while(left != null && left > 25){
    const wait = Math.min(600, (left - 22) * 60);
    log(`  締切まで間があるので ${Math.round(wait/60)}分待ちます（残り${left}分）。`);
    sleep(wait);
    /* 待っているあいだに締切がずれることがあるので、読み直す。 */
    try{ refreshClose(get('beforeinfo')); }catch(e){}
    left = minsLeft();
  }
}

let g = grab();
log(`  展示 ${g.ready?'あり':'まだ（欠測のまま出します）'}　オッズ120通り（締切${g.min}分前）`);
write(g.bf, g.od, g.min);
show(g.ready ? `確定の買い目（締切${g.min}分前）` : `暫定の買い目（展示前・締切${g.min}分前）`, !g.ready, g.od);

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
    show(`確定の買い目（展示あり・締切${g.min}分前）`, false, g.od);
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
