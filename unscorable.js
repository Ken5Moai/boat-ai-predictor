/* 採点できなかったレースの一覧を作る
   ==================================================================
     node unscorable.js           … tmp/wholeday を見て data/unscorable.js を書く
     node unscorable.js --dry     … 何を書くかだけ出す

   なぜ要るのか。
   「まるごと1日そろった日だけで見る」は、選り好みの入っていない唯一の数字。
   ところが判定を「12レース全部そろっているか」でやっていたため、
   1本でも採点できないレースがあると、その日ぜんぶが捨てられていた。

   実際、2026-10-26 の常滑と福岡、10/28 の常滑は、欠場で5艇になった
   レースが1本あるだけで、残り11レースが使われていなかった。
   5艇レースは6艇前提のモデルでは採点できないので、入れないのは正しい。
   しかし「採点できないレースを除いた11レース」は、レースを選んでいない。
   選り好みは入っていないので、捨てる理由がない。

   そこで「なぜ入っていないのか」を記録する。
   記録の元は wholeday.js が捕獲時に残した skipped。
   そのうち、あとで取り直しても入らない理由だけを残す。
     ・欠場（オッズが60通り＝5艇）… 何度取っても5艇
     ・不成立 … レースが成立せず、着順も払戻も出ない
     ・中止   … 荒天などでレースを行わなかった
   「結果まだ（走っていない）」はまだ走っていなかっただけなので、
   ここには入れない（wholeday.js を走らせ直せば埋まる）。

   2026-10-28 の江戸川は6R以降が全部中止で、その日は5レースしか行われなかった。
   行われた5レースは全部記録してあるので、その日は「そろっている」。
   レースを選んでいないので、選り好みは入っていない。 */
const fs=require('fs'), path=require('path');
const ROOT=__dirname;
const DRY=process.argv.includes('--dry');
const WD=path.join(ROOT,'tmp','wholeday');
if(!fs.existsSync(WD)){ console.log(`${WD} がありません。`); process.exitCode=1; return; }

const HTML=fs.readFileSync(path.join(ROOT,'index.html'),'utf8');
const VN={}; { const re=/'(\d{2})':\{name:'([^']+)'/g; let m; while((m=re.exec(HTML))) VN[m[1]]=m[2]; }

/* あとで取り直しても入らない理由だけを拾う。
   判定を1箇所にまとめておく（wholeday.js の RETRYABLE の裏返し）。 */
const PERMANENT = why => /欠場|不成立|中止/.test(why);

const rows=[], pending=[];
for(const hd of fs.readdirSync(WD).sort()){
  const dir=path.join(WD,hd);
  if(!fs.statSync(dir).isDirectory()) continue;
  const date=`${hd.slice(0,4)}-${hd.slice(4,6)}-${hd.slice(6,8)}`;
  for(const f of fs.readdirSync(dir).filter(x=>/^\d\d\.json$/.test(x)).sort()){
    const j=JSON.parse(fs.readFileSync(path.join(dir,f),'utf8'));
    for(const s of (j.skipped||[])){
      const row={date, jcd:j.jcd, rno:s.rno, why:s.why, venue:VN[j.jcd]||j.jcd};
      (PERMANENT(s.why) ? rows : pending).push(row);
    }
  }
}

console.log(`採点できないと決まったレース ${rows.length}本`);
for(const r of rows) console.log(`  ${r.date} ${r.venue}${r.rno}R  ${r.why}`);
if(pending.length){
  console.log(`\nまだ決まっていないレース ${pending.length}本（取り直せば入る可能性がある。ここには書かない）`);
  for(const r of pending) console.log(`  ${r.date} ${r.venue}${r.rno}R  ${r.why}`);
  console.log('  → node wholeday.js <日付> を走らせ直してください。');
}

const body = `/* 採点できなかったレース（自動生成。node unscorable.js で作り直す）
   ------------------------------------------------------------------
   6艇前提のモデルでは採点できないレース。欠場で5艇になった回。
   「まるごと1日そろった日」の判定で、ここにあるレースは
   「無くてよい」として数える（その日を捨てない）。

   手で書かないこと。tmp/wholeday の捕獲結果から作る。 */
module.exports = [
${rows.map(r=>`  {date:'${r.date}',jcd:'${r.jcd}',rno:${r.rno},why:'${r.why}'},`).join('\n')}
];
`;
if(DRY){ console.log('\n--dry なので書いていません。'); return; }
const out=path.join(ROOT,'data','unscorable.js');
fs.writeFileSync(out, body);
/* 書いたものが読めるかをその場で確かめる。 */
delete require.cache[require.resolve(out)];
const back=require(out);
if(back.length!==rows.length){ console.log('✗ 書いたものを読み直せません'); process.exitCode=1; return; }
console.log(`\ndata/unscorable.js に ${rows.length}本を書きました。`);
