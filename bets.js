/* 実際に出した予想と、その収支。
   ==================================================================
   これまで記録が3か所に分かれていて、どれも「お金」を持っていなかった。
     backtest.js の RACES … モデルを測るための、入力データ付きのレース
     screened.js          … 「外にA級なし」で選ぶ条件の検証
     odds.js / pending.js … オッズと結果待ち
   どれも「いくら賭けて、いくら戻ったか」は持っていない。
   賭けていく以上、そこがいちばん大事なので、ここに1本化する。

   このファイルの決まり
     ・レース前に出した買い目と金額を、結果が出る前に書く
     ・結果が出たら hit と pay を入れる。買い目のほうは書き換えない
     ・当たった回だけ載せる、ということはしない（全部載せる）
     ・本線と穴は別々に数える。混ぜると、穴枠が成績を下げているのか
       上げているのかが永久に分からなくなる
     ・rank（モデルが正解を何番目に置いたか）は、入力データが
       手元にあるときだけ入れる。無いときは null。0 にはしない
       （「120番目」と「分からない」はまったく別の情報なので）

   node bets.js で収支が出る。 */

module.exports = [
 {
   name:'若松9R',
   /* 日付は本人に未確認。推測で入れない。確認でき次第ここを埋める。 */
   date:null,
   picks:['1-3-2','1-2-3','1-3-4','1-4-3','3-1-2','1-2-4','2-1-3','1-4-2','3-1-4','4-1-3'],
   form:['1-234-234','3-1-24','24-1-3'],   /* まとめ表記。picks と同じ10点 */
   unit:100,
   hit:'4-3-5',
   pay:13920,                               /* 139.2倍 ×100円 */
   pop:null,
   /* 出走表・直前情報・オッズを受け取っていないので、
      モデルが 4-3-5 を何番目に置いていたかは計算できない。
      いいかげんな数字を入れるより、空けておく。 */
   rank:null,
   ana:[],                                  /* 穴枠は使っていない */
   note:'4号艇頭は 4-1-3 の1点だけ持っていた。4-3-5 は圏外。'
 },
 {
   name:'若松10R 準優勝戦',
   date:'2026-10-08',
   /* 公式の出走表・直前情報・展示情報・3連単オッズ（21:54更新）を入れて採点。
      締切22:05 の前に出している。結果が出たら hit と pay を入れる。 */
   picks:['1-2-3','1-3-2','2-1-3','3-1-2','1-2-5','1-3-5','1-2-4','1-5-2','1-3-4','1-5-3'],
   form:['1-23-2345','1-5-23','23-1-23'],
   unit:100,
   ana:[],                                  /* 穴枠は使っていない（既定どおり0口） */
   hit:'1-4-3', pay:2520, pop:null, rank:12,
   note:'外れ。正解はモデルの12番目で、10点の2つ外。'+
        'モデルの1号艇60%に対し市場は77%、1号艇が勝ったので市場の勝ち'+
        '（1着の対数スコア モデル-0.508 / 市場-0.260）。'+
        '展示ST F.03・展示タイム6.83（6艇で最も遅い）を見てモデルは1号艇を割り引いたが、'+
        '本番は逃げ切った。この割り引きは外れた方向。'+
        '穴枠を足していても拾えない（1-4-3は29.7倍で、下限30倍にも届かない）。'
 }
];

if(require.main===module){
  const B=module.exports;
  /* 結果がまだ出ていないレースは、収支に混ぜない。
     未確定を0として数えると、外れたのと同じ扱いになってしまう。 */
  const row=b=>{
    const ana=b.ana||[];
    const n=b.picks.length, inv=n*b.unit;
    const an=ana.length, ainv=an*(b.anaUnit||100);
    const win=b.picks.includes(b.hit), awin=ana.includes(b.hit);
    const back=win ? b.pay : 0, aback=awin ? b.pay : 0;
    return {...b, n, inv, win, back, an, ainv, awin, aback,
            pl:(back+aback)-(inv+ainv)};
  };
  const rs=B.filter(b=>b.hit!=null).map(row);
  const waiting=B.filter(b=>b.hit==null);
  const inv=rs.reduce((a,r)=>a+r.inv,0);
  const back=rs.reduce((a,r)=>a+r.back,0);
  const wins=rs.filter(r=>r.win).length;
  const ainv=rs.reduce((a,r)=>a+r.ainv,0);
  const aback=rs.reduce((a,r)=>a+r.aback,0);
  const awins=rs.filter(r=>r.awin).length;

  console.log('\n実際に出した予想の収支');
  console.log('────────────────────────────────────────────────');
  for(const r of rs){
    console.log(`${(r.date||'日付未確認').padEnd(12)} ${r.name.padEnd(8)} `+
      `${String(r.n).padStart(2)}点 ¥${String(r.inv).padStart(6)}  `+
      `結果 ${r.hit} ¥${String(r.pay).padStart(6)}  `+
      `${r.win?'的中':'外れ'}  収支 ${r.pl>=0?'+':''}${r.pl.toLocaleString()}`);
    console.log(`             買い目 ${(r.form||r.picks).join(' ')}`);
    if(r.rank==null)
      console.log('             モデルの順位は未計算（入力データが手元に無い）');
    else
      console.log(`             モデルの順位 ${r.rank}/120`);
    if(r.note) console.log(`             ${r.note}`);
  }
  console.log('────────────────────────────────────────────────');
  console.log(`本線 ${rs.length}レース  的中${wins}/${rs.length}  `+
    `投資¥${inv.toLocaleString()} 払戻¥${back.toLocaleString()}  `+
    `収支 ${back-inv>=0?'+':''}${(back-inv).toLocaleString()}  `+
    `回収率 ${inv?(back/inv*100).toFixed(0):'—'}%`);
  /* 穴枠は必ず別で出す。本線に混ぜると、穴が足を引っ張っていても見えない。 */
  console.log(`穴枠 ${rs.filter(r=>r.an).length}レース  的中${awins}/${rs.length}  `+
    `投資¥${ainv.toLocaleString()} 払戻¥${aback.toLocaleString()}  `+
    `収支 ${aback-ainv>=0?'+':''}${(aback-ainv).toLocaleString()}  `+
    `回収率 ${ainv?(aback/ainv*100).toFixed(0):'—'}%`);
  console.log(`合計  投資¥${(inv+ainv).toLocaleString()} 払戻¥${(back+aback).toLocaleString()}  `+
    `収支 ${(back+aback)-(inv+ainv)>=0?'+':''}${((back+aback)-(inv+ainv)).toLocaleString()}  `+
    `回収率 ${(inv+ainv)?((back+aback)/(inv+ainv)*100).toFixed(0):'—'}%`);

  const noRank=rs.filter(r=>r.rank==null).length;
  if(noRank) console.log(`\n※ ${noRank}レースはモデルの順位が未計算。`+
    '出走表・直前情報・オッズをもらえれば埋められる。');
  if(rs.length<20)
    console.log(`※ まだ${rs.length}レース。回収率は何も意味しない数字です（20レースで一度見る）。`);
  const noDate=rs.filter(r=>!r.date).length;
  if(noDate) console.log(`※ ${noDate}レースは日付が未確認。`);
  if(waiting.length){
    console.log(`\n結果待ち ${waiting.length}件（収支には入れていない）`);
    for(const b of waiting)
      console.log(`  ${b.date||'日付未確認'}  ${b.name}  ${b.picks.length}点 `+
        `¥${(b.picks.length*b.unit).toLocaleString()}  ${(b.form||b.picks).join(' ')}`);
  }
}
