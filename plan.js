/* 買い目の行から、実際の組番と plan を組み立てる
   ==================================================================
   predict.js が締切の10〜20分前に走らせる部分なので、ここだけ切り出して
   テストできるようにした。ファイルも通信も触らない。入れた文字列から
   組番を作るだけ。

   「123-123-12 / 1-3-5」のような書き方を、実際の組番に開く。
   同じ艇が2回出る並び（1-1-2 など）は作らない。 */
function expand(t){
  const o=[];
  for(const term of String(t||'').trim().split(' / ')){
    const [A,B,C]=term.split('-');
    if(!A||!B||!C) continue;
    for(const a of A) for(const b of B) for(const c of C)
      if(a!==b && b!==c && a!==c) o.push(`${a}-${b}-${c}`);
  }
  return [...new Set(o)];
}

/* backtest.js が出した1レース分の文章から plan を作る。
   読めなければ null と理由を返す。推測で埋めない。
   金額はここでは決めない（既定100円）。厚く賭けるなら人が書き換える。
   機械が勝手に金額を上げることは、ここでは絶対にしない。 */
function buildPlan(block, meta){
  const grab = re => (String(block||'').match(re)||[])[1];
  const best    = grab(/至極の一点\s+(\S+?)(?:（|\s|$)/);
  const mainRaw = grab(/本線\s*\d+点\s+(.+)/);
  const anaRaw  = grab(/波乱\s*\d+点\s+(.+)/);
  if(!mainRaw) return {plan:null, why:'本線の行が読めませんでした'};

  const main = expand(mainRaw);
  if(!main.length) return {plan:null, why:'本線の行から組番が作れませんでした'};
  /* 波乱は本線と重ねない。重ねると同じ組を2回買うことになる。 */
  const ana = anaRaw ? expand(anaRaw).filter(c=>!main.includes(c)) : [];
  if(best && !main.includes(best))
    return {plan:null, why:`至極 ${best} が本線の中にありません`};

  return {plan:{
    jcd: meta.jcd, rno: meta.rno, date: meta.date, race: meta.race,
    provisional: !!meta.provisional,
    best: best || null, bestYen: 100, unitYen: 100, main, ana,
  }, why:null};
}

module.exports = { expand, buildPlan };
