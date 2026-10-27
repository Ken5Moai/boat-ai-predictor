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
  return {browser, ctx, page};
}

async function waitForLogin(page){
  console.log('\n  ブラウザを開きました。');
  console.log('  ★ 加入者番号・暗証番号・認証用パスワードは、ご自身で画面に打ってください。');
  console.log('    このスクリプトはそれを受け取りませんし、保存もしません。');
  await page.goto(LOGIN_URL, {waitUntil:'domcontentloaded'});
  await ask('\n  ログインが終わったら、ここで Enter を押してください > ');
  return true;
}

/* 画面にあるものを書き出す。押さない・入れない。
   ==================================================================
   はじめは VOTE_URL に自分で飛んでいたが、2026-10-27 に実機で走らせたら
   「投票サイトへ」というボタンのあるページで止まっていた（入力欄1個）。
   本当の投票画面はその先にあり、別のウィンドウか別のサイトで開く。
   どこにあるかは中に入らないと分からないので、こちらから飛ばない。
   人に進んでもらって、そのとき開いている画面を全部そのまま書き出す。

   ページが複数（別ウィンドウ・別タブ）開くので、ぜんぶ見る。
   投票の入力は iframe の中にあることも多いので、frame も中を見る。 */
async function probe(ctx, outPath){
  const look = async (target, label) => {
    try{
      return await target.evaluate(()=>{
        const take=(sel,f)=>[...document.querySelectorAll(sel)].slice(0,500).map(f);
        return {
          url: location.href, title: document.title,
          inputs: take('input,select,textarea', e=>({
            tag:e.tagName.toLowerCase(), type:e.type||'', id:e.id||'', name:e.name||'',
            cls:(e.className||'').toString().slice(0,80), ph:e.placeholder||'',
            value: e.type==='password' ? '(ふせた)' : String(e.value||'').slice(0,20),
            label:(e.labels&&e.labels[0]?e.labels[0].innerText:'').trim().slice(0,40)})),
          clickables: take('button,a[href],[role=button],input[type=submit],input[type=button],td,th', e=>({
            tag:e.tagName.toLowerCase(), id:e.id||'', name:e.name||'',
            text:(e.innerText||e.value||'').trim().slice(0,30),
            cls:(e.className||'').toString().slice(0,80)})).filter(c=>c.text||c.id),
          text: (document.body?document.body.innerText:'').slice(0,4000),
        };
      });
    }catch(e){ return {label, error:String(e.message).slice(0,120)}; }
  };

  const out=[];
  const pages = ctx.pages();
  for(let pi=0; pi<pages.length; pi++){
    const pg=pages[pi];
    const one = await look(pg, `page${pi}`);
    one.label = `page${pi}`;
    one.frames = [];
    for(const fr of pg.frames()){
      if(fr === pg.mainFrame()) continue;
      const f = await look(fr, 'frame');
      f.frameUrl = fr.url();
      one.frames.push(f);
    }
    out.push(one);
    const shot = outPath.replace(/\.\w+$/, `-page${pi}.png`);
    try{ await pg.screenshot({path:shot, fullPage:true}); }catch(e){}
  }

  fs.mkdirSync(path.dirname(outPath),{recursive:true});
  fs.writeFileSync(outPath, JSON.stringify(out,null,1));

  console.log(`\n  開いている画面 ${out.length}個 を ${outPath} に書き出しました。`);
  for(const o of out){
    const nf = (o.frames||[]).length;
    console.log(`    ${o.label}  入力欄${(o.inputs||[]).length}個 / 押せるもの${(o.clickables||[]).length}個`
                + `${nf?` / iframe ${nf}個`:''}`);
    console.log(`      ${o.url||'(URL不明)'}`);
    for(const f of (o.frames||[]))
      console.log(`      └ iframe 入力欄${(f.inputs||[]).length}個  ${f.frameUrl||''}`);
  }
  console.log(`  写真は ${outPath.replace(/\.\w+$/,'-pageN.png')} に保存しました。`);

  /* 押してはいけないものが実際にあるか、名前を並べて見せる（押さない） */
  const danger = out.flatMap(o=>(o.clickables||[])).filter(c=>NEVER_CLICK.some(w=>c.text.includes(w)));
  if(danger.length){
    console.log(`\n  ★ 押してはいけないもの（このスクリプトは押しません）`);
    for(const d of danger.slice(0,10)) console.log(`     「${d.text}」 id=${d.id||'-'} class=${d.cls.slice(0,40)}`);
  }
  console.log('\n  書き出したファイルを私に見せてください。画面に合わせて続きを作ります。');
  console.log('  ※ 写真に加入者番号などが写っていないか、送る前に確かめてください。');
  console.log('    json にも入力欄の中身が入ります（パスワードはふせてあります）。');
}

/* ---- 本体 ----------------------------------------------------------- */
/* require されたときは走らせない（テストから probe だけ呼べるように） */
module.exports = { probe, loadPlan, openBrowser, NEVER_CLICK,
                   MAX_YEN_PER_RACE, MAX_YEN_PER_POINT, MAX_POINTS };
if(require.main !== module) return;

(async()=>{
  try{
    if(PROBE){
      const {browser,ctx,page}=await openBrowser();
      await waitForLogin(page);
      console.log('\n  つぎに、買い目を入れる画面まで、ご自身で進んでください。');
      console.log('    「投票サイトへ」を押す → 場とレースを選ぶ → 3連単の入力画面を出す');
      console.log('    別のウィンドウが開いても構いません。開いたまま進めてください。');
      console.log('  ★ 金額は入れなくて構いません。入れても、このスクリプトは買いません。');
      await ask('\n  買い目を入れる画面が出たら、ここで Enter > ');
      await probe(ctx, path.join(__dirname,'tmp','vote-probe.json'));
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
