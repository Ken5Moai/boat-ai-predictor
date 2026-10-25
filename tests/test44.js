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
const s2=out.split('=== 「至極の一点 / 本線10点 / 波乱8点」で買ったら ===')[1]||'';
const grab=re=>{ const m=s2.match(re); return m?m.slice(1):null; };
const top =grab(/至極の一点だけ（1点）\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*\d+%\s+的中\s*(\d+)\/(\d+)/);
const main=grab(/本線だけ（10点）\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*\d+%\s+的中\s*(\d+)\/(\d+)/);
const ana =grab(/波乱だけ（8点）\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*\d+%\s+的中\s*(\d+)\/(\d+)/);
const all =grab(/本線10＋波乱8（18点）\s+投資¥\s*\d+\s+回収率\s*(\d+)%\s+最大1件除くと\s*\d+%\s+的中\s*(\d+)\/(\d+)/);
ok(!!(top&&main&&ana&&all), '至極 / 本線 / 波乱 / 18点 の実測を読めた');
if(top&&main&&ana&&all){
  ok(HTML.includes(`実測${main[0]}%（${main[1]}/${main[2]}）`), `本線の実測 ${main[0]}%（${main[1]}/${main[2]}）が載っている`);
  ok(HTML.includes(`実測${ana[0]}%（${ana[1]}/${ana[2]}）`),   `波乱の実測 ${ana[0]}%（${ana[1]}/${ana[2]}）が載っている`);
  ok(flat.includes(`<td>本線10点だけ</td><td><b>${main[0]}%</b></td><td>${main[1]}/${main[2]}</td>`),
     '買い方の表の「本線10点だけ」が最新');
  ok(flat.includes(`<td>波乱8点だけ</td><td>${ana[0]}%</td><td>${ana[1]}/${ana[2]}</td>`),
     '買い方の表の「波乱8点だけ」が最新');
  ok(flat.includes(`<td>18点まとめて</td><td>${all[0]}%</td><td>${all[1]}/${all[2]}</td>`),
     '買い方の表の「18点まとめて」が最新');
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
  '18点ぜんぶ100円':      w('至極¥100 ＋ 残り17点¥100'),
  '至極¥500／他100円':    w('至極¥500 ＋ 残り17点¥100'),
  '至極¥1000／他100円':   w('至極¥1000 ＋ 残り17点¥100'),
  '本線10点ぜんぶ100円':  w('至極¥100 ＋ 残り9点¥100'),
  '本線・至極¥500／他100円':  w('至極¥500 ＋ 残り9点¥100'),
  '本線・至極¥1000／他100円': w('至極¥1000 ＋ 残り9点¥100'),
};
ok(Object.values(rows).every(v=>v!=null), '賭け金ごとの回収率を6通りとも読めた');
for(const [label,pct] of Object.entries(rows)){
  if(pct==null) continue;
  ok(flat.includes(`<td>${label}</td>`) &&
     new RegExp(`<td>${label.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}</td><td>[^<]*</td><td>(<b>)?${pct}%(</b>)?</td>`).test(flat),
     `${label} が ${pct}% で載っている`);
}

console.log('\n=== 古い件数の表記が残っていないか ===');
for(const n of ['31レース','55レース','57レース']){
  ok(!HTML.includes(n), `「${n}」という古い表記が残っていない`);
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
process.exit(fail?1:0);
