const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{if(c){pass++;console.log('  ✓ '+m)}else{fail++;console.log('  ✗ FAIL: '+m)}};
const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};
const STADIUM=w.eval('STADIUM');

console.log('\n=== BI. 一覧ページから各場のリンクを探す ===');
const find=w.eval('findStadiumLink');
// HTML形式の一覧ページ（jcd付きリンク）
const IDX_HTML=`<html><body><ul>
<li><a href="/owpc/pc/extra/data/stadium/detail.html?jcd=01">桐生</a></li>
<li><a href="/owpc/pc/extra/data/stadium/detail.html?jcd=05">多摩川</a></li>
<li><a href="/owpc/pc/extra/data/stadium/detail.html?jcd=24">大村</a></li>
</ul></body></html>`;
let u=find(IDX_HTML,'05','多摩川');
ok(u && u.includes('jcd=05'),`HTMLからリンク発見: ${u}`);
ok(u.startsWith('https://www.boatrace.jp/'),'相対URLを絶対URLに変換');
ok(find(IDX_HTML,'24','大村').includes('jcd=24'),'別の場も正しく探せる');
ok(!find(IDX_HTML,'05','多摩川').includes('jcd=01'),'他場のリンクを拾わない');

// jcdが無く場名だけのリンク
const IDX_NAME=`<html><body>
<a href="/owpc/pc/extra/data/stadium/tamagawa.html">多摩川</a>
<a href="/owpc/pc/extra/data/stadium/kiryu.html">桐生</a>
</body></html>`;
ok(find(IDX_NAME,'05','多摩川').includes('tamagawa'),'場名からもリンクを探せる');

// Markdown形式（r.jina.ai 経由）
const IDX_MD=`# ボートレース場データ\n\n- [桐生](https://www.boatrace.jp/owpc/pc/extra/data/stadium/detail.html?jcd=01)\n- [多摩川](https://www.boatrace.jp/owpc/pc/extra/data/stadium/detail.html?jcd=05)\n`;
ok(find(IDX_MD,'05','多摩川').includes('jcd=05'),'Markdownからもリンクを探せる');
ok(find(IDX_MD,'99','存在しない場')===null,'見つからなければ null');

console.log('\n=== BJ. URLの候補と記憶 ===');
const cands=w.eval('stadiumUrlCandidates');
const list=cands('05');
ok(list.length>=4,`候補URLが${list.length}本`);
ok(list.some(x=>x.includes('extra/data/stadium')),'正しいパス extra/data/stadium を含む');
ok(list.every(x=>x.includes('jcd=05')),'すべて対象の場コード');
w.eval('rememberStadiumUrl')('https://www.boatrace.jp/owpc/pc/extra/data/stadium/detail.html?jcd=05','05');
const saved=w.localStorage.getItem('boatai_stadium_url_v1');
ok(saved && saved.includes('{jcd}'),`テンプレートとして記憶: ${saved}`);
ok(cands('24')[0].includes('jcd=24'),'記憶したパターンを別の場へ適用');

console.log('\n=== BK. 貼り付けから場データを取り込む（通信不要） ===');
const PAGE=`住之江ボートレース場
コース別入着率&決まり手
コース 1着 2着 3着 4着 5着 6着 逃げ 捲り 差し 捲り差し 抜き 恵まれ
1 57.2 14.8 9.0 7.5 7.3 4.2 93.0 0.0 0.0 0.0 6.5 0.5
2 12.5 26.0 18.8 17.0 13.2 12.5 0.0 33.0 56.0 0.0 11.0 0.0
3 12.0 23.5 18.5 18.0 15.5 12.5 0.0 47.0 10.5 36.0 6.5 0.0
4 10.8 16.2 19.5 18.2 18.0 17.3 0.0 49.0 21.0 19.5 9.0 1.5
5 6.2 13.0 18.5 20.3 21.0 21.0 0.0 12.0 7.0 62.5 16.5 2.0
6 2.3 6.0 17.2 19.5 25.5 29.5 0.0 34.5 24.0 30.0 11.5 0.0
(集計期間：2026/06/01～2026/08/31 単位：%)
枠番別コース取得率
枠 1コース 2コース 3コース 4コース 5コース 6コース
1 98.5 0.5 0.5 0.3 0.1 0.1
2 1.0 93.0 4.5 1.0 0.3 0.2
3 0.2 4.0 91.0 4.0 0.5 0.3
4 0.1 1.5 3.0 87.0 5.5 2.9
5 0.1 0.5 0.6 6.0 84.0 8.8
6 0.1 0.5 0.4 1.7 9.6 87.7
MEMO
水質 ： 淡水
干満差 ： なし`;
d.getElementById('venue').value='12';
d.getElementById('stadiumPasteBox').value=PAGE;
w.parseStadiumPaste();
ok(!!STADIUM['12'],'住之江のデータが取り込まれた');
ok(STADIUM['12'].course[1][0]===57.2,`1コース1着率 57.2 (${STADIUM['12'].course[1][0]})`);
ok(STADIUM['12'].kimarite[1][0]===93.0,'決まり手も取得');
ok(STADIUM['12'].entry[1][0]===98.5,'枠なり率も取得');
ok(STADIUM['12'].water==='淡水','水質も取得');
ok(d.getElementById('stadiumNotice').textContent.includes('取り込みました'),'成功を通知');

console.log('\n=== BL. 壊れた貼り付けは取り込まない ===');
const before=JSON.stringify(STADIUM['12']);
d.getElementById('stadiumPasteBox').value='これはただの文章です';
w.parseStadiumPaste();
ok(JSON.stringify(STADIUM['12'])===before,'無関係な内容では既存データを壊さない');
ok(d.getElementById('stadiumNotice').textContent.includes('読み取れません'),'失敗を明示');

console.log('\n=== BM. 取り込み済みの場数を表示 ===');
w.renderVenueInfo();
const doneTxt=d.getElementById('stadiumDone').textContent;
ok(doneTxt.includes('2場'),`取り込み済み場数を表示: ${doneTxt}`);
ok(doneTxt.includes('多摩川')&&doneTxt.includes('住之江'),'場名も表示');

console.log('\n=== BN. 保存され次回も使えるか ===');
ok(w.localStorage.getItem('boatai_stadium_v1')!==null,'端末に保存されている');
const reloaded=JSON.parse(w.localStorage.getItem('boatai_stadium_v1'));
ok(reloaded['12'] && reloaded['12'].course[1][0]===57.2,'保存内容が正しい');
ok(reloaded['05'] && reloaded['05'].course[1][0]===55.6,'多摩川も保存されている');

console.log('\n=== BO. 住之江の予想に実測が効くか ===');
const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
['4064','4688','4686','4266','3783','3557'].forEach((r,i)=>{d.getElementById('reg'+(i+1)).value=r});
w.syncRegsFromInputs();
state.boats.forEach(b=>{ setField(b,'grade','A1','official'); setField(b,'nationalWinRate',6.0,'official');
  setField(b,'localWinRate',6.0,'official'); setField(b,'motor2Rate',50,'official'); });
d.getElementById('venue').value='12'; d.getElementById('raceDate').value='2026-09-22';
d.getElementById('raceNo').value='12'; d.getElementById('budget').value='1000';
const ctx=w.scoreAll();
ok(!!ctx.courseRates,'住之江でも実測が使われる');
const lbl=w.boatOf(1).scoreBreakdown.find(p=>p.label.includes('実測')||p.label.includes('場特性'));
ok(lbl&&lbl.label.includes('実測'),`実測と明記: ${lbl&&lbl.label}`);
w.validateAll(); w.generateReport();
const rep=d.getElementById('report').textContent;
ok(rep.includes('57.2'),'レポートに住之江の実測1着率が出る');
ok(d.querySelectorAll('.betrow').length===6,'買い目6点');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
