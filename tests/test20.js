/* 取得ボタンを最後まで通す（表示を作る途中で落ちないか）
   ------------------------------------------------------------------
   実際に起きた不具合：オッズの取得と解析は成功していたのに、
   成功メッセージの中で消したはずの値（chk.m1）を参照していて例外になり、
   catch が「オッズを取得できませんでした」と表示していた。
   解析だけを試すテストでは見つからない。ボタンを最後まで通して確かめる。 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

function makeDom(fetchImpl){
  const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
   {runScripts:'dangerously',url:'https://ken5moai.github.io/',
    beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.alert=()=>{};
      w.fetch=fetchImpl; }});
  dom.window.Element.prototype.scrollIntoView=function(){};
  return dom;
}
/* 取得は400文字未満の応答を「中身が無い」とみなして次の経路を試す。
   テスト用のページも、その足切りを超える長さにしておく。 */
const pad = ('<div class="footer">ボートレースを知る楽しむ レーススケジュール データファイル テレポート '
  + 'ボートレーサー検索 ボートレース場データ SG PG1 G1記録集 高配当ベスト10 優勝レーサー一覧 '
  + 'ダウンロード・他 ネット投票会員登録 各種サービス マイページ 投票結果 ログイン情報をお忘れの方 '
  + 'お客様情報の照会・変更 FAQ お問い合わせ テレポート会員限定キャンペーン テレポートリンク '
  + '本日のレース 本日の払戻金一覧 月間スケジュール ヴィーナスシリーズ ルーキーシリーズ マスターズリーグ '
  + 'メディア情報 本サイトについて サイトポリシー プライバシーポリシー サイトマップ ご意見・ご要望 '
  + 'ボートレース関係団体 メールマガジン購読</div>');
const ok200 = text => async()=>({ ok:true, status:200, text:async()=>text+pad, headers:{get:()=>'text/html'} });

/* 本物に近いオッズページ（1コース有利の普通のレース） */
function oddsPage(){
  const combos=[]; for(let a=1;a<=6;a++)for(let b=1;b<=6;b++){if(b===a)continue;
    for(let c=1;c<=6;c++){if(c===a||c===b)continue;combos.push(`${a}-${b}-${c}`);}}
  const W1={1:.55,2:.14,3:.12,4:.11,5:.06,6:.02},W2={1:.30,2:.24,3:.20,4:.14,5:.07,6:.05},
        W3={1:.25,2:.22,3:.20,4:.17,5:.09,6:.07};
  const base=combos.map(k=>{const[a,b,c]=k.split('-').map(Number);return W1[a]*W2[b]*W3[c];});
  const sum=base.reduce((x,y)=>x+y,0);
  const rows=combos.map((k,i)=>`<tr><td>${k}</td><td>${(Math.round(0.75/(base[i]/sum)*10)/10).toFixed(1)}</td></tr>`).join('');
  return `<html><body><h1>3連単オッズ boatrace</h1><table>${rows}</table></body></html>`;
}

(async()=>{
console.log('=== A. オッズ取得を最後まで通す ===');
{
  const dom=makeDom(ok200(oddsPage()));
  const w=dom.window,d=w.document;
  d.getElementById('venue').value='10'; d.getElementById('raceDate').value='2026-09-24';
  d.getElementById('raceNo').value='6';
  await w.fetchOdds();
  const note=d.getElementById('oddsNotice');
  ok(Object.keys(w.eval('state').oddsMap).length===120, `120通りが state に入る (${Object.keys(w.eval('state').oddsMap).length})`);
  ok(note.className.includes('ok'), `成功として表示される（class=${note.className}）`);
  ok(note.textContent.includes('120通り取得'), '成功メッセージが出る');
  ok(!note.textContent.includes('取得できませんでした'), '失敗メッセージを出さない');
  ok(/順位相関 [\d.]+/.test(note.textContent), `検算の数字が出る: ${(note.textContent.match(/Σ[^。]*/)||[''])[0]}`);
  ok(!/undefined|NaN/.test(note.textContent), 'undefined や NaN が混ざらない');
  const logTxt=d.getElementById('log') ? d.getElementById('log').textContent : '';
  ok(!/undefined|NaN/.test(logTxt.split('オッズ')[1]||''), '記録にも undefined が出ない');
}

console.log('\n=== B. 取れないときはちゃんと失敗と言う ===');
{
  const dom=makeDom(ok200('<html><body>3連単オッズ boatrace まもなく発走です。オッズは締切後に確定します。</body></html>'));
  const w=dom.window,d=w.document;
  d.getElementById('venue').value='10'; d.getElementById('raceDate').value='2026-09-24';
  d.getElementById('raceNo').value='6';
  await w.fetchOdds();
  const note=d.getElementById('oddsNotice');
  ok(note.textContent.includes('読み取れませんでした'),
     `解析できなければ失敗と言う: ${note.textContent.replace(/\s+/g,' ').slice(0,80)}`);
  ok(Object.keys(w.eval('state').oddsMap).length===0, 'オッズは入れない');
}
{
  const dom=makeDom(async()=>{ throw new Error('つながりません'); });
  const w=dom.window,d=w.document;
  d.getElementById('venue').value='10'; d.getElementById('raceDate').value='2026-09-24';
  d.getElementById('raceNo').value='6';
  await w.fetchOdds();
  ok(d.getElementById('oddsNotice').textContent.includes('取得できませんでした'), '通信が失敗すれば失敗と言う');
}

console.log('\n=== C. 結果取得も最後まで通す ===');
{
  const page=`<html><body>レース結果 払戻 boatrace
    <table><tr><td>3連単</td><td>6-4-2</td><td>¥8,750</td></tr>
    <tr><td>3連複</td><td>2=4=6</td><td>¥2,230</td></tr>
    <tr><td>単勝</td><td>6</td><td>¥140</td></tr></table>決まり手 まくり</body></html>`;
  const dom=makeDom(ok200(page));
  const w=dom.window,d=w.document;
  d.getElementById('venue').value='10'; d.getElementById('raceDate').value='2026-09-24';
  d.getElementById('raceNo').value='6';
  /* 予想の記録が無ければ、その旨を出す */
  w.localStorage.setItem('boatai_records_v1','[]');
  await w.fetchResult();
  const n0=d.getElementById('resultNotice');
  ok(n0.textContent.includes('予想が記録にありません'),
     `予想が無ければそう言う: ${n0.textContent.replace(/\s+/g,' ').slice(0,90)}`);
  /* 予想があれば結果を入れる */
  w.localStorage.setItem('boatai_records_v1', JSON.stringify([
    {id:'2026-09-24_10_6', date:'2026-09-24', jcd:'10', rno:'6', picks:[], result:null}]));
  await w.fetchResult();
  const note=d.getElementById('resultNotice');
  ok(note.className.includes('ok'), `成功として表示される（class=${note.className}）`);
  ok(!/undefined|NaN/.test(note.textContent), 'undefined や NaN が混ざらない');
  const rec=w.loadRecords()[0];
  ok(rec.result && rec.result.combo==='6-4-2' && rec.result.payout===8750,
     `記録に入る（${rec.result&&rec.result.combo} ¥${rec.result&&rec.result.payout}）`);
  ok(rec.result.kimarite==='まくり', '決まり手も入る');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
})();
