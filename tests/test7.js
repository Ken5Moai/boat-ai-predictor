const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const store={};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{};}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const V=w.eval('V'),state=w.eval('state'),newBoat=w.eval('newBoat'),STADIUM=w.eval('STADIUM');

console.log('\n=== BB. 組み込み済みの多摩川データ ===');
ok(!!STADIUM['05'],'多摩川のデータが入っている');
const tm=STADIUM['05'];
ok(tm.course[1][0]===55.6,`1コース1着率 55.6% (${tm.course[1][0]})`);
ok(tm.kimarite[1][0]===94.2,`1コースの逃げ 94.2% (${tm.kimarite[1][0]})`);
ok(tm.entry[1][0]===99.6,`1枠が1コースに入る率 99.6% (${tm.entry[1][0]})`);
ok(tm.water==='淡水'&&tm.tideRange==='なし','水質・干満差も収録');
[1,2,3,4,5,6].forEach(c=>{
  const s=tm.course[c].reduce((a,b)=>a+b,0);
  ok(Math.abs(s-100)<3.5,`${c}コースの入着率合計 ${s.toFixed(1)}%`);
});

console.log('\n=== BC. 季節の判定 ===');
const seasonOf=w.eval('seasonOf');
ok(seasonOf('2026-09-22')==='秋',`9月→秋 (${seasonOf('2026-09-22')})`);
ok(seasonOf('2026-01-15')==='冬',`1月→冬 (${seasonOf('2026-01-15')})`);
ok(seasonOf('2026-04-01')==='春',`4月→春 (${seasonOf('2026-04-01')})`);
ok(seasonOf('2026-07-30')==='夏',`7月→夏 (${seasonOf('2026-07-30')})`);
const vcr=w.eval('venueCourseRates');
ok(vcr('05','2026-09-22').rates[1][0]===52.4,`9月なら秋季の52.4%を使う (${vcr('05','2026-09-22').rates[1][0]})`);
ok(vcr('05','2026-01-10').rates[1][0]===56.2,`1月なら冬季の56.2%を使う (${vcr('05','2026-01-10').rates[1][0]})`);
ok(vcr('12','2026-09-22')===null,'未取り込みの場は null（目安値にフォールバック）');

console.log('\n=== BD. 公式ページの解析（実データ再現） ===');
const PAGE=`多摩川ボートレース場
最近3ヶ月のデータ
コース別入着率&決まり手
コース 1着 2着 3着 4着 5着 6着 逃げ 捲り 差し 捲り差し 抜き 恵まれ
1 55.6 15.3 9.1 7.9 7.7 4.1 94.2 0.0 0.0 0.0 5.4 0.2
2 12.0 26.5 18.5 17.4 12.9 12.4 0.0 34.1 55.6 0.0 10.1 0.0
3 12.3 23.1 18.2 18.1 15.6 12.4 0.0 48.1 9.8 35.8 6.1 0.0
4 11.3 16.0 19.7 18.0 17.8 16.9 0.0 50.0 20.2 18.9 9.4 1.3
5 6.7 13.3 18.1 20.1 20.9 20.6 0.0 11.3 6.8 63.6 15.9 2.2
6 2.6 6.2 17.0 19.2 25.4 29.4 0.0 35.2 23.5 29.4 11.7 0.0
(集計期間：2026/06/01～2026/08/31 単位：%)
枠番別コース取得率
枠 1コース 2コース 3コース 4コース 5コース 6コース
1 99.6 0.1 0.1 0.0 0.0 0.0
2 0.9 94.6 3.5 0.7 0.1 0.0
3 0.0 2.7 92.1 3.9 0.6 0.6
4 0.0 0.7 2.4 88.4 5.0 3.3
5 0.0 0.9 1.0 4.8 85.7 7.4
6 0.0 1.2 0.9 2.1 8.6 87.1
MEMO
所在地 ： 東京都
モーター ： 減音
水質 ： 淡水
干満差 ： なし
季節別データ
春季 のコース別入着率
コース 1着 2着 3着 4着 5着 6着
1 54.0 14.0 10.4 9.8 7.6 4.2
2 14.9 25.6 20.1 16.7 13.3 9.1
3 15.1 22.5 21.1 16.1 14.1 10.7
4 9.4 16.8 20.3 19.0 18.4 15.2
5 5.6 15.6 16.4 22.8 22.0 17.4
6 1.6 6.0 11.9 16.2 24.7 39.3
夏季 のコース別入着率
コース 1着 2着 3着 4着 5着 6着
1 55.6 15.3 9.1 7.9 7.7 4.1
2 12.0 26.5 18.5 17.4 12.9 12.4
3 12.3 23.1 18.2 18.1 15.6 12.4
4 11.3 16.0 19.7 18.0 17.8 16.9
5 6.7 13.3 18.1 20.1 20.9 20.6
6 2.6 6.2 17.0 19.2 25.4 29.4
秋季 のコース別入着率
コース 1着 2着 3着 4着 5着 6着
1 52.4 19.3 9.5 7.8 6.3 4.4
2 12.6 22.8 18.3 18.6 14.4 13.0
3 13.2 19.0 20.4 18.0 16.8 12.5
4 11.6 19.0 19.0 16.1 18.5 15.4
5 7.4 12.9 19.1 22.7 22.4 15.3
6 3.2 7.7 14.5 17.5 21.8 35.0
冬季 のコース別入着率
コース 1着 2着 3着 4着 5着 6着
1 56.2 14.6 9.4 7.5 7.0 5.0
2 12.4 25.1 20.0 16.9 14.4 10.8
3 10.8 20.8 21.2 18.1 15.2 13.6
4 12.4 16.4 18.2 20.6 18.2 13.9
5 6.1 14.3 17.8 18.9 23.0 19.6
6 2.9 9.8 14.6 19.2 21.6 31.6
水面図`;
const res=w.parseStadiumData(PAGE,'05');
ok(res.ok,'解析成功');
ok(res.detail.course===6,`コース別入着率 6行 (${res.detail.course})`);
ok(res.detail.kimarite===6,`決まり手 6行 (${res.detail.kimarite})`);
ok(res.detail.entry===6,`枠なり率 6行 (${res.detail.entry})`);
ok(res.detail.season===4,`季節別 4種 (${res.detail.season})`);
ok(res.data.course[1][0]===55.6&&res.data.kimarite[1][0]===94.2,'値が正確');
ok(res.data.entry[4][3]===88.4,`4枠が4コース 88.4% (${res.data.entry[4][3]})`);
ok(res.data.season['秋'][1][0]===52.4,'秋季データも正確');
ok(res.data.water==='淡水'&&res.data.tideRange==='なし','水質・干満差を取得');
ok(res.data.updated==='2026/08/31',`集計期間を取得 (${res.data.updated})`);

console.log('\n=== BE. 合計が100%にならない行は採用しない（誤読対策） ===');
const BROKEN=PAGE.replace('1 55.6 15.3 9.1 7.9 7.7 4.1','1 5.6 15.3 9.1 7.9 7.7 4.1');
const r2=w.parseStadiumData(BROKEN,'05');
ok(r2.detail.course===5,`検算に合わない1行を除外 (${r2.detail.course}/6行)`);
ok(!r2.ok,'6行揃わないので全体として不採用（誤ったデータを保存しない）');

console.log('\n=== BF. 実測データが枠の採点に効くか ===');
const REGS=['4064','4688','4686','4266','3783','3557'];
function setup(jcd,date){
  state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
  REGS.forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
  w.syncRegsFromInputs();
  state.boats.forEach(b=>{
    w.eval('setField')(b,'grade','A1','official');
    w.eval('setField')(b,'nationalWinRate',6.00,'official');
    w.eval('setField')(b,'localWinRate',6.00,'official');
    w.eval('setField')(b,'motor2Rate',50.0,'official');
  });
  d.getElementById('venue').value=jcd; d.getElementById('raceDate').value=date;
}
setup('05','2026-09-22');           // 多摩川・秋（実測あり）
let ctx=w.scoreAll();
ok(!!ctx.courseRates,'実測データがコンテキストに載る');
ok(ctx.courseRates.label==='秋季','秋季のデータを使用');
const lbl=w.boatOf(1).scoreBreakdown.find(p=>p.label.includes('実測')||p.label.includes('場特性'));
ok(lbl&&lbl.label.includes('実測'),`採点内訳に実測と明記: ${lbl&&lbl.label}`);
ok(lbl&&lbl.label.includes('コース'),`走るコースを明示: ${lbl&&lbl.label}`);
const s05=state.boats.map(b=>b.score);
setup('12','2026-09-22');           // 住之江（実測なし＝目安値）
w.scoreAll();
const s12=state.boats.map(b=>b.score);
ok(JSON.stringify(s05)!==JSON.stringify(s12),'場によって枠の評価が変わる');
const lbl12=w.boatOf(1).scoreBreakdown.find(p=>p.label.includes('場特性'));
ok(lbl12&&lbl12.label.includes('目安'),`未取り込みの場は目安と明記: ${lbl12&&lbl12.label}`);
console.log('  多摩川(実測):',s05.map(x=>x.toFixed(1)).join(', '));
console.log('  住之江(目安):',s12.map(x=>x.toFixed(1)).join(', '));

console.log('\n=== BG. レポートに実測データが出るか ===');
setup('05','2026-09-22');
d.getElementById('raceNo').value='12'; d.getElementById('budget').value='1000';
w.validateAll(); w.generateReport();
const rep=d.getElementById('report').textContent;
ok(rep.includes('実測'),'実測データのカードが出る');
ok(rep.includes('52.4'),'秋季の1着率52.4%が表示される');
ok(rep.includes('逃げ')||rep.includes('捲り'),'決まり手が表示される');
ok(rep.includes('淡水'),'水質が実測から表示される');
ok(!rep.includes('undefined')&&!rep.includes('NaN'),'表示崩れなし');
setup('12','2026-09-22');
d.getElementById('raceNo').value='12';
w.validateAll(); w.generateReport();
const rep12=d.getElementById('report').textContent;
ok(rep12.includes('まだ取り込まれていません'),'未取り込みの場は案内が出る');
ok(d.querySelectorAll('.betrow').length===6,'未取り込みでも買い目は出る');

console.log('\n=== BH. 端末への保存と復元 ===');
ok(typeof w.saveStadiumCache==='function'&&typeof w.loadStadiumCache==='function','保存・復元の機能がある');
STADIUM['22']={name:'福岡',water:'汽水',course:{1:[53,15,10,8,8,6],2:[12,25,19,17,14,13],3:[13,22,19,18,15,13],4:[11,17,19,18,18,17],5:[7,13,18,20,21,21],6:[3,7,16,19,25,30]}};
ok(w.saveStadiumCache()===true,'保存できる');
delete STADIUM['22'];
ok(!STADIUM['22'],'いったん消す');
ok(w.loadStadiumCache()>=1,'保存から復元できる');
ok(STADIUM['22']&&STADIUM['22'].course[1][0]===53,'復元後も値が正しい');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
