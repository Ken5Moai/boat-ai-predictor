/* 3連単オッズの取得と検算 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
 {runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

/* 実際のレースに近いオッズを作る。1コースが来やすい分布にして、
   控除率25%（Σ(1/オッズ)≒1.33）になるよう正規化する。 */
const combos = w.allTrifecta();
const base = combos.map(k=>{
  const [a,b,c]=k.split('-').map(Number);
  const w1={1:.52,2:.15,3:.13,4:.11,5:.06,6:.03}[a];
  const w2={1:.30,2:.22,3:.20,4:.15,5:.08,6:.05}[b];
  const w3={1:.25,2:.22,3:.20,4:.17,5:.09,6:.07}[c];
  return w1*w2*w3;
});
const sum=base.reduce((a,c)=>a+c,0);
const trueOdds={};
combos.forEach((k,i)=>{ trueOdds[k] = Math.round(0.75/(base[i]/sum)*10)/10; });

function mk(w1,w2,w3){
  const b=combos.map(k=>{const[x,y,z]=k.split('-').map(Number);return w1[x-1]*w2[y-1]*w3[z-1];});
  const s=b.reduce((p,c)=>p+c,0); const o={};
  combos.forEach((k,i)=>{o[k]=Math.round(0.75/(b[i]/s)*10)/10;}); return o;
}
const W2=[.30,.24,.20,.14,.07,.05], W3=[.25,.22,.20,.17,.09,.07];

console.log('=== A. 正しいオッズは、どんなレースでも通す ===');
{
  const cases = {
    'ごく普通（イン強）':   mk([.55,.14,.12,.11,.06,.02],W2,W3),
    '徳山級のイン天国':     mk([.75,.09,.07,.05,.03,.01],W2,W3),
    'やや混戦':            mk([.35,.20,.17,.15,.09,.04],W2,W3),
    '荒れ（1号艇が弱い）':  mk([.18,.22,.24,.18,.12,.06],[.22,.22,.20,.17,.11,.08],[.19,.19,.19,.18,.14,.11]),
    '3号艇が本命':         mk([.20,.15,.40,.13,.08,.04],W2,W3),
    '大荒れ（ほぼ均等）':   mk([.22,.20,.19,.17,.13,.09],[.20,.19,.18,.17,.14,.12],[.18,.18,.18,.17,.15,.14]),
  };
  for(const [n,o] of Object.entries(cases)){
    const c=w.oddsSanity(o);
    ok(c.ok, `${n} は通る${c.ok?`（順位相関 ${c.rho.toFixed(2)}）`:`：${c.why}`}`);
  }
}

console.log('\n=== B. 間違った並びは通さない ===');
{
  const truth = mk([.55,.14,.12,.11,.06,.02],W2,W3);
  const wrong = {
    '行と列の取り違え': combos.map((k,i)=>combos[(i%6)*20+Math.floor(i/6)]),
    '20ずらし':        combos.map((k,i)=>combos[(i+20)%120]),
    '逆順':            combos.map((k,i)=>combos[119-i]),
  };
  for(const [n,order] of Object.entries(wrong)){
    const m={}; combos.forEach((k,i)=>{m[k]=truth[order[i]];});
    const c=w.oddsSanity(m);
    ok(!c.ok, `${n} を弾く：${c.why||'（通ってしまった）'}`);
  }
  // 120通り揃っていない／値がおかしい
  const short={...truth}; delete short['1-2-3'];
  ok(!w.oddsSanity(short).ok, '119通りしかなければ弾く');
  const junk={}; combos.forEach(k=>{ junk[k]=3.5; });
  ok(!w.oddsSanity(junk).ok, '全部同じ値なら弾く');
  const bad={...truth}; bad['1-2-3']=0.8;
  ok(!w.oddsSanity(bad).ok, '1.0以下のオッズを弾く');
  // 無作為な並べ替えを大量に試す
  let seed=20260924, through=0;
  const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff;};
  const keys=Object.keys(truth);
  for(let t=0;t<1000;t++){
    const vals=keys.map(k=>truth[k]);
    for(let i=vals.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[vals[i],vals[j]]=[vals[j],vals[i]];}
    const m={}; keys.forEach((k,i)=>{m[k]=vals[i];});
    if(w.oddsSanity(m).ok) through++;
  }
  ok(through===0, `無作為な並べ替え1000通りをすべて弾く（素通り ${through}件）`);
}

console.log('\n=== B2. ずらし誤りは「いちばん合う並び」で正される ===');
{
  const truth = mk([.55,.14,.12,.11,.06,.02],W2,W3);
  // 先頭に余計な小数が3つ混ざったページ
  const body = '9.9 8.8 7.7 ' + combos.map(k=>truth[k].toFixed(1)).join(' ');
  const r = w.parseOdds3t(`<html><body>3連単オッズ ${body}</body></html>`);
  ok(r.map, '余計な数字が混ざっていても読める');
  ok(r.how && r.how.includes('3個読み飛ばし'), `正しいずらし量を選ぶ: ${r.how}`);
  ok(r.map && Math.abs(r.map['1-2-3']-truth['1-2-3'])<0.05, '1-2-3 が正しい位置に入る');
  ok(r.map && Math.abs(r.map['6-5-4']-truth['6-5-4'])<0.05, '6-5-4 も正しい');
}

console.log('\n=== B3. 枠順の目安が通じないレースでも、モデルの確率で通す ===');
{
  /* 三国5R：A1が外枠から3コースへ前づけし、市場は6号艇を本命にした。
     枠順の傾向との順位相関は -0.21 まで落ちるが、
     モデルの確率と突き合わせれば 0.86 で通る。
     期待値を探したいのはこういうレースなので、弾いてはいけない。 */
  const upside = mk([.05,.06,.07,.03,.03,.76],[.20,.19,.19,.17,.13,.12],W3);
  const noRef = w.oddsSanity(upside);
  ok(!noRef.ok, `枠順の目安だけだと弾かれる（順位相関 ${noRef.rho.toFixed(2)}）`);
  const probs = {};
  Object.keys(upside).forEach(k=>{ probs[k] = 0.75/upside[k]; });   /* 市場と同じ形の確率 */
  const withRef = w.oddsSanity(upside, probs);
  ok(withRef.ok, `モデルの確率を渡せば通る（順位相関 ${withRef.rho.toFixed(2)}）`);
  ok(withRef.how==='モデルの確率', `どちらの物差しで通ったか分かる: ${withRef.how}`);
  /* モデルの確率を渡しても、並びがめちゃくちゃなら通さない */
  const keys=Object.keys(upside), vals=keys.map(k=>upside[k]);
  let seed=7; const rnd=()=>{seed=(seed*1103515245+12345)&0x7fffffff; return seed/0x7fffffff;};
  let through=0;
  for(let t=0;t<300;t++){
    for(let i=vals.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[vals[i],vals[j]]=[vals[j],vals[i]];}
    const m={}; keys.forEach((k,i)=>{m[k]=vals[i];});
    if(w.oddsSanity(m, probs).ok) through++;
  }
  ok(through===0, `モデルの確率を渡しても、並べ替えた300通りは全部弾く（素通り ${through}件）`);
  /* 普通のレースでは、これまでどおり枠順の目安で通る */
  const normal = mk([.55,.14,.12,.11,.06,.02],W2,W3);
  ok(w.oddsSanity(normal).ok && w.oddsSanity(normal).how==='枠順の傾向',
     '普通のレースは参照なしでも通る');
}

console.log('\n=== C. 組番つきのページを読む ===');
{
  const rows=combos.map(k=>`<tr><td>${k}</td><td>${trueOdds[k].toFixed(1)}</td></tr>`).join('');
  const r=w.parseOdds3t(`<html><body><h1>3連単オッズ</h1><table>${rows}</table></body></html>`);
  ok(r.map, '組番が書かれていれば読める');
  ok(r.how==='組番つき', `読み方: ${r.how}`);
  ok(r.map && Math.abs(r.map['1-2-3']-trueOdds['1-2-3'])<0.05, `1-2-3 のオッズが一致 (${r.map&&r.map['1-2-3']})`);
  ok(r.map && Math.abs(r.map['6-5-4']-trueOdds['6-5-4'])<0.05, '6-5-4 のオッズも一致');
}

console.log('\n=== D. 組番が無い表を並び順から読む ===');
{
  // 公式の並び（1着ごと、2着→3着の昇順）で数字だけが並ぶページ
  const body = combos.map(k=>trueOdds[k].toFixed(1)).join(' ');
  const r=w.parseOdds3t(`<html><body>3連単オッズ<div>${body}</div></body></html>`);
  ok(r.map, '並び順からでも読める');
  ok(r.how && r.how.includes('列優先'), `読み方: ${r.how}`);
  ok(r.map && Math.abs(r.map['1-2-3']-trueOdds['1-2-3'])<0.05, '1-2-3 が正しい位置に入る');
}
{
  // 行優先（6列を横に巡る）で並ぶページ
  const order=[]; for(let rI=0;rI<20;rI++) for(let c=0;c<6;c++) order.push(combos[c*20+rI]);
  const body = order.map(k=>trueOdds[k].toFixed(1)).join(' ');
  const r=w.parseOdds3t(`<html><body>3連単オッズ<div>${body}</div></body></html>`);
  ok(r.map && r.how.includes('行優先'), `行優先の並びも読める: ${r.how}`);
  ok(r.map && Math.abs(r.map['1-2-3']-trueOdds['1-2-3'])<0.05, '1-2-3 が正しい位置に入る');
}

console.log('\n=== E. 読めないものは読めたと言わない ===');
{
  const r=w.parseOdds3t('<html><body>ただいまオッズを準備中です</body></html>');
  ok(!r.map, 'オッズが無いページは不採用');
  ok(r.tried.length>0, '何を試したか記録が残る');
}
{
  // 数字はあるが着順や艇番（オッズではない）
  const nums=Array.from({length:200},(_,i)=>(1+i%6)+'.0').join(' ');
  const r=w.parseOdds3t(`<html><body>${nums}</body></html>`);
  ok(!r.map, '別の数字が並んでいるだけなら不採用');
}
{
  // 1つだけ欠けている（欠場などで119通り）
  const short=combos.slice(0,119).map(k=>trueOdds[k].toFixed(1)).join(' ');
  const r=w.parseOdds3t(`<html><body>3連単${short}</body></html>`);
  ok(!r.map, '120通り揃わなければ不採用');
}

console.log('\n=== F. 取得したオッズがそのまま期待値に使える ===');
{
  const r=w.parseOdds3t(`<html><body>${combos.map(k=>`${k} ${trueOdds[k].toFixed(1)}`).join('<br>')}</body></html>`);
  ok(r.map, 'ページを読める');
  const state=w.eval('state');
  state.oddsMap = r.map;
  const fake=[{combo:'1-2-3',p:0.20},{combo:'6-5-4',p:0.001}];
  const ev=w.withEV(fake);
  ok(ev[0].ev>1, `確率20%の1-2-3は期待値${ev[0].ev.toFixed(2)}で買い`);
  ok(ev[1].ev<1, `確率0.1%の6-5-4は期待値${ev[1].ev.toFixed(2)}で見送り`);
  ok(Math.abs(ev[0].be-5)<0.01, '損益分岐は5.0倍（確率20%の逆数）');
  const picked=w.choosePoints(fake.map(f=>({...f})), 12);
  ok(picked.mode==='ev' && picked.points.length===1, '期待値で1点だけ選ばれる');
  state.oddsMap={};
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
