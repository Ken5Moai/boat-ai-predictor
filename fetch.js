/* 公式ページから1レース分をそのまま取ってくる
   ==================================================================
   いままでスクショを手で書き写していた。55レースぶん。
   書き写しは間違える。実際このセッションだけで
     ・岩瀬のSTを .09 と読んだ（正しくは .16）
     ・4-5-1 を 123.7 と読んだ（正しくは 123.2）
     ・中島の7Rを進入5・3着と読んだ（正しくは進入6・5着）
   を取りこぼし寸前まで行き、拡大して見直して気づいた。

   公式から直接取れば、この種の間違いは最初から起きない。

   使い方
     node fetch.js 23 1 20261020      1レース取って、貼り付け用に出す
     node fetch.js --verify           記録ずみのレースを取り直して突き合わせる
     node fetch.js --verify 10        先頭10件だけ突き合わせる

   --verify がこのファイルのいちばん大事なところ。
   手で書き写した55レースと、公式から取り直したものを突き合わせる。
   合えば「手書きも取り込みも正しい」、食い違えばどちらかが間違っている。

   方針は index.html の読み取りと同じ。
     ・形で取る（登番は4桁、勝率は N.NN、2連率は NN.NN）
     ・取れなかったら null。0や推測を入れない
     ・公式が「.」や「-」と出している欄は、欠測として null にする */
const fs = require('fs'), path = require('path'), vm = require('vm');

/* オッズについて（2026-10-24に分かったこと）
   odds3t はレース前に取ると「その時点のライブ値」で、締切時オッズとは違う。
   若松12R(10/24) は締切12分前が 2-4-5 = 521.9倍だったが、締切時は 953.1倍だった。
   払戻(¥95,310)と一致するのは後者。記録用のオッズは必ずレース後に取り直すこと。
   予想のときは締切前の値しか無いので、それで出すしかない（それは正しい）。 */
const BASE = 'https://www.boatrace.jp/owpc/pc/race';
const UA = 'boat-ai-predictor/1.0 (personal backtest; contact via github.com/Ken5Moai)';

/* ---- 取ってくる ---------------------------------------------------- */
/* Node の fetch はこの環境のプロキシ設定を見てくれないので curl を使う。
   curl は HTTPS_PROXY と CA束を自分で読む。 */
const { execFileSync } = require('child_process');
function get(page, jcd, rno, hd){
  const url = `${BASE}/${page}?rno=${rno}&jcd=${String(jcd).padStart(2,'0')}&hd=${hd}`;
  const out = execFileSync('curl', ['-sS','--fail','--max-time','60','-A',UA,url],
                           {encoding:'utf8', maxBuffer:32*1024*1024});
  if(!out || out.length < 1000) throw new Error(`${page} の中身が短すぎる（${out.length}文字）`);
  return out;
}
const sleep = ms => new Promise(r=>setTimeout(r, ms));

/* ---- 共通の下ごしらえ ---------------------------------------------- */
const cells = html => html
  .replace(/<script[\s\S]*?<\/script>/g,'')
  .replace(/<style[\s\S]*?<\/style>/g,'')
  .replace(/<[^>]+>/g,'|')
  .replace(/&nbsp;/g,' ')
  .replace(/\s*\|\s*/g,'|')
  .replace(/\|+/g,'|')
  .split('|').map(x=>x.replace(/\s+/g,' ').trim());

const zen2han = s => String(s).replace(/[０-９]/g, c=>'０１２３４５６７８９'.indexOf(c));
const num = s => { const m = String(s).match(/-?\d+(\.\d+)?/); return m ? Number(m[0]) : null; };

/* ---- 出走表 --------------------------------------------------------- */
/* 番組名（「予選」「優勝戦」「一般戦」など）を出走表ページから取る。
   backtest.js は優勝戦・準優・特選・選抜をレース名の文字で見分けているので、
   取り込んだレースにこれが入っていないと、全部「ふつうのレース」になる。
   番組名のセルは「◯◯戦 1800m」のように距離がくっついている。
   （この取り方は scan.js にあったものをこちらに移した。二重に持たない） */
function raceTitle(html){
  const cs = cells(html).filter(x=>x && x!=='|');
  /* 番組名のセルは「◯◯ 1800m」。距離で終わるセルはこの1つだけなので、
     それだけを手がかりにする。最初は「戦|選を含むこと」も条件にしていたが、
     「一般」「カタメン１予選」のような番組名が落ちた（2026-10-26）。 */
  const hits = cs.filter(x=>/\d+m$/.test(x));
  if(hits.length !== 1) return null;    /* 1つに絞れなければ取らない（推測しない） */
  return hits[0].replace(/\s*\d+m$/,'').trim() || null;
}

function parseRacelist(html){
  const c = cells(html);
  const boats = [];
  for(let i=0;i<c.length;i++){
    /* 登番のセルは「4205 /」のように区切りの / がくっついて来ることがある */
    const mReg = String(c[i]).match(/^(\d{4})\s*\/?$/);
    if(!mReg) continue;
    const gTok = /^(A1|A2|B1|B2)$/.test(c[i+1]) ? c[i+1]
               : /^(A1|A2|B1|B2)$/.test(c[i+2]) ? c[i+2] : null;
    if(!gTok) continue;
    const reg = mReg[1], g = gTok;
    /* 級別のあと: 名前 / 支部-出身 / 年齢-体重 / F / L / 平均ST */
    let k = c.indexOf(gTok, i) + 1;
    const name = c[k++];
    const home = c[k++];
    const age  = c[k++];
    const fTok = c[k++], lTok = c[k++], stTok = c[k++];
    if(!/^F/.test(fTok) || !/^L/.test(lTok)) continue;
    /* 勝率などは数値が18個ならぶ：全国3 / 当地3 / モーター3 / ボート3 */
    const nums = [];
    while(nums.length < 12 && k < c.length){
      const v = num(c[k]);
      if(v===null){ k++; continue; }
      nums.push(v); k++;
    }
    const wt = num(age.split('/')[1]);
    /* 今節成績：レースNo列 → 進入コース列 → ST列 → 着順列 の順に並ぶ。
       ST列の個数を本数とみなし、コースと着順はその個数だけ取る。 */
    /* 次の艇の登番セルの手前までを、この艇の今節成績とみなす。
       ここを切らないと次の艇のST列まで拾ってしまい、本数を取り違える。
       （実際それで1・2号艇の今節成績が空になっていた） */
    let end = k;
    while(end < c.length && !/^\d{4}\s*\/?$/.test(c[end])) end++;
    const tail = c.slice(k, Math.min(end, k+40));
    const stIdx = [];
    tail.forEach((t,ix)=>{ if(/^\.\d\d$/.test(t)) stIdx.push(ix); });
    let rec = [];
    if(stIdx.length){
      const first = stIdx[0], n = stIdx.length;
      const sts = stIdx.map(ix=>Number('0'+tail[ix]));
      /* コースはST列の直前にn個、着順は直後にn個 */
      const courses = tail.slice(first-n, first).map(x=>num(x));
      const places  = tail.slice(stIdx[n-1]+1, stIdx[n-1]+1+n)
                          .map(x=>{ const z=zen2han(x); return /^\d$/.test(z) ? Number(z) : x; });
      if(courses.length===n && courses.every(x=>x>=1&&x<=6) && places.length===n)
        rec = sts.map((s,ix)=>[courses[ix], s, places[ix]]);
    }
    boats.push({ reg, g, name,
      nat: nums[0], loc: nums[3],
      mot: nums[7], bt: nums[10],
      st: /^-$/.test(stTok) ? null : num(stTok),
      F: num(fTok) ?? 0, L: num(lTok) ?? 0,
      wt, rec });
    if(boats.length===6) break;
  }
  return boats;
}

/* ---- 直前情報 ------------------------------------------------------- */
function parseBefore(html){
  const c = cells(html);
  const out = { boats:[], exSt:{}, entry:{} };
  /* 体重 / 展示タイム / チルト の行：「NN.Nkg」のあとに展示・チルトが続く */
  for(let i=0;i<c.length;i++){
    if(!/^\d\d\.\dkg$/.test(c[i])) continue;
    const wt = num(c[i]);
    const exT  = num(c[i+1]);
    const tilt = num(c[i+2]);
    if(exT===null || exT < 6 || exT > 8) continue;      /* 展示タイムの形 */
    /* チルトのあと、"R" が来るまでが部品交換。そのあと
       "R" "進入" <調整重量> "ST" "着順" と並ぶ。 */
    let j = i+3, parts = null;
    if(c[j] !== 'R'){ parts = c[j]; j++; }
    /* 調整重量は「ST」の見出しの直前にある。前走成績が埋まっているかどうかで
       並びが変わる（空なら R|進入|調整|ST、埋まっていれば R|値|進入|値|調整|ST）。
       見出し "ST" を探して、その1つ前を取るのがいちばん確実。 */
    let adj = null;
    for(let z=j; z<j+10 && z<c.length; z++){
      if(c[z]==='ST'){ const v = num(c[z-1]); if(v!==null && v>=0 && v<=5) adj = v; break; }
    }
    out.boats.push({ wt, exT, tilt, parts, adj });
    if(out.boats.length===6) break;
  }
  /* スタート展示：「コース 並び ST」のあと コース番号とSTが交互 */
  const s = c.indexOf('スタート展示');
  if(s>=0){
    const seg = c.slice(s, s+40);
    for(let i=0;i<seg.length-1;i++){
      if(!/^[1-6]$/.test(seg[i])) continue;
      const v = seg[i+1];
      const m = String(v).match(/^(F?)(\.\d\d)$/);
      if(!m) continue;
      const lane = Number(seg[i]);
      out.exSt[lane] = { st: Number('0'+m[2]), f: m[1]==='F' ? 'F' : null };
      out.entry[lane] = Object.keys(out.entry).length + 1;   /* 並び順＝コース */
      i++;
    }
  }
  /* 水面気象情報（この時点の表示。過去レースでは現在の天気になる） */
  const w = c.findIndex(x=>/^水面気象情報/.test(x));
  if(w>=0){
    const seg = c.slice(w, w+20).join('|');
    out.weatherLabel = c[w];
    out.ws   = num((seg.match(/風速\|([\d.]+)m/)||[])[1]);
    out.wave = num((seg.match(/波高\|([\d.]+)cm/)||[])[1]);
  }
  return out;
}

/* ---- 3連単オッズ ---------------------------------------------------- */
function parseOdds(html){
  const body = html.slice(html.indexOf('is-p3-0'));
  const rows = body.split(/<tr[^>]*>/).slice(1);
  const odds = {};
  const second = {};                               /* 列ごとの、いまの2着 */
  for(const row of rows){
    const tds = [...row.matchAll(/<td class="([^"]*)"[^>]*>([^<]*)</g)]
                  .map(m=>({cls:m[1], v:m[2].trim()}));
    if(!tds.length) continue;
    let col = 0;
    for(let i=0;i<tds.length;i++){
      const t = tds[i];
      if(/rowspan/.test(row) && /is-fs14/.test(t.cls) && /^[1-6]$/.test(t.v)){
        second[col] = Number(t.v); continue;
      }
      if(/oddsPoint/.test(t.cls)){
        const third = tds[i-1] && /^[1-6]$/.test(tds[i-1].v) ? Number(tds[i-1].v) : null;
        const o = num(t.v);
        if(third!==null && second[col]!=null && o!==null)
          odds[`${col+1}-${second[col]}-${third}`] = o;
        col++;
      }
    }
  }
  return odds;
}

/* ---- 結果 ----------------------------------------------------------- */
function parseResult(html){
  const c = cells(html);
  const out = { actualST:{}, refund:[] };
  const joined = c.join('|');
  /* 不成立（レースが成立せず全額返還）のとき、着順も払戻も出ない。
     そのままだと「結果ページがまだ埋まっていない」と区別がつかず、
     いつまでも結果待ちのまま残ってしまう。
     2026-10-25 若松12R で実際に起きた。 */
  if(/不成立/.test(joined)){
    out.void = true;
    out.voidReason = '不成立';
    return out;
  }
  const m3 = joined.match(/3連単\|(\d)\|-\|(\d)\|-\|(\d)\|&yen;([\d,]+)\|(\d+)/)
          || joined.match(/3連単\|(\d)\|-\|(\d)\|-\|(\d)\|¥?([\d,]+)\|(\d+)/);
  if(m3){
    out.result = `${m3[1]}-${m3[2]}-${m3[3]}`;
    out.pay    = Number(m3[4].replace(/,/g,''));
    out.pop    = Number(m3[5]);
  }
  out.temp  = num((joined.match(/気温\|([\d.]+)℃/)||[])[1]);
  out.ws    = num((joined.match(/風速\|([\d.]+)m/)||[])[1]);
  out.wtemp = num((joined.match(/水温\|([\d.]+)℃/)||[])[1]);
  out.wave  = num((joined.match(/波高\|([\d.]+)cm/)||[])[1]);
  /* スタート情報：コース番号 と ST が交互。決まり手の語が混ざる */
  const s = c.indexOf('スタート情報');
  if(s>=0){
    const seg = c.slice(s, s+40);
    const order = [];
    for(let i=0;i<seg.length-1;i++){
      if(!/^[1-6]$/.test(seg[i])) continue;
      /* 1着の欄は「.03 逃げ」のように決まり手がくっつく */
      const m = String(seg[i+1]).match(/^(F?)(\.\d\d)(\s|$)/);
      if(!m) continue;
      order.push({ lane:Number(seg[i]), st:Number('0'+m[2]) });
      i++;
    }
    for(const o of order) out.actualST[o.lane] = o.st;
  }
  const r = c.indexOf('返還');
  if(r>=0) for(const t of c.slice(r+1, r+8)) if(/^[1-6]$/.test(t)) out.refund.push(Number(t));
  return out;
}

/* ---- 1レース分をまとめる -------------------------------------------- */
async function fetchRace(jcd, rno, hd){
  const racelist  = get('racelist',   jcd, rno, hd); await sleep(1200);
  const before    = get('beforeinfo', jcd, rno, hd); await sleep(1200);
  const odds3t    = get('odds3t',     jcd, rno, hd); await sleep(1200);
  const result    = get('raceresult', jcd, rno, hd);
  const title = raceTitle(racelist);
  const L = parseRacelist(racelist);
  const B = parseBefore(before);
  const O = parseOdds(odds3t);
  const R = parseResult(result);
  if(L.length!==6) throw new Error(`出走表から6艇ぶん取れなかった（${L.length}艇）`);
  const boats = L.map((b,i)=>{
    const bb = B.boats[i] || {};
    const ex = B.exSt[i+1] || {};
    return { ...b, exT: bb.exT ?? null, tilt: bb.tilt ?? null,
             wt: bb.wt ?? b.wt, parts: bb.parts ?? null, adj: bb.adj ?? null,
             exST: ex.st ?? null, exF: ex.f ?? null,
             entry: B.entry[i+1] ?? null };
  });
  return { jcd:String(jcd).padStart(2,'0'), rno, hd, title, boats, odds:O, result:R, before:B };
}

/* ---- 貼り付け用に出す ------------------------------------------------ */
function emit(race, name){
  const d = `${race.hd.slice(0,4)}-${race.hd.slice(4,6)}-${race.hd.slice(6,8)}`;
  const R = race.result;
  const st = Object.keys(R.actualST).length
    ? ` actualST:{${[1,2,3,4,5,6].filter(l=>R.actualST[l]!=null)
        .map(l=>`${l}:${String(R.actualST[l]).replace(/^0/,'')}`).join(',')}},\n` : '';
  const ref = R.refund.length ? ` refund:[${R.refund.join(',')}],\n` : '';
  const f = (v,dp)=> v==null ? 'null' : Number(v).toFixed(dp);
  console.log(`\n/* ---- backtest.js の RACES に貼る ---- */`);
  console.log(`{name:'${name}',jcd:'${race.jcd}',rno:${race.rno},date:'${d}',`
    + `result:'${R.result}',pop:${R.pop},pay:${R.pay},`);
  console.log(ref + st + ` wind:null,ws:${R.ws},wave:${R.wave},temp:${R.temp},wtemp:${R.wtemp},`);
  console.log(' B:[');
  race.boats.forEach((b,i)=>{
    console.log(` {reg:'${b.reg}',g:'${b.g}',nat:${f(b.nat,2)},loc:${f(b.loc,2)},`
      + `mot:${f(b.mot,2)},bt:${f(b.bt,2)},st:${b.st==null?'null':f(b.st,2)},F:${b.F},`
      + `exST:${b.exST==null?'null':String(b.exST).replace(/^0/,'')},`
      + `exF:${b.exF?"'F'":'null'},exT:${f(b.exT,2)},tilt:${f(b.tilt,1)},wt:${f(b.wt,1)},`
      + (b.adj ? `adj:${f(b.adj,1)},` : '')
      + (b.parts ? `parts:'${b.parts}',` : '')
      + `entry:${b.entry},rec:[${b.rec.map(r=>`[${r[0]},${String(r[1]).replace(/^0/,'')},`
      + `${typeof r[2]==='number'?r[2]:`'${r[2]}'`}]`).join(',')}]}${i<5?',':']},'}`);
  });
  const keys = Object.keys(race.odds);
  console.log(`\n/* ---- odds.js に貼る（${keys.length}通り） ---- */`);
  console.log(`  '${name}': {`);
  const lines = [];
  for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){
    if(a===b) continue;
    const row = [];
    for(let c2=1;c2<=6;c2++){ if(c2===a||c2===b) continue;
      const k=`${a}-${b}-${c2}`; if(race.odds[k]!=null) row.push(`'${k}':${race.odds[k]}`); }
    if(row.length) lines.push(' ' + row.join(','));
  }
  console.log(lines.join(',\n'));
  console.log('  },');
}

module.exports = { fetchRace, raceTitle, parseRacelist, parseBefore, parseOdds, parseResult, cells, zen2han };

if(require.main === module) (async ()=>{
  const a = process.argv.slice(2);
  if(a[0] === '--verify'){ await verify(a[1] ? Number(a[1]) : null); return; }
  if(a.length < 3){
    console.log('使い方: node fetch.js <場コード> <レース番号> <YYYYMMDD>');
    console.log('        node fetch.js --verify [件数]');
    process.exit(1);
  }
  const race = await fetchRace(a[0], a[1], a[2]);
  emit(race, `取得${a[0]}_${a[1]}R_${a[2]}`);
})().catch(e=>{ console.error('✗ ' + e.message); process.exit(1); });

/* ---- 突き合わせ ------------------------------------------------------ */
async function verify(limit){
  const src = fs.readFileSync(path.join(__dirname,'backtest.js'),'utf8');
  const from = src.indexOf('const RACES=['), to = src.indexOf('\n];', from);
  const RACES = vm.runInNewContext(src.slice(from+'const RACES='.length, to+2));
  const ODDS = require(path.join(__dirname,'odds.js'));
  let target = RACES.filter(r=>r.date && r.jcd && r.rno);
  if(limit) target = target.slice(0, limit);
  console.log(`手で書き写した ${target.length}レースを、公式から取り直して突き合わせます。\n`);
  let okN = 0, ngN = 0;
  for(const r of target){
    const hd = r.date.replace(/-/g,'');
    let got;
    try { got = await fetchRace(r.jcd, r.rno, hd); }
    catch(e){ console.log(`  ✗ ${r.name}  取得できず: ${e.message}`); ngN++; continue; }
    const bad = [];
    const cmp = (label, mine, theirs, tol=0) => {
      if(mine==null && theirs==null) return;
      if(mine==null || theirs==null){ bad.push(`${label}: 手書き${mine} / 公式${theirs}`); return; }
      if(Math.abs(mine-theirs) > tol) bad.push(`${label}: 手書き${mine} / 公式${theirs}`);
    };
    if(r.result !== got.result.result) bad.push(`結果: ${r.result} / ${got.result.result}`);
    cmp('払戻', r.pay, got.result.pay);
    if(r.pop!=null) cmp('人気', r.pop, got.result.pop);
    cmp('風速', r.ws, got.result.ws); cmp('波高', r.wave, got.result.wave);
    cmp('気温', r.temp, got.result.temp, 0.05); cmp('水温', r.wtemp, got.result.wtemp, 0.05);
    r.B.forEach((b,i)=>{
      const o = got.boats[i]; if(!o){ bad.push(`${i+1}号艇が公式に無い`); return; }
      if(b.reg !== o.reg){ bad.push(`${i+1}号艇 登番: ${b.reg} / ${o.reg}`); return; }
      const p = `${i+1}号艇`;
      if(b.g !== o.g) bad.push(`${p} 級別: ${b.g} / ${o.g}`);
      cmp(`${p} 全国`, b.nat, o.nat, 0.005); cmp(`${p} 当地`, b.loc, o.loc, 0.005);
      cmp(`${p} モーター`, b.mot, o.mot, 0.005); cmp(`${p} ボート`, b.bt, o.bt, 0.005);
      cmp(`${p} 平均ST`, b.st, o.st, 0.005);   cmp(`${p} F数`, b.F, o.F);
      cmp(`${p} 展示タイム`, b.exT, o.exT, 0.005);
      cmp(`${p} 展示ST`, b.exST, o.exST, 0.005);
      if((b.exF||null) !== (o.exF||null)) bad.push(`${p} 展示F: ${b.exF} / ${o.exF}`);
      if(b.entry!=null) cmp(`${p} 進入`, b.entry, o.entry);
      if(b.rec && b.rec.length && o.rec.length){
        if(JSON.stringify(b.rec) !== JSON.stringify(o.rec))
          bad.push(`${p} 今節成績: ${JSON.stringify(b.rec)} / ${JSON.stringify(o.rec)}`);
      }
    });
    const mineOdds = ODDS[r.name];
    if(mineOdds && Object.keys(got.odds).length===120){
      const diff = Object.keys(mineOdds).filter(k=>Math.abs(mineOdds[k]-got.odds[k])>0.05);
      if(diff.length) bad.push(`オッズ ${diff.length}通り違う: `
        + diff.slice(0,3).map(k=>`${k} ${mineOdds[k]}/${got.odds[k]}`).join(' '));
    }
    if(bad.length){ ngN++; console.log(`  ✗ ${r.name}`); bad.forEach(b=>console.log(`      ${b}`)); }
    else { okN++; console.log(`  ✓ ${r.name}`); }
    await sleep(1200);
  }
  console.log(`\n一致 ${okN}件 / 食い違い ${ngN}件`);
}
