/* 結果待ちのレースに結果を入れて RACES へ移す
   ==================================================================
     node record.js                 … 結果待ち全部を見て、入れられるものを入れる
     node record.js "若松9R ..."     … 名前を指定して1件だけ

   これまで毎回その場で移動スクリプトを書いていて、6回のうち2回失敗した。
     ・置換パターンが合わず無言で空振りし、気象が null のまま入った（6R）
     ・レースを消したあとにカンマが残り、配列に穴が開いた（7R→8Rの間）
   手で書く限り同じことを繰り返すので、検算つきの1本にまとめる。

   止める条件（どれか1つでも欠けたら書き込まない）
     ・結果ページに3連単の着順と払戻があること
     ・不成立でないこと
     ・結果ページの水面気象が埋まっていること（レース直後はまだ空）
     ・締切時オッズが120通りあり、払戻と一致すること
     ・置換が実際に効いたこと（result と ws が残っていないこと）
     ・書いたあと pending.js と backtest.js に穴が無いこと */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const F=require('./fetch.js');
const ROOT=__dirname;
const only = process.argv[2] || null;

const get = (page, jcd, rno, hd) => {
  const url=`https://www.boatrace.jp/owpc/pc/race/${page}?rno=${rno}&jcd=${jcd}&hd=${hd}`;
  return execFileSync('curl',['-sS','--fail','--max-time','60','-A','Mozilla/5.0',url],
                      {encoding:'utf8', maxBuffer:32*1024*1024});
};
const sleep = sec => { try{ execFileSync('sleep',[String(sec)]); }catch(e){} };

const PENDING = require('./data/pending.js');
const targets = PENDING.filter(r => r && (!only || r.name===only));
if(!targets.length){ console.log('対象がありません。'); process.exit(0); }

let moved=0, held=0;
for(const R of targets){
  const hd = String(R.date).replace(/-/g,'');
  let res, odds;
  try{
    res  = F.parseResult(get('raceresult', R.jcd, R.rno, hd));
    sleep(2);
    odds = F.parseOdds(get('odds3t', R.jcd, R.rno, hd));
  }catch(e){ console.log(`  ${R.name}: 取得できません（${e.message}）`); held++; continue; }

  const hold = msg => { console.log(`  ${R.name}: ${msg}`); held++; };
  if(res.void){ console.log(`  ${R.name}: ${res.voidReason}。結果は出ません。`);
                console.log('    → 記録から外すか、そのままにするかは手で決めてください。'); held++; continue; }
  if(!res.result || res.pay==null){ hold('結果がまだ出ていません'); continue; }
  if(res.ws==null || res.wave==null){ hold('結果ページの水面気象がまだ空です（レース直後はこうなります）'); continue; }
  if(Object.keys(odds).length!==120){ hold(`締切時オッズが${Object.keys(odds).length}通りしかありません`); continue; }
  /* 返還艇があると、払戻は残った組だけのプールで計算し直されるので、
     締切時オッズ×100 とは一致しない。一致を求めると永久に記録できない。
     2026-10-25 若松8R（6号艇が返還）で実際に止まった。
     返還があるときは、代わりに「正解の組に返還艇が入っていないこと」を見る。 */
  const refunded = (res.refund||[]).map(String);
  if(refunded.length){
    if(res.result.split('-').some(x=>refunded.includes(x))){
      hold(`正解 ${res.result} に返還艇 ${refunded.join('・')} が入っています（読み取りがおかしい）`); continue;
    }
    console.log(`  ${R.name}: 返還艇 ${refunded.join('・')} あり。払戻とオッズの一致は求めません。`);
  } else {
    const calc = Math.round(odds[res.result]*100);
    if(calc !== res.pay){ hold(`払戻が合いません（オッズから ¥${calc} / 画面 ¥${res.pay}）`); continue; }
  }

  /* --- pending から取り出す --- */
  let p=fs.readFileSync(path.join(ROOT,'data','pending.js'),'utf8');
  const at=p.indexOf(`{name:'${R.name}'`);
  if(at<0){ hold('pending.js に見つかりません'); continue; }
  let end=p.indexOf("\n{name:'", at); if(end<0) end=p.lastIndexOf('\n];');
  let blk=p.slice(at,end).replace(/,\s*$/,'');
  const newP=(p.slice(0,at)+p.slice(end)).replace(/,\n+\];/,'\n];');

  /* --- 結果を埋める --- */
  const before=blk;
  blk=blk.replace("result:null,pop:null,pay:null",
                  `result:'${res.result}',pop:${res.pop},pay:${res.pay}`);
  blk=blk.replace(/wind:null,ws:[^,]+,wave:[^,]+,temp:[^,]+,wtemp:[^,]+,/,
                  `wind:null,ws:${res.ws},wave:${res.wave},temp:${res.temp},wtemp:${res.wtemp},`);
  const st='{'+[1,2,3,4,5,6].map(l=>l+':'+String(res.actualST[l]??'null').replace(/^0/,'')).join(',')+'}';
  const refLine = refunded.length ? ` refund:[${refunded.join(',')}],\n` : '';
  blk=blk.replace(/\n(\s*\/\*)/, `\n actualST:${st},\n${refLine}$1`);
  if(blk===before){ hold('置換が効きませんでした（書式が想定と違う）'); continue; }
  if(/result:null/.test(blk)){ hold('result が置き換わっていません'); continue; }
  if(/,ws:null,|,wave:null,/.test(blk)){ hold('気象が置き換わっていません'); continue; }

  /* --- data/races.js へ足す（レース記録は非公開リポジトリ側） --- */
  let b=fs.readFileSync(path.join(ROOT,'data','races.js'),'utf8');
  const close=b.indexOf('\n];\n');
  const newB=b.slice(0,close)+',\n'+blk+b.slice(close);

  /* --- 締切時オッズに差し替える --- */
  let oj=fs.readFileSync(path.join(ROOT,'data','odds.js'),'utf8');
  const ks=Object.keys(odds);
  let o=`  '${R.name}': {\n`;
  for(let a=1;a<=6;a++) o+=' '+ks.filter(k=>k[0]===String(a)).sort().map(k=>`'${k}':${odds[k]}`).join(',')+',\n';
  o=o.replace(/,\n$/,'},\n');
  const oa=oj.indexOf(`  '${R.name}': {`);
  const newO = oa>=0
    ? oj.slice(0,oa)+o+oj.slice(oj.indexOf('},\n', oj.indexOf("'6-", oa))+3)
    : oj.replace(/module\.exports = \{\n/, 'module.exports = {\n'+o);

  /* --- 書く前に、書いた結果が読めるかを確かめる --- */
  const tmp = path.join(ROOT,'.record-check.js');
  try{
    fs.writeFileSync(tmp, 'module.exports=['+newB.match(/const RACES=\[([\s\S]*?)\n\];\n/)[1]+'];\n');
    /* require はキャッシュするので、消してから読む。これを忘れると
       1件目の結果を使い回して、2件目以降が全部「末尾が違う」で止まる。 */
    delete require.cache[require.resolve(tmp)];
    const arr=require(tmp);
    if(arr.some(x=>!x)) throw new Error('RACES に穴');
    if(arr[arr.length-1].name!==R.name) throw new Error('末尾が違う');
  }catch(e){ fs.existsSync(tmp)&&fs.unlinkSync(tmp); hold(`書き込み前の検算で止めました（${e.message}）`); continue; }
  fs.unlinkSync(tmp);

  fs.writeFileSync(path.join(ROOT,'data','pending.js'), newP);
  fs.writeFileSync(path.join(ROOT,'data','races.js'), newB);
  fs.writeFileSync(path.join(ROOT,'data','odds.js'), newO);
  delete require.cache[require.resolve(path.join(ROOT,'pending.js'))];
  if(require(path.join(ROOT,'pending.js')).some(x=>!x)) throw new Error('pending.js に穴ができた');
  console.log(`  ${R.name}: ${res.result} ¥${res.pay}（${res.pop}番人気）を記録しました`);
  moved++;
  sleep(2);
}
console.log(`\n記録 ${moved}件 / 保留 ${held}件`);
if(moved) console.log('※ node sync-figures.js を走らせてから node tests/run.js してください。');
