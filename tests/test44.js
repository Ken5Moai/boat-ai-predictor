/* 画面に書いた実測値が、いまの backtest.js の計算と合っているか
   ------------------------------------------------------------------
   index.html は1枚の静的ファイルなので、実測値をベタ書きしている。
   レースを足すたびにその数字は古くなるが、見た目は何も変わらない。
   実際このセッションだけで、31レース時点・55レース時点・57レース時点の
   数字が3箇所に残っているのを後から見つけた。
   「気づいたら直す」では必ず取りこぼすので、ずれたら落ちる形にする。

   やり方は単純で、backtest.js を実際に走らせて出力を読み、
   index.html の表の行と突き合わせる。計算を書き写さないので、ずれようがない。

   このテストが落ちたときは、index.html の数字を出力どおりに直すこと。
   テストの期待値のほうを動かさないこと（それをやると意味が無くなる）。 */
const fs=require('fs'),path=require('path'),{execFileSync}=require('child_process');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };
const ROOT=path.join(__dirname,'..');
const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const flat=HTML.replace(/\s+/g,'');

let out='';
try{ out=execFileSync(process.execPath,[path.join(ROOT,'backtest.js')],
  {encoding:'utf8', maxBuffer:64*1024*1024}); }
catch(e){ out=(e.stdout||'')+(e.stderr||''); }
ok(out.includes('=== 上位N点を1点100円で買ったら'), 'backtest.js が走って出力が取れた');

/* 「 10点  回収率 121%  的中34/67」の形を拾う */
const table={};
const sec=out.split('=== 上位N点を1点100円で買ったら（全レース） ===')[1]||'';
for(const m of sec.matchAll(/^\s*(\d+)点\s+回収率\s*(\d+)%\s+的中(\d+)\/(\d+)\s*$/gm)){
  table[m[1]]={pct:m[2], hit:m[3], n:m[4]};
}
const V_n = (sec.match(/対象 (\d+)レース/)||[])[1];
ok(!!V_n, `backtest.js が対象レース数（${V_n}）を出している`);
ok(Object.keys(table).length>=8, `点数ごとの実測を ${Object.keys(table).length} 件読めた`);

console.log('\n=== 点数ごとの表が最新か ===');
for(const n of Object.keys(table)){
  const t=table[n];
  const plain = `<td>${n}点</td><td>${t.pct}%</td><td>${t.hit}/${t.n}</td>`;
  const bold  = `<td><b>${n}点</b></td><td><b>${t.pct}%</b></td><td>${t.hit}/${t.n}</td>`;
  const found = flat.includes(plain) || flat.includes(bold);
  /* 画面に載せていない点数まで強制はしない。載っているなら正しいこと、を見る。 */
  const listed = new RegExp(`<td>(<b>)?${n}点(</b>)?</td>`).test(flat);
  if(!listed){ console.log(`  － ${n}点 は画面に載せていない`); continue; }
  ok(found, `${n}点 が ${t.pct}% ${t.hit}/${t.n} で載っている`);
}

console.log('\n=== 至極 / 本線 / 波乱 の実測が最新か ===');
/* 買う点数は index.html の BUY_POINTS が持っている。
   節の名前も行の見出しも点数を含むので、ここに書き写すと
   点数を変えた日にテストだけが古い見出しを探して落ちる
   （2026-10-29 に実際に落ちた）。本体から読む。 */
const PTS = (()=>{
  const m=HTML.match(/const BUY_POINTS = \{\s*main:\s*(\d+),\s*ana:\s*(\d+)\s*\}/);
  if(!m) throw new Error('index.html の BUY_POINTS が読めません');
  return {main:Number(m[1]), ana:Number(m[2])};
})();
const PTS_ALL = PTS.main + PTS.ana;
const s2=out.split(`=== 「至極の一点 / 本線${PTS.main}点 / 波乱${PTS.ana}点」で買ったら ===`)[1]||'';
const grab=re=>{ const m=s2.match(re); return m?m.slice(1):null; };
const top =grab(/至極の一点だけ（1点）\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*\d+%\s+的中\s*(\d+)\/(\d+)/);
const TAIL = String.raw`\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*\d+%\s+的中\s*(\d+)\/(\d+)`;
const main=grab(new RegExp(`本線だけ（${PTS.main}点）`+TAIL));
const ana =grab(new RegExp(`波乱だけ（${PTS.ana}点）`+TAIL));
const all =grab(new RegExp(`本線${PTS.main}＋波乱${PTS.ana}（${PTS_ALL}点）`+TAIL));
ok(!!(top&&main&&ana&&all), `至極 / 本線 / 波乱 / ${PTS_ALL}点 の実測を読めた`);
if(top&&main&&ana&&all){
  ok(HTML.includes(`実測${main[0]}%（${main[1]}/${main[2]}）`), `本線の実測 ${main[0]}%（${main[1]}/${main[2]}）が載っている`);
  ok(HTML.includes(`実測${ana[0]}%（${ana[1]}/${ana[2]}）`),   `波乱の実測 ${ana[0]}%（${ana[1]}/${ana[2]}）が載っている`);
  /* 表の見出しは index.html の中で ${plan.main.length} のような式になった
     （点数を書き写すとずれるため）。ソースを見るこのテストでは、
     式の部分は当てにせず、回収率と的中だけを突き合わせる。 */
  ok(flat.includes(`点だけ</td><td><b>${main[0]}%</b></td><td>${main[1]}/${main[2]}</td>`),
     `買い方の表の「本線${PTS.main}点だけ」が最新（${main[0]}% ${main[1]}/${main[2]}）`);
  ok(flat.includes(`点だけ</td><td>${ana[0]}%</td><td>${ana[1]}/${ana[2]}</td>`),
     `買い方の表の「波乱${PTS.ana}点だけ」が最新（${ana[0]}% ${ana[1]}/${ana[2]}）`);
  ok(flat.includes(`点まとめて</td><td>${all[0]}%</td><td>${all[1]}/${all[2]}</td>`),
     `買い方の表の「${PTS_ALL}点まとめて」が最新（${all[0]}% ${all[1]}/${all[2]}）`);
  ok(HTML.includes(`当たる回数は${main[1]}→${all[1]}に増えますが、回収率は${main[0]}%→${all[0]}%に落ちます`),
     '波乱を足したときの増減が最新');
  ok(HTML.includes(`この1点だけで買うと実測${top[0]}%（${top[2]}レース・${top[1]}/${top[2]}）`),
     `至極だけの実測 ${top[0]}%（${top[1]}/${top[2]}）が最新`);
  ok(HTML.includes(`至極の一点だけで買うと<b>${top[0]}%（${top[1]}/${top[2]}）</b>`),
     '買い方の表の下に書いた至極の実測も最新');
}

console.log('\n=== 賭け金を変えたときの実測が最新か ===');
const s3=out.split('=== 至極の一点だけ厚く賭けたら ===')[1]||'';
const w=(label)=>{ const m=s3.match(new RegExp(label+'\\s+投資¥\\s*\\d+\\s+払戻¥\\s*\\d+\\s+収支[+-]¥\\s*[\\d,]+\\s+回収率\\s*(\\d+)%')); return m?m[1]:null; };
const rows={
  /* 画面側の見出しは ${plan.all.length} のような式になっている（点数を
     書き写さないため）。ソースを見るこのテストでは、式の部分は当てにせず
     「…点ぜんぶ100円」のうしろの回収率だけを突き合わせる。 */
  ['点ぜんぶ100円（合計）']:  w(`至極¥100 ＋ 残り${PTS_ALL-1}点¥100`),
  '至極¥500／他100円':    w(`至極¥500 ＋ 残り${PTS_ALL-1}点¥100`),
  '至極¥1000／他100円':   w(`至極¥1000 ＋ 残り${PTS_ALL-1}点¥100`),
  ['点ぜんぶ100円（本線）']:  w(`至極¥100 ＋ 残り${PTS.main-1}点¥100`),
  '本線・至極¥500／他100円':  w(`至極¥500 ＋ 残り${PTS.main-1}点¥100`),
  '本線・至極¥1000／他100円': w(`至極¥1000 ＋ 残り${PTS.main-1}点¥100`),
};
ok(Object.values(rows).every(v=>v!=null), '賭け金ごとの回収率を6通りとも読めた');
for(const [label,pct] of Object.entries(rows)){
  if(pct==null) continue;
  /* 「点ぜんぶ100円（合計）」「（本線）」は、画面側が式になっている行。
     合計のほうは <td>88%</td>、本線のほうは <td><b>71%</b></td> と
     強調の有無が違うので、そこで見分ける。 */
  const ok2 = label==='点ぜんぶ100円（合計）'
      ? new RegExp(`点ぜんぶ100円</td><td>[^<]*</td><td>${pct}%</td>`).test(flat)
    : label==='点ぜんぶ100円（本線）'
      ? new RegExp(`点ぜんぶ100円</td><td>[^<]*</td><td><b>${pct}%</b></td>`).test(flat)
    : flat.includes(`<td>${label}</td>`) &&
      new RegExp(`<td>${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</td><td>[^<]*</td><td>(<b>)?${pct}%(</b>)?</td>`).test(flat);
  ok(ok2, `${label} が ${pct}% で載っている`);
}

console.log('\n=== 「全体で何レース」の表記が最新か ===');
/* 以前はここで『55レース』などの文字列が残っていないかを見ていた。
   件数が増えると、別の意味の55（例：進入が枠なりだったレース数）に当たって
   誤検知する。実際に F非該当が55件になった時点で落ちた。

   見たいのは『全体で何レースぶんの実測か』を書いている箇所だけなので、
   そういう言い回しに限って拾い、全部が同じ件数を指しているかを見る。
   内訳の件数（該当◯件、非該当◯レース）はここでは見ない。 */
{
  const pats = [
    [/実測(\d+)レースで<b>1着の的中/g, '1着の的中'],
    /* 「（28レース時点）」のように、古い測定だと断ったうえで残している表がある。
       そこは意図的に古いので拾わない。拾うのは見出しの
       「まだ決まっていないこと（Nレース時点）」だけ。 */
    [/まだ決まっていないこと（(\d+)レース時点）/g, "測って決めたことの見出し"],
    [/(\d+)レース時点で、本線10点/g,  'やめどきの目安'],
    [/点数ごとの実測（(\d+)レース/g,  '点数ごとの実測'],
    [/本線を10点に増やすほうが実測では上です（(\d+)レース/g, '同じお金を使うなら'],
    [/この枠を本線に足しても、(\d+)レースで/g, '荒れ予想カード'],
    [/飛びやすい形か<\/b>（(\d+)レースで測った/g, '形の判定'],
    [/穴を足すと、実測では回収率が下がります（(\d+)レース/g, '穴の説明'],
    [/この1点だけで買うと実測\d+%（(\d+)レース・/g, '至極の一点'],
  ];
  let bad=0, found=0;
  for(const [re,label] of pats){
    for(const m of HTML.matchAll(re)){
      found++;
      if(m[1] !== String(V_n)){ bad++; console.log(`    ${label}: ${m[1]}レース（いまは ${V_n}レース）`); }
    }
  }
  ok(found >= 6, `全体の件数を書いている箇所を ${found} 件見つけた`);
  ok(bad === 0, `そのすべてが ${V_n}レースを指している`);
}

console.log('\n=== sync-figures の規則が全部当たっているか ===');
/* sync-figures.js は「画面のこの文の数字を、実測で置き換える」規則の束。
   文のほうを少し書き換えると規則が当たらなくなるが、黙って何もしないだけなので
   気づけない。その箇所の数字は、昔の値のまま画面に残り続ける。

   実際に2つ起きていた（2026-10-28に気づいた）。
     ・「いちばん効いた2レースを除くと—%」
       元の数字が消えて — になり、規則は \d+ しか探していないので二度と戻らない。
     ・「10点の85%とは-4ポイント違います」
       差が負になって符号が付き、\d+ に当たらなくなって 89%/85% のまま固定。
       本当は 82%/70% で、画面は 12ポイントの差を 4ポイントと言い続けていた。

   sync-figures.js は空振りした規則を自分で並べて出すので、それを読む。
   1つでも空振りしていれば落とす。 */
{
  const {execFileSync}=require('child_process');
  let out='';
  try{
    out=execFileSync(process.execPath,[path.join(ROOT,'sync-figures.js'),'--check'],
                     {encoding:'utf8', maxBuffer:64*1024*1024});
  }catch(e){ out=(e.stdout||'')+(e.stderr||''); }
  const i=out.indexOf('当たらなかった規則');
  if(i<0){
    ok(true, 'sync-figures の規則がすべて画面のどこかに当たっている');
  }else{
    const lines=out.slice(i).split('\n').slice(1).filter(l=>l.trim().startsWith('/'));
    ok(false, `sync-figures の規則が ${lines.length} 件空振りしている`
            + '（画面のその箇所は古い数字のまま。文を直すか規則を直すこと）');
    lines.slice(0,5).forEach(l=>console.log('      '+l.trim()));
  }
  /* 規則そのものが「— でも当たる」形になっているか。
     \d+ だけを探す書き方だと、一度 — が入った箇所は永久に直らない。 */
  const src=fs.readFileSync(path.join(ROOT,'sync-figures.js'),'utf8');
  const dashSafe=(src.match(/\(\?:\\d\+\|—\)/g)||[]).length;
  ok(dashSafe>=3, `数字が消えても当たる書き方 (?:\\d+|—) が ${dashSafe} 箇所ある（1箇所でも \\d+ だけだと戻せなくなる）`);
}

console.log('\n=== 直し方が用意されているか ===');
/* このテストが落ちたとき、何をすればいいのかが分からないと意味がない。
   sync-figures.js を走らせれば直る、という道が消えていないかを見る。 */
ok(fs.existsSync(path.join(ROOT,'sync-figures.js')), 'sync-figures.js がある（落ちたらこれを走らせる）');
{
  const src=fs.readFileSync(path.join(ROOT,'sync-figures.js'),'utf8');
  ok(/--check/.test(src), 'sync-figures.js に --check（書き換えずに差分だけ見る）がある');
  ok(/backtest\.js/.test(src), 'sync-figures.js は backtest.js を実際に走らせて値を取っている');
}
if(fail) console.log('\n  ※ 直し方: node sync-figures.js を走らせてから、もう一度テストする。');
console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
/* process.exit() は使わない（出力が切れる。理由は tests/run.js の末尾） */
process.exitCode = fail ? 1 : 0;
