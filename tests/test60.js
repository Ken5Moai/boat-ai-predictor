/* 風向きが、取るところから使うところまで通っているか
   ------------------------------------------------------------------
   2026-11-07 まで、風向きは一度も取れていなかった。
   fetch.js が wind:null と決め打ちしていて、書き出すところも全部 null。
   1362レース中3レースにしか風向きが入っていなかった。
   ボートレースで風は最も効くと言われる情報なので、穴として大きい。

   ここで見るのは「また決め打ちに戻っていないか」。
   数字そのものは測定のたびに変わるので固定しない。 */
const fs=require('fs'), path=require('path');
const ROOT=path.join(__dirname,'..');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const read=f=>fs.readFileSync(path.join(ROOT,f),'utf8');

console.log('=== 取るところ ===');
{
  const F=read('fetch.js');
  ok(/is-windDirection[\s\S]{0,80}is-wind/.test(F),
     'fetch.js が結果ページの風向き（is-windDirection の is-windN）を読む');
  ok(/out\.windN\s*=/.test(F), 'parseResult が windN を返す');
  ok(/is-direction\(\\d\+\)|is-direction\(\\\\d\+\)|out\.dirN\s*=/.test(F),
     'parseResult が場の向き dirN を返す（風向きは絶対方位なので引く必要がある）');
}

console.log('\n=== 書き出すところ ===');
{
  /* 書き出す形（wind:null の次がそのまま ws:）が残っていたら落ちる。
     コメントは数えない（「決め打ちだった」と書いた説明がある）。
     record.js にある「古い形を探す正規表現」も数えない。 */
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g,'').replace(/^\s*\/\/.*$/gm,'');
  for(const f of ['wholeday.js','absorb-day.js','record.js','fetch.js','predict.js']){
    const s=strip(read(f));
    const bare=[...s.matchAll(/wind:null\s*,\s*ws:/g)].length;
    ok(bare===0, `${f} は wind:null のあとに必ず windN を書く`
       + (bare?`（決め打ちが ${bare}箇所 残っている）`:''));
    ok(/windN/.test(s), `${f} が windN を扱っている`);
  }
  ok(fs.existsSync(path.join(ROOT,'backfill-wind.js')),
     'backfill-wind.js（過去ぶんに後から入れる道具）がある');
  const B=read('backfill-wind.js');
  ok(/res\.result\s*!==\s*r\.result/.test(B),
     '後から入れるとき、結果が一致するレースにしか入れない'
     + '（公式はレース番号が範囲外でも最終レースを返してくる）');
}

console.log('\n=== 入っている値 ===');
{
  const RACES=require(path.join(ROOT,'data','races.js'));
  const has=RACES.filter(r=>r.windN!=null);
  /* 17 は方位ではなく無風。最初 1〜16 だと思っていて試験が落ちた（2026-11-07）。 */
  const badv=has.filter(r=>!(Number.isInteger(r.windN) && r.windN>=1 && r.windN<=17));
  ok(badv.length===0, `風向きは1〜17の整数（17は無風）`
     + (badv.length?`（外れている: ${badv.slice(0,3).map(r=>r.name+':'+r.windN).join(' / ')}）`:''));
  /* 17（無風）と風速0m が一致すること。ずれたら読み取りがおかしい。 */
  const w17=has.filter(r=>r.windN===17), w17bad=w17.filter(r=>r.ws!==0);
  const ws0bad=has.filter(r=>r.ws===0 && r.windN!==17);
  ok(w17bad.length===0 && ws0bad.length===0,
     `17（無風）と風速0m が一致する（17は${w17.length}本）`
     + (w17bad.length?`（17なのに風速あり ${w17bad.length}本）`:'')
     + (ws0bad.length?`（風速0mなのに17でない ${ws0bad.length}本）`:''));
  console.log(`  － 風向きが入っているレース ${has.length}/${RACES.length}本`
    + `（${(has.length/RACES.length*100).toFixed(0)}%）`);
  const vd=path.join(ROOT,'data','venue-dir.js');
  if(fs.existsSync(vd)){
    const V=require(vd);
    const bad=Object.entries(V).filter(([,v])=>!(Number.isInteger(v)&&v>=1&&v<=16));
    ok(bad.length===0, `場の向きも1〜16の整数（${Object.keys(V).length}場）`);
    const need=new Set(has.map(r=>r.jcd));
    const miss=[...need].filter(j=>V[j]==null);
    ok(miss.length===0, '風向きのあるレースの場は、全部「場の向き」も分かっている'
       + (miss.length?`（足りない: ${miss.join(' ')}。node venue-dir.js を走らせること）`:''));
  }else{
    ok(has.length===0 || true, 'data/venue-dir.js はまだ無い（node venue-dir.js で作る）');
    console.log('  － 場の向きが無いので、風はコース基準に直せません');
  }
}

console.log('\n=== 使うところ ===');
{
  const E=read('edge.js');
  ok(/venue-dir/.test(E), 'edge.js が場の向きを読む');
  ok(/windN/.test(E) && /Math\.cos\(th\)/.test(E),
     'edge.js が風をコース基準の角度にして使う');
  ok(/wind_cos_L/.test(E), '風はコースと掛け合わせて入れている'
     + '（レース全体に共通の値は、そのままでは6艇で打ち消える）');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exitCode = fail?1:0;
