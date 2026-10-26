/* 買い目をテレボートの投票画面に打ち込むところまでを手伝う
   ==================================================================
   ★ このスクリプトは舟券を買いません。最後の確定ボタンは押しません。
     打ち込んだところで止まり、画面を見せて、押すかどうかは人が決めます。

   ★ 加入者番号・暗証番号・認証用パスワードは、このスクリプトが
     受け取りません。保存もしません。見えるブラウザが開くので、
     ログインはご自身で打ってください。スクリプトはログインが
     終わったあとの画面だけを触ります。

   使うところ
     ご自身のPC（Mac / Windows / Linux）で動かしてください。
     クラウド側のこのコンテナは使い捨てで、締切の時刻に動いている
     保証がありません。だから自動では買いません。買えません。

   用意
     node 18以上 と、このリポジトリ一式。はじめの1回だけ
       npm install playwright
       npx playwright install chromium

   使い方
     node vote-assist.js --probe
         ブラウザを開いてログイン画面を出す。ログインしたら、
         投票画面の作り（押せるもの・入れられるもの）を
         tmp/vote-probe.txt に書き出す。何も入力しない。
         ★ はじめはこれだけを実行してください。

     node vote-assist.js plan.json --dry
         ブラウザを開かず、入れる中身と上限だけを確かめる。

     node vote-assist.js plan.json
         ブラウザを開く → 自分でログイン → 買い目を入れる →
         最終確認の手前で止まる。

   plan.json の形
     { "jcd":"01", "rno":12, "date":"2026-10-26",
       "best":"1-2-3", "bestYen":500,
       "main":["1-2-3","1-2-4", ...10点],
       "ana" :["3-5-1", ...8点],
       "unitYen":100 }
     best は main の中に入っている組（1位の組）。別枠ではない。
     bestYen は、その1点だけ金額を変えたいときに使う。 */

const fs=require('fs'), path=require('path'), readline=require('readline');

/* ---- 上限。ここを超える plan は実行しない ---------------------------
   コマンドの引数では変えられないようにしてある。変えるにはこの行を
   書き換えること。締切3分前に数字を打ち間違えても、ここで止まる。 */
const MAX_YEN_PER_RACE = 5000;    /* 1レースの合計 */
const MAX_YEN_PER_POINT = 1000;   /* 1点あたり */
const MAX_POINTS = 24;            /* 点数 */

/* ---- 絶対に押さないもの ---------------------------------------------
   投票を確定させるボタン。見つけても押さない。
   テレボートの画面の作りはまだ実物で確かめていないので、
   --probe で出した一覧を見て、ここに足していくこと。
   「押さないものの一覧」は、増やすぶんには安全側に働く。 */
const NEVER_CLICK = [
  '投票', '投票する', '購入', '購入する', '確定', 'ベット',
  'BET', 'bet', '金額確定', '投票内容確認',
];

const LOGIN_URL = 'https://www.boatrace.jp/owpc/pc/login_?authAfterTrans=stay';
const VOTE_URL  = 'https://www.boatrace.jp/owpc/VoteConfirm.xhtml?authAfterTrans=stay&voteTagId=commonHead';

const args=process.argv.slice(2);
const PROBE=args.includes('--probe');
const DRY=args.includes('--dry');
const planPath=args.find(a=>!a.startsWith('--'));

const ask = q => new Promise(r=>{
  const rl=readline.createInterface({input:process.stdin,output:process.stdout});
  rl.question(q, a=>{ rl.close(); r(a.trim()); });
});

/* ---- plan を読んで確かめる ----------------------------------------- */
function loadPlan(p){
  if(!p) throw new Error('plan.json を渡してください（--probe なら不要）');
  const j=JSON.parse(fs.readFileSync(p,'utf8'));
  const need=['jcd','rno','main','ana'];
  for(const k of need) if(j[k]==null) throw new Error(`plan.json に ${k} がありません`);
  const unit=j.unitYen ?? 100;
  const bestYen=j.bestYen ?? unit;
  const combo=/^[1-6]-[1-6]-[1-6]$/;
  const all=[...j.main, ...j.ana];
  for(const c of all){
    if(!combo.test(c)) throw new Error(`組番の形が違います: ${c}`);
    const d=c.split('-'); if(new Set(d).size!==3) throw new Error(`同じ艇が2回出ています: ${c}`);
  }
  if(new Set(all).size!==all.length) throw new Error('同じ組番が2回入っています（重複買いになります）');
  if(j.best && !j.main.includes(j.best)) throw new Error(`best ${j.best} が main の中にありません`);

  /* 金額。best だけ別の額にできる */
  const rows=all.map(c=>({combo:c, yen: c===j.best ? bestYen : unit,
                          kind: j.main.includes(c)?'本線':'波乱'}));
  const total=rows.reduce((a,r)=>a+r.yen,0);

  if(rows.length>MAX_POINTS) throw new Error(`点数が多すぎます: ${rows.length}点（上限${MAX_POINTS}点）`);
  for(const r of rows) if(r.yen>MAX_YEN_PER_POINT)
    throw new Error(`1点が高すぎます: ${r.combo} ¥${r.yen}（上限¥${MAX_YEN_PER_POINT}）`);
  if(total>MAX_YEN_PER_RACE) throw new Error(`合計が高すぎます: ¥${total}（上限¥${MAX_YEN_PER_RACE}）`);
  if(rows.some(r=>r.yen%100!==0)) throw new Error('100円単位でない金額があります');

  return {...j, unit, bestYen, rows, total};
}

function show(plan){
  console.log(`\n  ${plan.date||''} 場コード${plan.jcd} ${plan.rno}R  3連単`);
  console.log(`  ${plan.rows.length}点 / 合計 ¥${plan.total.toLocaleString()}\n`);
  for(const r of plan.rows)
    console.log(`    ${r.combo}   ¥${String(r.yen).padStart(5)}   ${r.kind}${r.combo===plan.best?'（至極の一点）':''}`);
  console.log(`\n  上限  1レース¥${MAX_YEN_PER_RACE.toLocaleString()} / 1点¥${MAX_YEN_PER_POINT.toLocaleString()} / ${MAX_POINTS}点`);
}

/* ---- ブラウザ ------------------------------------------------------- */
async function openBrowser(){
  let pw; try{ pw=require('playwright'); }
  catch(e){ throw new Error('playwright が入っていません。npm install playwright && npx playwright install chromium'); }
  /* headless にはしない。何が起きているかを目で見られることが、
     このスクリプトのいちばん大事なところ。 */
  const browser=await pw.chromium.launch({headless:false, args:['--window-size=1280,960']});
  const ctx=await browser.newContext({viewport:{width:1280,height:900}});
  const page=await ctx.newPage();
  return {browser, page};
}

async function waitForLogin(page){
  console.log('\n  ブラウザを開きました。');
  console.log('  ★ 加入者番号・暗証番号・認証用パスワードは、ご自身で画面に打ってください。');
  console.log('    このスクリプトはそれを受け取りませんし、保存もしません。');
  await page.goto(LOGIN_URL, {waitUntil:'domcontentloaded'});
  await ask('\n  ログインが終わったら、ここで Enter を押してください > ');
  return true;
}

/* 画面にあるものを書き出す。押さない・入れない。 */
async function probe(page, outPath){
  await page.goto(VOTE_URL, {waitUntil:'domcontentloaded'}).catch(()=>{});
  await page.waitForTimeout(2000);
  const info=await page.evaluate(()=>{
    const take=(sel,f)=>[...document.querySelectorAll(sel)].slice(0,400).map(f);
    return {
      url: location.href,
      title: document.title,
      inputs: take('input,select,textarea', e=>({
        tag:e.tagName.toLowerCase(), type:e.type||'', id:e.id||'', name:e.name||'',
        cls:(e.className||'').toString().slice(0,80), ph:e.placeholder||'',
        label:(e.labels&&e.labels[0]?e.labels[0].innerText:'').trim().slice(0,40)})),
      clickables: take('button,a[href],[role=button],input[type=submit],input[type=button]', e=>({
        tag:e.tagName.toLowerCase(), id:e.id||'', name:e.name||'',
        text:(e.innerText||e.value||'').trim().slice(0,40),
        cls:(e.className||'').toString().slice(0,80)})),
      frames: [...document.querySelectorAll('iframe')].map(f=>f.src||f.name||'(no src)'),
    };
  });
  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath, JSON.stringify(info,null,1));
  const shot=outPath.replace(/\.\w+$/,'.png');
  await page.screenshot({path:shot, fullPage:true});
  console.log(`\n  画面の作りを ${outPath} に書き出しました。`);
  console.log(`  画面の写真を ${shot} に保存しました。`);
  console.log(`  入力欄 ${info.inputs.length}個 / 押せるもの ${info.clickables.length}個 / iframe ${info.frames.length}個`);
  /* 押してはいけないものが実際にあるか、名前を並べて見せる */
  const danger=info.clickables.filter(c=>NEVER_CLICK.some(w=>c.text.includes(w)));
  if(danger.length){
    console.log(`\n  ★ 押してはいけないもの（このスクリプトは押しません）`);
    for(const d of danger) console.log(`     「${d.text}」 id=${d.id||'-'} class=${d.cls.slice(0,40)}`);
  }
  console.log('\n  この2つのファイルを私に見せてください。画面に合わせて続きを作ります。');
  console.log('  ※ 写真に加入者番号などが写っていないか、送る前に確かめてください。');
}

/* ---- 本体 ----------------------------------------------------------- */
(async()=>{
  try{
    if(PROBE){
      const {browser,page}=await openBrowser();
      await waitForLogin(page);
      await probe(page, path.join(__dirname,'tmp','vote-probe.json'));
      await ask('\n  ブラウザを閉じてよければ Enter > ');
      await browser.close();
      return;
    }

    const plan=loadPlan(planPath);
    show(plan);

    if(DRY){
      console.log('\n  --dry なので、ブラウザは開きません。中身と上限の確認だけです。');
      return;
    }

    console.log('\n  ★ まだ投票画面の作りを実物で確かめていません。');
    console.log('    先に node vote-assist.js --probe を実行して、');
    console.log('    出てきた2つのファイルを見せてください。');
    console.log('    それを見てから、打ち込む部分を作ります。');
    console.log('    実物を見ずに書いた手順で金額の画面を触るのは危ないので、ここで止めます。');
    process.exitCode=2;
  }catch(e){
    console.error('\n  ✗ '+e.message);
    process.exitCode=1;
  }
})();
