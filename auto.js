/* 複数場を見張って、順に買い目を出す
   ==================================================================
   使い方
     node auto.js                      今日・上限20レース
     node auto.js --max 10             今日・上限10レース
     node auto.js --venues 15,24       場を絞る（場コード）
     node auto.js --plan               その日に回る予定を出すだけ（待たない）
     node auto.js 20261028 --max 15    日付を指定

   やること
     1. 開催中の全場の締切時刻を集める
     2. まだ間に合うレースを締切順に並べ、上限ぶんだけ拾う
     3. 1レースずつ、展示が出るまで待つ
     4. 展示が出たら買い目を作り、tmp/plan.json に書いて知らせる
     5. 次のレースへ

   買いません。買い目を出すところまでです。
   打ち込みは vote-assist.js、押すのは人。

   ★ 上限を必ず置く理由
     実測の回収率は 本線10点 86% / 18点 108%（最大1件除くと96%）。
     100%を安定して超えてはいない。回せば回すほど減る形なので、
     「残高がある限り」ではなく「1日◯レースまで」で止める。
     レース数が決まれば、その日の最大の持ち出しが先に分かる。 */
const fs=require('fs'), path=require('path');
const {execFileSync}=require('child_process');
const F=require('./fetch.js');
const ROOT=__dirname;

const args=process.argv.slice(2);
const flag=(n,d)=>{ const i=args.indexOf('--'+n); return i<0?d:args[i+1]; };
const HD = args.find(a=>/^\d{8}$/.test(a))
        || new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,'');
const MAX = Number(flag('max', 20));
const ONLY = (flag('venues','')||'').split(',').filter(Boolean).map(s=>s.padStart(2,'0'));
const PLAN_ONLY = args.includes('--plan');

/* 1点100円・18点で計算する。vote-assist.js と同じ前提。 */
const YEN_PER_RACE = 1800;

const VN=(()=>{ const o={}; const html=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
  const re=/'(\d{2})':\{name:'([^']+)'/g; let m; while((m=re.exec(html))) o[m[1]]=m[2]; return o; })();

const jst = () => new Date(Date.now()+9*3600*1000);
/* 締切までの分数。日付をまたぐので、時刻だけで引き算しない。
   明日の日付を渡したとき、8:35 を「もう過ぎた」と判定して0本になった
   （2026-10-27 に --plan で気づいた）。 */
const TODAY = () => jst().toISOString().slice(0,10).replace(/-/g,'');
const DAY_OFFSET = () => {
  const d = (Date.UTC(+HD.slice(0,4), +HD.slice(4,6)-1, +HD.slice(6,8))
           - Date.UTC(+TODAY().slice(0,4), +TODAY().slice(4,6)-1, +TODAY().slice(6,8)))
          / 86400000;
  return d * 24 * 60;
};
const nowMin = () => { const d=jst(); return d.getUTCHours()*60+d.getUTCMinutes() - DAY_OFFSET(); };
const hhmm = () => { const d=jst();
  return String(d.getUTCHours()).padStart(2,'0')+':'+String(d.getUTCMinutes()).padStart(2,'0'); };
const log = (...a) => console.log(`[${hhmm()}]`, ...a);
/* while で回すとCPUを食うので外の sleep を使う（predict.js と同じ） */
const sleep = sec => { try{ execFileSync('sleep',[String(Math.max(1,Math.round(sec)))]); }
                       catch(e){ } };

const get = (page, jcd, rno) => execFileSync('curl',
  ['-sS','--fail','--max-time','40','-A','boat-ai-predictor/1.0',
   `https://www.boatrace.jp/owpc/pc/race/${page}?rno=${rno}&jcd=${jcd}&hd=${HD}`],
  {encoding:'utf8', maxBuffer:32*1024*1024});

/* ---- その日の締切時刻を集める ---------------------------------- */
function schedule(){
  const out=[];
  for(const jcd of Object.keys(VN).sort()){
    if(ONLY.length && !ONLY.includes(jcd)) continue;
    let html; try{ html=get('racelist', jcd, 1); }catch(e){ continue; }
    const cs=F.cells(html).filter(x=>x&&x!=='|');
    const k=cs.findIndex(x=>/締切予定時刻/.test(x));
    if(k<0) continue;
    const ts=cs.slice(k+1,k+40).filter(x=>/^\d{1,2}:\d{2}$/.test(x)).slice(0,12);
    if(ts.length!==12) continue;      /* 12個そろわない場は開催していない */
    const title=F.raceTitle(html);
    ts.forEach((t,i)=>{
      const [h,m]=t.split(':').map(Number);
      out.push({jcd, venue:VN[jcd], rno:i+1, close:t, closeMin:h*60+m, title});
    });
    process.stderr.write(`  ${VN[jcd]} 取得\n`);
  }
  return out.sort((a,b)=>a.closeMin-b.closeMin);
}

/* 展示が出ているか */
function exhibitionReady(jcd, rno){
  try{
    const B=F.parseBefore(get('beforeinfo', jcd, rno));
    return B.boats.filter(b=>b.exT!=null).length===6;
  }catch(e){ return false; }
}

/* 買い目を作る。predict.js をそのまま呼ぶ（モデルは一箇所にしか置かない）。 */
function makePlan(r){
  const out=execFileSync(process.execPath,
    [path.join(ROOT,'predict.js'), r.jcd, String(r.rno), HD, '--now'],
    {encoding:'utf8', maxBuffer:64*1024*1024});
  const i=out.indexOf('── 買い目 ──'), j=out.indexOf('※ 上の「市場」');
  const block = i<0 ? '(買い目が読めませんでした)' : out.slice(i, j<0?out.length:j).replace(/\n+$/,'');
  const warn = (out.match(/── 当たっても元が取れるか[\s\S]*?(?=\n\s*※ このオッズは締切前)/)||[])[0];
  return {block, warn};
}

/* ---- 本体 ------------------------------------------------------- */
(function main(){
  console.log(`\n=== 複数場の自動ループ（${HD}） ===`);
  console.log(`  上限 ${MAX}レース`
    + (ONLY.length?` / 場を ${ONLY.map(j=>VN[j]||j).join('・')} に限定`:' / 全場')
    + `\n  買いません。買い目を出すところまでです。`);
  console.log(`  1レース¥${YEN_PER_RACE.toLocaleString()}（18点×100円）`
    + ` → 上限まで回ると最大 ¥${(YEN_PER_RACE*MAX).toLocaleString()} の持ち出し`);
  console.log(`  実測の回収率は 本線10点86% / 18点108%（最大1件除くと96%）。`);
  console.log(`  100%を安定して超えてはいないので、上限まで回ると平均では減ります。\n`);

  console.log('  開催を調べています…');
  const all=schedule();
  if(!all.length){ console.log('  この日に開催している場が見つかりません。'); return; }

  /* まだ間に合うレースだけ。展示を待つ時間がいるので12分前より手前は捨てる。 */
  const MIN_LEAD = 12;
  const ok = all.filter(r => r.closeMin - nowMin() >= MIN_LEAD);
  const dropped = all.length - ok.length;

  /* 締切順にそのまま上から取ると、朝の2場だけで上限を使い切る
     （2026-10-28 の下見で、唐津と三国の1〜4Rで8本埋まった）。
     1日に散らしたいので、場ごとに順番で1本ずつ拾っていく。
     同じ時間に2レース進めないので、前のレースの締切から
     MIN_GAP 分あいているものだけを足す。 */
  const MIN_GAP = 14;
  const byVenue = new Map();
  for(const r of ok){ if(!byVenue.has(r.jcd)) byVenue.set(r.jcd, []); byVenue.get(r.jcd).push(r); }
  const queue=[];
  for(let depth=0; queue.length<MAX; depth++){
    let added=false;
    for(const list of byVenue.values()){
      if(queue.length>=MAX) break;
      const r=list[depth]; if(!r) continue;
      added=true;
      if(queue.some(q => Math.abs(q.closeMin - r.closeMin) < MIN_GAP)) continue;
      queue.push(r);
    }
    if(!added) break;
  }
  queue.sort((a,b)=>a.closeMin-b.closeMin);

  console.log(`\n  今日まわるレース ${queue.length}本`
    + (dropped?`（締切が近すぎる${dropped}本は外しました）`:'')
    + `\n  想定の持ち出し 最大 ¥${(YEN_PER_RACE*queue.length).toLocaleString()}\n`);
  console.log('    締切   場     R   番組');
  for(const r of queue)
    console.log(`    ${r.close}  ${r.venue.padEnd(4)}${String(r.rno).padStart(2)}R  ${r.title||''}`);

  if(PLAN_ONLY){ console.log('\n  --plan なので、ここまでです。'); return; }
  if(!queue.length){ console.log('\n  まわせるレースがありません。'); return; }

  console.log('\n  ここから1レースずつ進みます。止めるときは Ctrl+C。\n');
  let done=0;
  for(const r of queue){
    const label=`${r.venue}${r.rno}R`;
    let left=r.closeMin-nowMin();
    if(left < MIN_LEAD){ log(`${label} は締切が近すぎるので飛ばします（残り${left}分）`); continue; }

    /* 展示が出るのは実測で締切12〜17分前。20分前まではただ待つ。 */
    while(r.closeMin-nowMin() > 20){
      const wait=Math.min(600, (r.closeMin-nowMin()-18)*60);
      log(`${label} 締切${r.close}（残り${r.closeMin-nowMin()}分）… ${Math.round(wait/60)}分待ちます`);
      sleep(wait);
    }
    log(`${label} 展示を待ちます（残り${r.closeMin-nowMin()}分）`);
    let ready=false;
    while((left=r.closeMin-nowMin()) >= 10){
      if(exhibitionReady(r.jcd, r.rno)){ ready=true; break; }
      sleep(30);
    }
    if(!ready){ log(`${label} 展示が出ないまま10分前になったので飛ばします`); continue; }

    log(`${label} 展示が出ました（残り${r.closeMin-nowMin()}分）。買い目を作ります…`);
    let p; try{ p=makePlan(r); }
    catch(e){ log(`${label} 買い目を作れませんでした: ${String(e.message).slice(0,80)}`); continue; }

    done++;
    console.log('');
    console.log(`──────── ${label} 買い目（締切${r.close}・残り${r.closeMin-nowMin()}分） ────────`);
    console.log(p.block);
    if(p.warn) console.log('  '+p.warn.trim());
    console.log(`\n  打ち込むなら別の画面で:  node vote-assist.js tmp/plan.json`);
    console.log(`  （すでにブラウザを開いて ${r.venue} ${r.rno}R の入力画面にしてある場合は Enter）`);
    console.log(`  ここまで ${done}/${queue.length}本。持ち出しは最大 ¥${(YEN_PER_RACE*done).toLocaleString()}\n`);

    /* 締切をまたぐまで待ってから次へ（同じ時間に2レース進めない） */
    while(r.closeMin-nowMin() > 0) sleep(20);
  }
  console.log(`\n=== 終わりました。買い目を出したのは ${done}本 ===`);
  console.log('  結果は  node record.js  で取り込めます（レースが終わってから）。');
})();
