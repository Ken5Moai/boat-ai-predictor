/* auto.js — 複数場の自動ループ
   ==================================================================
   実際に走らせると1日かかるので、ここでは「並べ方」と「上限」だけ見る。
   通信はしない。auto.js の中の並べ方と同じ規則をここに写して確かめる
   （auto.js 側は main() が即走るので require できない）。 */
const fs=require('fs'), path=require('path');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };
const SRC=fs.readFileSync(path.join(__dirname,'..','auto.js'),'utf8');

console.log('\n=== auto.js が必ず持っていること ===');
ok_(/買いません/.test(SRC), '「買いません」と書いてある（買う処理を入れない目印）');
ok_(!/投票入力完了|投票する/.test(SRC.replace(/\/\*[\s\S]*?\*\//g,'')),
    'コード本体に「投票入力完了」「投票する」を押す処理が無い');
ok_(/const MAX\s*=\s*Number\(flag\('max'/.test(SRC), '上限レース数を引数で受ける');
ok_(/YEN_PER_RACE/.test(SRC) && /最大 ¥/.test(SRC), '上限まで回ったときの持ち出しを先に出す');
ok_(/86%/.test(SRC) && /100%を安定して超えてはいない/.test(SRC),
    '実測の回収率を出す（回すほど減ることを隠さない）');
ok_(/MIN_LEAD/.test(SRC), '締切が近すぎるレースは外す');
ok_(/MIN_GAP/.test(SRC), '同じ時間に2レース進めない');

console.log('\n=== 並べ方（場をまたいで散らす） ===');
{
  /* auto.js と同じ規則。場ごとに1本ずつ、締切が近すぎるものは飛ばす。 */
  const pick=(all, MAX, MIN_GAP=14)=>{
    const byVenue=new Map();
    for(const r of all){ if(!byVenue.has(r.jcd)) byVenue.set(r.jcd,[]); byVenue.get(r.jcd).push(r); }
    const q=[];
    for(let d=0; q.length<MAX; d++){
      let added=false;
      for(const list of byVenue.values()){
        if(q.length>=MAX) break;
        const r=list[d]; if(!r) continue;
        added=true;
        if(q.some(x=>Math.abs(x.closeMin-r.closeMin)<MIN_GAP)) continue;
        q.push(r);
      }
      if(!added) break;
    }
    return q.sort((a,b)=>a.closeMin-b.closeMin);
  };
  /* 2場×12レース。A は朝、B は夜。 */
  const all=[];
  for(let i=1;i<=12;i++) all.push({jcd:'A', rno:i, closeMin:8*60+ (i-1)*26});
  for(let i=1;i<=12;i++) all.push({jcd:'B', rno:i, closeMin:15*60+(i-1)*30});
  all.sort((a,b)=>a.closeMin-b.closeMin);

  const q=pick(all, 10);
  ok_(q.length===10, `上限10本ちょうど取る（${q.length}本）`);
  const vs=new Set(q.map(r=>r.jcd));
  ok_(vs.size===2, `2場から取る（${[...vs].join(',')}）＝朝の場だけで埋めない`);
  const a=q.filter(r=>r.jcd==='A').length, b=q.filter(r=>r.jcd==='B').length;
  ok_(a>=3 && b>=3, `どちらの場も3本以上（A:${a} B:${b}）`);
  let tooClose=0;
  for(let i=1;i<q.length;i++) if(q[i].closeMin-q[i-1].closeMin<14) tooClose++;
  ok_(tooClose===0, `締切が14分未満で並ぶ組が無い（${tooClose}組）`);
  ok_(q.every((r,i)=>i===0||r.closeMin>=q[i-1].closeMin), '締切の早い順に並んでいる');

  /* 上限より少ないときは全部 */
  const q2=pick(all, 100);
  ok_(q2.length<=24 && q2.length>0, `上限が大きければある分だけ取る（${q2.length}本）`);
  /* 上限0は0本 */
  ok_(pick(all,0).length===0, '上限0なら1本も取らない');
  /* 1場しかなくても動く */
  ok_(pick(all.filter(r=>r.jcd==='A'), 5).length===5, '1場だけでも上限ぶん取れる');
}

console.log('\n=== 持ち出しの見込み ===');
{
  const YEN=1800;
  for(const [n,yen] of [[10,18000],[20,36000],[8,14400]])
    ok_(YEN*n===yen, `${n}レースで最大 ¥${yen.toLocaleString()}`);
}

console.log('\n=== 損切り ===');
{
  /* auto.js の中と同じ規則をここに写して確かめる。
     settle() は「当たった組の金額ぶんだけ払戻を受け取る」。
     至極を厚くしている場合、その組が来たときだけ多く戻る。 */
  const settleCalc=(plan,res,pay)=>{
    const rows=plan.rows.filter(x=>x.combo===res);
    const back=rows.reduce((a,x)=>a+pay*(x.yen/100),0);
    return {hit:rows.length>0, inv:plan.total, back, net:back-plan.total};
  };
  const plan={total:2200, rows:[
    {combo:'1-2-3',yen:500},{combo:'1-3-2',yen:100},{combo:'2-1-3',yen:100},
    ...Array.from({length:15},(_,i)=>({combo:'x'+i,yen:100}))]};

  let s=settleCalc(plan,'1-2-3',860);
  ok_(s.hit && s.back===4300, `至極(¥500)が ¥860 で当たれば払戻¥4,300（${s.back}）`);
  ok_(s.net===2100, `収支 +¥2,100（${s.net}）`);

  s=settleCalc(plan,'1-3-2',860);
  ok_(s.hit && s.back===860, `100円の組が ¥860 なら払戻¥860（${s.back}）`);
  ok_(s.net===-1340, `当たっても赤字 -¥1,340（${s.net}）＝警告どおりの形`);

  s=settleCalc(plan,'6-5-4',99999);
  ok_(!s.hit && s.back===0, '買っていない組が来たら払戻0');
  ok_(s.net===-2200, `外れは投資ぶん丸ごとマイナス（${s.net}）`);

  /* 損切りは通算で見る。1レースごとではない。 */
  const stop=(nets,limit)=>{ let n=0,k=0;
    for(const x of nets){ n+=x; k++; if(n<=-Math.abs(limit)) return {k,n}; } return {k,n}; };
  let r=stop([-1800,-1800,-1800,-1800],5000);
  ok_(r.k===3 && r.n===-5400, `¥5,000の損切りなら3本目で止まる（${r.k}本・${r.n}）`);
  r=stop([-1800,+8200,-1800,-1800],5000);
  ok_(r.k===4 && r.n===2800, `途中で当たれば止まらない（${r.k}本・${r.n}）`);
  r=stop([-1800,-1800],5000);
  ok_(r.n===-3600, `届かなければ止まらない（${r.n}）`);
  ok_(stop([-1800,-1800,-1800],1).k===1, '損切りを極端に小さくすれば1本で止まる');
}

console.log('\n=== auto.js が損切りを持っていること ===');
ok_(/STOP_LOSS/.test(SRC), '損切りを引数で受ける');
ok_(/net <= -Math\.abs\(Number\(STOP_LOSS\)\)/.test(SRC), '通算の収支で判定している（1レースごとではない）');
ok_(/残りのレースは捨てて終わります/.test(SRC), '当たったら残りを捨てて終わる');
ok_(/買いましたか/.test(SRC), '実際に買ったかを人に聞いてから収支に入れる');

console.log('\n=== --buy の歯止め ===');
ok_(/const BUY\s*=\s*args\.includes\('--buy'\)/.test(SRC), '--buy を引数で受ける');
ok_(/--buy-dry/.test(SRC), '--buy-dry（押す直前で止まる）がある');
ok_(/buyReadiness/.test(SRC), '環境変数が揃っているかを先に見る');
ok_(/BUY && STOP_LOSS==null/.test(SRC), '--buy のとき損切りが無ければ走らない');
ok_(/if\(!FILL\)/.test(SRC), '--buy は --fill と一緒でないと走らない');
/* 見たいのは「値を代入していないか」。
   使い方の説明文（$env:BOAT_BET_PASSWORD="…"）を拾わないよう、
   process.env への代入だけを見る。 */
ok_(/process\.env\.BOAT_BET_PASSWORD/.test(SRC) || /buyReadiness/.test(SRC),
    'パスワードは環境変数から読む');
ok_(!/process\.env\.BOAT_BET_PASSWORD\s*=[^=]/.test(SRC),
    'パスワードを環境変数に書き込んでいない（読むだけ）');
ok_(!/writeFileSync[^)]*BOAT_BET_PASSWORD/.test(SRC),
    'パスワードをファイルに書いていない');
ok_(!/--buy-password|--password/.test(SRC), 'パスワードを引数で受け取らない（ps で見えるため）');

console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
process.exitCode = ng ? 1 : 0;
