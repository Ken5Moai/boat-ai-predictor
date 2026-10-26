/* その日のレースを一覧にして、実測で分かっている条件だけで絞る
   ==================================================================
     node scan.js [YYYYMMDD]

   「狙い目レース」と言えるものは、正直なところ多くない。
   77レースで測って、本線10点の成績がはっきり分かれたのは2つだけ。

     番組名が 優勝戦・準優・特選・選抜     18件  本線10点 82%（最大1件除くと59%）
     それ以外のふつうのレース              59件  本線10点126%（最大1件除くと97%）

     A1が6人（G1級）                    19件  10点的中  6/19（32%）
     A1が2〜5人                        15件  10点的中  9/15（60%）
     A1が0〜1人（一般級）                43件  10点的中 28/43（65%）

   どちらも「避けるべきレース」が分かるだけで、「勝てるレース」が
   分かるわけではない。ふつうのレースの126%も、いちばん効いた1レースを
   除くと97%に落ちる。つまり通算で勝てると示せたものは、まだ何も無い。

   場ごとの差も見たが、若松24件・唐津18件に偏っていて比べられない。
   展示とオッズはレース直前にしか出ないので、ここでは使えない。

   このツールがやるのは「明らかに不利な条件のレースを外す」ことだけ。
   残ったレースが勝てる保証はない。 */
const fs=require('fs'), path=require('path'), {execFileSync}=require('child_process');
const F=require('./fetch.js');
const ROOT=__dirname;

const HD = process.argv[2] || new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
const get = url => execFileSync('curl',['-sS','--fail','--max-time','60','-A','Mozilla/5.0',url],
                                {encoding:'utf8', maxBuffer:32*1024*1024});
const sleep = sec => { try{ execFileSync('sleep',[String(sec)]); }catch(e){} };

const VENUES = (()=>{
  const {JSDOM}=require('jsdom');
  const d=new JSDOM(fs.readFileSync(path.join(ROOT,'index.html'),'utf8'),
    {runScripts:'dangerously', url:'https://ken5moai.github.io/',
     beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  return d.window.eval('VENUES');
})();

console.log(`${HD.slice(0,4)}-${HD.slice(4,6)}-${HD.slice(6,8)} の開催を調べます`);
const idx = get(`https://www.boatrace.jp/owpc/pc/race/index?hd=${HD}`);
const jcds = [...new Set([...idx.matchAll(/jcd=(\d\d)/g)].map(x=>x[1]))].sort();
console.log(`  開催 ${jcds.length}場: ${jcds.map(j=>(VENUES[j]||{}).name||j).join(' ')}`);
console.log('  各レースの出走表を取ります（1秒おき、数分かかります）\n');

const BIG = /優勝戦|準優|特選|選抜/;
const rows=[];
for(const jcd of jcds){
  for(let rno=1; rno<=12; rno++){
    let html;
    try{ html = get(`https://www.boatrace.jp/owpc/pc/race/racelist?rno=${rno}&jcd=${jcd}&hd=${HD}`); }
    catch(e){ continue; }
    sleep(1);
    const cs = F.cells(html).filter(x=>x&&x!=='|');
    const ti = cs.findIndex(x=>/締切予定時刻/.test(x));
    const times = ti<0 ? [] : cs.slice(ti+1, ti+13).filter(x=>/^\d{1,2}:\d{2}$/.test(x));
    const title = F.raceTitle(html) || '';   /* 取り方は fetch.js に移した */
    let boats=[];
    try{ boats = F.parseRacelist(html); }catch(e){}
    if(boats.length!==6) continue;
    const a1 = boats.filter(b=>b.g==='A1').length;
    rows.push({ jcd, rno, venue:(VENUES[jcd]||{}).name||jcd, close:times[rno-1]||'?',
                title, a1, b1:boats[0] });
  }
  process.stdout.write(`  ${(VENUES[jcd]||{}).name||jcd} 済\n`);
}

/* 実測で分かっている2条件だけで分ける。新しい基準をその場で作らない。 */
const now = (()=>{ const d=new Date(Date.now()+9*3600*1000);
  return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0'); })();
const future = r => r.close==='?' || r.close > now;
const good = rows.filter(r=>!BIG.test(r.title) && r.a1<=1 && future(r));
const mid  = rows.filter(r=>!BIG.test(r.title) && r.a1>=2 && r.a1<=5 && future(r));
const bad  = rows.filter(r=>(BIG.test(r.title) || r.a1===6) && future(r));

const show = (label, list, note) => {
  console.log(`\n=== ${label}（${list.length}レース）===`);
  if(note) console.log(`  ${note}`);
  if(!list.length){ console.log('  該当なし'); return; }
  list.sort((a,b)=>a.close.localeCompare(b.close));
  for(const r of list)
    console.log(`  ${r.close}  ${r.venue.padEnd(4)}${String(r.rno).padStart(2)}R  `+
      `A1:${r.a1}人  1号艇 ${r.b1.g} 全国${String(r.b1.nat).padStart(4)} モ${String(r.b1.mot).padStart(5)}  ${r.title}`);
};
show('条件を満たすレース', good,
  '一般級（A1が0〜1人）で、優勝戦・準優・特選・選抜ではないレース。');
show('どちらとも言えないレース', mid, 'A1が2〜5人。10点的中は9/15で、件数が足りない。');
show('避けたほうがよいレース', bad,
  '優勝戦クラス（本線10点82%）か、A1が6人のG1級（10点的中6/19）。');

console.log('\n※ これは「不利な条件を外した」だけです。残ったレースが勝てる保証はありません。');
console.log('  ふつうのレースの126%も、いちばん効いた1レースを除くと97%に落ちます。');
console.log('  買うレースを決めたら node predict.js <場コード> <R> で買い目を出してください。');
console.log(`  締切が近い順に並べています（いま ${now}）。`);
