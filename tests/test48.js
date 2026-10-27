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

console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
process.exitCode = ng ? 1 : 0;
