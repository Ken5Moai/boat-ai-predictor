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

     node vote-assist.js --race 15 8
         これひとつで終わる。ブラウザを開く → 自分でログイン →
         投票画面まで進む → Enter → そこで買い目を作って打ち込む →
         最終確認の手前で止まる。日付を足すこともできる（--race 15 8 20261027）。

     node vote-assist.js plan.json
         すでに作ってある買い目を使う場合。

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
/* 押すと投票が進む・確定するもの。実機の画面（2026-10-27 唐津6R）で確かめた。
   「投票入力完了」を押すと入力画面を離れて確認に進む。ここが引き返せる最後の線。
   このスクリプトは入力画面から出ない。 */
const NEVER_CLICK = [
  '投票入力完了', '投票する', '購入する', '確定', '金額確定', '投票内容確認',
  '投票を確定', 'ベットを確定',
];
/* 押してよいもの。買い目をリストに積むだけで、投票は進まない。
   「ベットリストに追加」は語に「ベット」を含むので、
   NEVER_CLICK に 'ベット' を入れていたときは誤って禁止側に入っていた。
   必要な操作まで禁止すると、結局人が90回手で押すことになる。 */
const OK_TO_CLICK = ['ベットリストに追加'];
const isNeverClick = t => {
  const s = String(t||'').trim();
  if(OK_TO_CLICK.some(w=>s.includes(w))) return false;
  return NEVER_CLICK.some(w=>s.includes(w));
};

const LOGIN_URL = 'https://www.boatrace.jp/owpc/pc/login_?authAfterTrans=stay';
const VOTE_URL  = 'https://www.boatrace.jp/owpc/VoteConfirm.xhtml?authAfterTrans=stay&voteTagId=commonHead';

const args=process.argv.slice(2);
const PROBE=args.includes('--probe');
const SAMPLE=args.includes('--sample');
/* --race <場コード> <R> [日付] で、買い目づくりから打ち込みまでを1コマンドにする。
   もとは「別のターミナルで predict.js を走らせて plan.json を作っておく」形だった。
   2026-10-27、リモートデスクトップ越しでそれができず、7Rに間に合わなかった。
   画面ひとつで終わるようにする。 */
const RACE_I = args.indexOf('--race');
const RACE = RACE_I >= 0 ? {
  jcd: String(args[RACE_I+1]||'').padStart(2,'0'),
  rno: Number(args[RACE_I+2]),
  hd : args[RACE_I+3] && /^\d{8}$/.test(args[RACE_I+3]) ? args[RACE_I+3]
       : new Date(Date.now()+9*3600*1000).toISOString().slice(0,10).replace(/-/g,''),
} : null;
const DRY=args.includes('--dry');
const planPath = RACE ? path.join(__dirname,'tmp','plan.json')
                      : args.find(a=>!a.startsWith('--'));

/* 買い目を作る。predict.js をそのまま呼ぶ（モデルは一箇所にしか置かない）。 */
function makePlan(){
  const {execFileSync}=require('child_process');
  console.log(`\n  買い目を作ります（${RACE.jcd} ${RACE.rno}R）。少しかかります…`);
  const out = execFileSync(process.execPath,
    [path.join(__dirname,'predict.js'), RACE.jcd, String(RACE.rno), RACE.hd, '--now'],
    {encoding:'utf8', maxBuffer:64*1024*1024});
  /* 買い目の中身は人にも見せる。どこを見ればいいか分かるように抜き出す。 */
  const i = out.indexOf('── 買い目 ──');
  const j = out.indexOf('※ 上の「市場」');
  if(i>=0) console.log(out.slice(i, j<0?out.length:j).replace(/\n+$/,''));
  const warn = out.match(/── 当たっても元が取れるか[\s\S]*?(?=\n\s*※ このオッズは締切前)/);
  if(warn) console.log('\n  '+warn[0].trim());
}

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
  if(plan.sample) console.log('\n  ★ これは見本です。本物の買い目ではありません。');
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
        /* 書き出してはいけない値。人がこのファイルを私に送るので、
           セッションの鍵が入っていては困る。2026-10-27 の実機で
           token / _csrf が実際に入ってしまった（その回は期限切れで害は無い）。
           パスワードだけでなく、名前で分かる鍵もふせる。 */
        const SECRET = /^(_?csrf|token|rctoken|authenticity_token|session|jsessionid|sid)$/i;
        const HIDE = e => e.type==='password'
                       || SECRET.test(e.name||'') || SECRET.test(e.id||'');
        const take=(sel,f)=>[...document.querySelectorAll(sel)].slice(0,500).map(f);
        return {
          url: location.href, title: document.title,
          inputs: take('input,select,textarea', e=>({
            tag:e.tagName.toLowerCase(), type:e.type||'', id:e.id||'', name:e.name||'',
            cls:(e.className||'').toString().slice(0,80), ph:e.placeholder||'',
            value: HIDE(e) ? '(ふせた)' : String(e.value||'').slice(0,20),
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
  const danger = out.flatMap(o=>(o.clickables||[])).filter(c=>isNeverClick(c.text));
  if(danger.length){
    console.log(`\n  ★ 押してはいけないもの（このスクリプトは押しません）`);
    for(const d of danger.slice(0,10)) console.log(`     「${d.text}」 id=${d.id||'-'} class=${d.cls.slice(0,40)}`);
  }
  console.log('\n  書き出したファイルを私に見せてください。画面に合わせて続きを作ります。');
  console.log('  ※ 写真に加入者番号などが写っていないか、送る前に確かめてください。');
  console.log('    json にも入力欄の中身が入ります（パスワードはふせてあります）。');
}

/* 買い目を投票画面に打ち込む
   ==================================================================
   実機（2026-10-27 唐津6R）で確かめた画面の作り。
     艇番      #regbtn_<艇番>_<着順>    例 regbtn_3_2 = 3号艇を2着に
     購入金額  #amount（type=tel）
     追加      「ベットリストに追加」
     完了      「投票入力完了」        ← 絶対に押さない

   ★ 購入金額は100円単位。画面に「購入金額 [  ] 00円」と出ている。
     ¥100 なら 1、¥500 なら 5 と入れる。
     ここを素の円で入れると100倍になる（¥1,800 のつもりが ¥180,000）。
     plan 側は円で持っているので、必ず /100 してから入れる。 */
const YEN_UNIT = 100;
const toUnit = yen => {
  if(!Number.isInteger(yen) || yen <= 0) throw new Error(`金額が整数の正の値でない: ${yen}`);
  if(yen % YEN_UNIT !== 0) throw new Error(`金額が${YEN_UNIT}円単位でない: ${yen}`);
  return yen / YEN_UNIT;
};

/* 場コード → 場名。index.html の VENUES から読む（二重に持たない）。 */
const venueName = jcd => {
  try{
    const html = fs.readFileSync(path.join(__dirname,'index.html'),'utf8');
    const re = new RegExp(`'${jcd}':\\{name:'([^']+)'`);
    const m = html.match(re);
    return m ? m[1] : null;
  }catch(e){ return null; }
};

/* いま画面に出ている場とレース番号を読む。
   画面にはこう出ている:  唐津 … 場変更・複数場選択 … 6R予選 1800m 電話投票締切予定時刻まで 9分
   読めなければ null を返す。推測しない。 */
async function readRaceOnScreen(page){
  const t = await page.evaluate(()=>document.body ? document.body.innerText : '');
  const rno = (t.match(/(\d{1,2})R[^\n]*?\d+m[^\n]*?電話投票締切/)||[])[1];
  const venue = (t.match(/([^\s\n]+)\s*\n\s*場変更・複数場選択/)||[])[1];
  return { venue: venue||null, rno: rno==null ? null : Number(rno) };
}

/* ベットリストの「合計ベット数」と「総購入金額」を読む。
   読めなければ null を返す。推測しない（数が分からないまま進めない）。 */
async function readTotals(page){
  const t = await page.evaluate(()=>document.body ? document.body.innerText : '');
  const n = (t.match(/合計ベット数\s*([\d,]+)\s*件/)||[])[1];
  const y = (t.match(/総購入金額\s*([\d,]+)\s*円/)||[])[1];
  const num = v => v==null ? null : Number(String(v).replace(/,/g,''));
  return { count: num(n), yen: num(y) };
}

/* 投票画面のページを探す。見つからなければ null。 */
async function findVotePage(ctx){
  for(const pg of ctx.pages()){
    try{
      if(await pg.$('#regbtn_1_1')) return pg;
    }catch(e){}
  }
  return null;
}

async function fill(ctx, plan, ask){
  const page = await findVotePage(ctx);
  if(!page) throw new Error('投票画面が見つかりません（艇番のボタンがある画面を開いてください）');
  console.log(`\n  投票画面を見つけました: ${page.url().slice(0,80)}`);

  /* ★ 画面のレースと買い目のレースが同じか確かめる。
     2026-10-27、丸亀6Rの買い目が tmp/plan.json に残ったまま
     7Rの画面を開いていた。ここを見ていなかったので、
     別のレースの買い目をそのまま打ち込むところだった。
     読めないときも進まない（「たぶん合っている」で金は賭けない）。 */
  const on = await readRaceOnScreen(page);
  const want = venueName(plan.jcd);
  console.log(`  画面のレース: ${on.venue||'(場が読めない)'} ${on.rno!=null?on.rno+'R':'(Rが読めない)'}`);
  console.log(`  買い目のレース: ${want||('場コード'+plan.jcd)} ${plan.rno}R`);
  if(on.rno == null || on.venue == null)
    throw new Error('画面のレースが読めません。投票画面かどうか確かめてください');
  if(on.rno !== plan.rno)
    throw new Error(`レース番号が違います（画面 ${on.rno}R / 買い目 ${plan.rno}R）。`
                  + '画面を合わせるか、買い目を出し直してください');
  if(want && on.venue !== want)
    throw new Error(`場が違います（画面 ${on.venue} / 買い目 ${want}）。`
                  + '画面を合わせるか、買い目を出し直してください');
  console.log('    ✓ 同じレースです。');

  /* 先にリストが空かを確かめる。空でなければ触らない。
     手で入れた買い目が残っているのに足すと、合計が変わってしまう。
     「全削除」は押さない。人の入力を消す判断は機械がしない。 */
  const before = await readTotals(page);
  if(before.count == null)
    throw new Error('ベットリストの件数が読めません。画面が違う可能性があるので止めます');
  if(before.count !== 0)
    throw new Error(`ベットリストに既に ${before.count}件 入っています。`
                  + '消すかどうかは人が決めてください（このスクリプトは消しません）');

  /* 式別と投票方法。すでに選ばれていても押して問題ない。 */
  for(const label of ['3連単','通常投票']){
    const el = page.locator(`a:text-is("${label}")`).first();
    if(await el.count()) { await el.click().catch(()=>{}); await page.waitForTimeout(300); }
  }

  const rows = plan.rows;
  console.log(`  ${rows.length}点を入れます（合計 ¥${plan.total.toLocaleString()}）。`);
  for(let i=0;i<rows.length;i++){
    const r = rows[i];
    const [a,b,c] = r.combo.split('-');
    const unit = toUnit(r.yen);

    for(const [lane, place] of [[a,1],[b,2],[c,3]]){
      const sel = `#regbtn_${lane}_${place}`;
      const el = page.locator(sel);
      if(!await el.count()) throw new Error(`${sel} が見つかりません（${r.combo} の${place}着）`);
      await el.click();
    }
    await page.fill('#amount', String(unit));
    /* 入れた値を読み返す。打ち込みが効いていないまま追加すると
       金額ちがいのベットが積まれる。 */
    const got = await page.inputValue('#amount');
    if(String(got) !== String(unit))
      throw new Error(`金額の入力が効いていません（入れた ${unit} / 画面 ${got}）`);

    await page.locator('a:text-is("ベットリストに追加")').first().click();

    /* 1件増えるまで待つ。増えなければ止める。 */
    let okAdd=false;
    for(let w=0; w<20; w++){
      await page.waitForTimeout(250);
      const now = await readTotals(page);
      if(now.count === i+1){ okAdd=true; break; }
    }
    if(!okAdd){
      const now = await readTotals(page);
      throw new Error(`${r.combo} を足したあと件数が ${now.count} でした（${i+1} のはず）。`
                    + 'ここで止めます。画面を見て確かめてください');
    }
    process.stdout.write(`\r  ${i+1}/${rows.length}点  ${r.combo} ¥${r.yen}      `);
  }
  console.log('');

  /* 最後に合計を突き合わせる。ここが合っていなければ人に伝えて止める。 */
  const after = await readTotals(page);
  const wantCount = rows.length, wantYen = plan.total;
  console.log(`\n  ── 画面の合計と、出した買い目を突き合わせる ──`);
  console.log(`    合計ベット数  画面 ${after.count} 件 / 買い目 ${wantCount} 点`);
  console.log(`    総購入金額    画面 ¥${(after.yen??0).toLocaleString()} / 買い目 ¥${wantYen.toLocaleString()}`);
  const same = after.count === wantCount && after.yen === wantYen;
  if(!same){
    console.log('\n  ✗ 合っていません。投票入力完了は押さないでください。');
    console.log('    画面の「全削除」で消してから、やり直すか手で入れてください。');
    throw new Error('画面の合計と買い目が合いません');
  }
  console.log('    ✓ 合っています。');

  try{ await page.screenshot({path:path.join(__dirname,'tmp','vote-filled.png'), fullPage:true}); }catch(e){}

  console.log('\n  ────────────────────────────────────────');
  console.log('  ここまでです。このスクリプトは買いません。');
  console.log('  画面のベットリストをご自身の目で確かめてください。');
  console.log('  よければ「投票入力完了」を押すところから、ご自身でお願いします。');
  console.log('  やめるなら、画面の「全削除」を押せば何も買わずに終わります。');
  /* 購入の最後に「投票用パスワード」を聞かれる。ログインに使う3つとは別もの。
     2026-10-27、ここで分からなくなって買えなかった。先に出しておく。 */
  console.log('');
  console.log('  ★ このあと「投票用パスワード」を聞かれます。');
  console.log('    ログインの3つ（加入者番号・暗証番号・認証用パスワード）とは別物です。');
  console.log('    分からなければ画面上部の 会員情報変更 → 投票用パスワードを変更する。');
  console.log('  ────────────────────────────────────────');
  if(ask) await ask('\n  確かめ終わったら Enter（ブラウザは開いたままにします） > ');
}

/* ---- 本体 ----------------------------------------------------------- */
/* require されたときは走らせない（テストから probe だけ呼べるように） */
module.exports = { probe, fill, loadPlan, openBrowser, toUnit, readTotals, findVotePage,
                   readRaceOnScreen, venueName,
                   NEVER_CLICK, OK_TO_CLICK, isNeverClick,
                   MAX_YEN_PER_RACE, MAX_YEN_PER_POINT, MAX_POINTS };
if(require.main !== module) return;

(async()=>{
  try{
    /* 見本の plan.json を書く。--dry の練習用。
       本物の買い目は predict.js が書く。見本と取り違えないよう、
       race に「見本」と入れ、--dry 以外では使えないようにしてある。 */
    if(SAMPLE){
      const dir=path.join(__dirname,'tmp'); fs.mkdirSync(dir,{recursive:true});
      const f=path.join(dir,'plan-sample.json');
      fs.writeFileSync(f, JSON.stringify({
        jcd:'23', rno:1, date:'1970-01-01',
        race:'見本（これは練習用です。本物の買い目ではありません）',
        sample:true, provisional:false,
        best:'1-2-3', bestYen:100, unitYen:100,
        main:['1-2-3','1-2-4','1-3-2','1-3-4','2-1-3','2-1-4','2-3-1','3-1-2','3-2-1','1-2-5'],
        ana :['4-1-2','4-2-1','5-1-2','5-2-1','6-1-2','6-2-1','4-1-3','5-1-3'],
      },null,1));
      console.log(`\n  見本を書きました: ${f}`);
      console.log('  試すとき:  node vote-assist.js tmp/plan-sample.json --dry');
      console.log('  ※ 見本はブラウザを開く側では使えません（--dry だけ）。');
      return;
    }

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

    /* 買い目がまだ無くてもブラウザは開けるようにする。
       ログインと画面遷移に数分かかるので、展示待ちのあいだに
       そこまで済ませておけるほうがいい（2026-10-27 丸亀6Rで間に合わなかった）。
       買い目は打ち込む直前に読み直す。 */
    const have = !RACE && planPath && fs.existsSync(planPath);
    let plan = have ? loadPlan(planPath) : null;
    if(plan) show(plan);

    if(DRY){
      /* --race と一緒なら、ここで作って見せる（ブラウザは開かない）。
         買い目だけ先に見たいときに使う。 */
      if(!plan && RACE){ makePlan(); plan = loadPlan(planPath); show(plan); }
      if(!plan) throw new Error(`${planPath} がありません`);
      console.log('\n  --dry なので、ブラウザは開きません。中身と上限の確認だけです。');
      return;
    }
    if(plan && plan.sample)
      throw new Error('これは見本の買い目です。ブラウザを開く側では使えません（--dry だけ）');
    if(!plan){
      if(RACE){
        console.log(`\n  ${RACE.jcd} ${RACE.rno}R（${RACE.hd}）`);
        console.log('  先にブラウザを開きます。ログインと画面の用意を済ませてください。');
        console.log('  買い目は、展示が出てから（あなたが Enter を押したときに）作ります。');
      }else{
        console.log(`\n  ${planPath} はまだありません。`);
        console.log('  先にブラウザを開いて、ログインと画面の用意だけ済ませておきます。');
        console.log('  買い目は、打ち込む直前にもう一度読みます。');
      }
    }

    const {browser,ctx,page}=await openBrowser();
    await waitForLogin(page);
    console.log('\n  つぎに、買い目を入れる画面まで、ご自身で進んでください。');
    console.log(plan
      ? `    「投票サイトへ」→ 場とレースを選ぶ（${plan.jcd} ${plan.rno}R）→ 3連単の入力画面`
      : '    「投票サイトへ」→ 場とレースを選ぶ → 3連単の入力画面');
    console.log('  ★ 金額も艇番も、入れずにそのままにしておいてください。');
    console.log('    ベットリストが空でないと、このスクリプトは止まります。');
    await ask('\n  入力画面が出たら、ここで Enter > ');

    if(RACE) makePlan();

    /* ここで読み直す。待っているあいだに確定版が書かれていることがある
       （暫定→確定で上書きされる）。古いほうを打ち込まないため。 */
    const fresh = loadPlan(planPath);
    if(fresh.sample)
      throw new Error('これは見本の買い目です。ブラウザを開く側では使えません');
    if(plan && JSON.stringify(plan.rows) !== JSON.stringify(fresh.rows)){
      console.log('\n  ※ 待っているあいだに買い目が変わりました（展示が出たのだと思います）。');
      console.log('    新しいほうを打ち込みます。');
    }
    plan = fresh;
    show(plan);
    if(plan.provisional){
      console.log('\n  ★ これは展示の前に出した暫定です。');
      console.log('    実測では確定版よりはっきり悪くなります（本線10点 85% → 77%）。');
      const a = await ask('    それでも打ち込みますか（y で続ける / それ以外でやめる）> ');
      if(String(a).toLowerCase() !== 'y'){
        console.log('  やめました。何も入れていません。');
        await browser.close(); return;
      }
    }
    await fill(ctx, plan, ask);
    /* ブラウザは閉じない。人が「投票入力完了」を押すかどうかを決めるため。 */
  }catch(e){
    console.error('\n  ✗ '+e.message);
    process.exitCode=1;
  }
})();
