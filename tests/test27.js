/* 「反映されない」ときに、原因が画面に出ること
   ------------------------------------------------------------------
   実際に起きたこと（2026-09-25 11:39）:
   STEP2に8Rの登録番号（4424/5329/4315/5345/4210/4112）を入れた状態で、
   7Rの出走表のスクショを読ませた。結果は「0/6艇に反映しました」＋
   「1号艇(登番4424)はスクショ内に見つかりません」×6。

   アプリの動作自体は正しい。スクショにその登番は写っていないのだから、
   推測で埋めないのは正しい。まずいのは画面の説明で、
     ・文字が小さくて読めなかったのか
     ・そもそも別のレースのスクショなのか
   の区別がつかないまま「見つかりません」としか出ていなかった。
   利用者からは「ちゃんと入力しているのにエラーになる」としか見えない。

   直したのは文言と診断で、読み取りの規則は変えていない
   （読めないものを推測で埋めるようにはしていない）。 */
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const HTML=fs.readFileSync(path.join(__dirname,'..','index.html'),'utf8');
const dom=new JSDOM(HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
 beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};
   w.alert=()=>{}; w.confirm=()=>true; }});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};

/* 実物に近い形のOCRテキスト。7Rの出走表。 */
const OCR7R = [
 '5143 / B1 常盤 海心 徳島/徳島 25歳/53.2kg F0 L0 0.19 全国 3.92 17.59 35.19',
 '3838 / B1 伊藤 啓三 埼玉/埼玉 51歳/52.4kg F0 L0 0.16 全国 5.40 32.67 55.45',
 '5090 / B1 生方 靖亜 群馬/群馬 25歳/52.9kg F1 L0 0.15 全国 5.16 32.14 53.57',
 '3617 / B1 竹田 広樹 佐賀/佐賀 53歳/52.4kg F1 L0 0.19 全国 3.63 20.00 26.25',
 '4894 / B1 原村 拓也 香川/香川 35歳/52.0kg F0 L0 0.19 全国 4.64 20.75 41.51',
 '5465 / B2 直江 健成 福井/福井 19歳/53.7kg F1 L0 -   全国 1.07 0.00 0.00'
].join('\n');

const REG8R=['4424','5329','4315','5345','4210','4112'];
REG8R.forEach((r,i)=>{ d.getElementById('reg'+(i+1)).value=r; });
w.syncRegsFromInputs();

console.log('\nスクショに写っている登番を数える');
const seen=w.scanRegsInOCR(OCR7R);
ok(seen.length===6, `6艇ぶんの登番を拾えた（${seen.length}件）`);
ok(seen.map(o=>o.reg).join(',')==='5143,3838,5090,3617,4894,5465',
   '拾った登番が出走表の並びどおり');
ok(seen[0].grade==='B1' && seen[5].grade==='B2', '級別も一緒に拾えている');
ok(w.scanRegsInOCR('モーター 55 43 26 年齢 25歳 52.4kg 6.84 -0.5').length===0,
   '級別が付いていない4桁は登番として拾わない（モーター番号との取り違え防止）');
ok(w.scanRegsInOCR('5143 / B1 ... 5143 / B1 ...').length===1,
   '同じ登番が2回写っていても1件として数える');

console.log('\n別のレースのスクショだと分かること ← 実際に起きた事故');
const msg=w.diagnoseOCRMiss(OCR7R);
ok(/別のレースのスクショの可能性/.test(msg), '「別のレースの可能性」と書いてある');
ok(/5143/.test(msg) && /5465/.test(msg), 'スクショに写っていた登番が全部出る');
ok(/4424/.test(msg), '入力した登番も出るので、見比べられる');
ok(/useScannedRegs/.test(msg), '入れ替えボタンが出る（6艇そろっているため）');

console.log('\nそのほかの場合');
ok(/登録番号を1つも読み取れませんでした/.test(w.diagnoseOCRMiss('なにも写っていない')),
   '登番が1つも無いときは「読み取れなかった」と出る');
const mix='4424 / A2 松尾 昂明 全国 5.50\n9999 / B1 だれか 全国 1.00';
ok(/このうち 1艇 が入力と一致/.test(w.diagnoseOCRMiss(mix)),
   '一部だけ一致したときは、その件数を出す');
ok(!/別のレースのスクショの可能性/.test(w.diagnoseOCRMiss(mix)),
   '一部一致のときに「別のレース」とは言わない');

console.log('\n入れ替えは勝手にやらない');
const src=HTML;
ok(/function useScannedRegs/.test(src), '入れ替えの関数がある');
ok(/confirm\(/.test(src.slice(src.indexOf('function useScannedRegs'),
                             src.indexOf('function useScannedRegs')+900)),
   '入れ替える前に本人に確認する（入力を黙って書き換えない）');
w.useScannedRegs('5143,3838,5090,3617,4894,5465');
ok(d.getElementById('reg1').value==='5143' && d.getElementById('reg6').value==='5465',
   '確認したうえで押せば入れ替わる');
w.useScannedRegs('5143,3838');
ok(d.getElementById('reg1').value==='5143', '6艇そろっていない入れ替えは実行されない');

console.log('\n公式照合が失敗した理由が画面に出ること');
ok(/理由（1件目）/.test(src), '照合できなかった理由を画面に出している');
ok(/通信が通らない場合は/.test(src), '通信が原因のときはスクショ経路へ案内している');
w.finishLookup(['1号艇: 取得できませんでした（proxy 403）']);
const rn=d.getElementById('regNotice').innerHTML;
ok(/理由（1件目）/.test(rn) && /403/.test(rn), '実際に理由が表示される');
ok(/スクショから読み取る/.test(rn), '通信エラーならスクショ経路を案内する');
w.finishLookup([]);
ok(!/理由（1件目）/.test(d.getElementById('regNotice').innerHTML),
   '理由が無いときは余計な行を出さない');

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
