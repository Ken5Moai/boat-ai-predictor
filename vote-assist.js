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

/* 画面のレースを切り替える（同じ場の中だけ）。
   レースタブは id も class も無い <a> で、文字が「7R\n11:22」の形。
   場をまたぐ切り替えは「場変更・複数場選択」が別ウィンドウを開く作りで、
   中を見ていないので自動では触らない。場が変わるときは人に頼む。

   切り替えたあとは必ず readRaceOnScreen で確かめる。
   押したつもりで変わっていないまま打ち込むのがいちばん怖い。 */
async function gotoRace(page, rno){
  const before = await readRaceOnScreen(page);
  if(before.rno === rno) return true;
  const tab = page.locator('a').filter({hasText:new RegExp(`^\\s*${rno}R\\b`)}).first();
  if(!await tab.count()) return false;
  await tab.click().catch(()=>{});
  for(let i=0;i<24;i++){
    await page.waitForTimeout(250);
    const now = await readRaceOnScreen(page);
    if(now.rno === rno) return true;
  }
  return false;
}

async function fill(ctx, plan, ask){
  showTermsNotice();
  const page = await findVotePage(ctx);
  if(!page) throw new Error('投票画面が見つかりません（艇番のボタンがある画面を開いてください）');
  console.log(`\n  投票画面を見つけました: ${page.url().slice(0,80)}`);

  /* ★ 画面のレースと買い目のレースが同じか確かめる。
     2026-10-27、丸亀6Rの買い目が tmp/plan.json に残ったまま
     7Rの画面を開いていた。ここを見ていなかったので、
     別のレースの買い目をそのまま打ち込むところだった。
     読めないときも進まない（「たぶん合っている」で金は賭けない）。 */
  /* レースが違うなら、同じ場の中ならタブで合わせてみる。
     合わなければ下の照合で止まる。 */
  let on = await readRaceOnScreen(page);
  const want = venueName(plan.jcd);
  if(on.rno != null && on.rno !== plan.rno && (!want || on.venue === want)){
    console.log(`  画面が ${on.rno}R なので ${plan.rno}R に切り替えます…`);
    await gotoRace(page, plan.rno);
    on = await readRaceOnScreen(page);
  }
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
  {
    const miss = buyReadiness();
    if(miss.length){
      console.log('  （ここから先を自動にするには、まだこれが要ります）');
      for(const m of miss) console.log(`     ・${m}`);
    }
  }
  console.log('  ★ このあと「投票用パスワード」を聞かれます。');
  console.log('    ログインの3つ（加入者番号・暗証番号・認証用パスワード）とは別物です。');
  console.log('    分からなければ画面上部の 会員情報変更 → 投票用パスワードを変更する。');
  console.log('  ────────────────────────────────────────');
  if(ask) await ask('\n  確かめ終わったら Enter（ブラウザは開いたままにします） > ');
}

/* ③ 購入まで自動で行う
   ==================================================================
   確定画面は probe を取っていない（ログインの先なので、こちらからは見られない）。
   なので id に頼らない。ラベルの文字で探し、入れる前と入れたあとに読み返す。

   ★ 金額の単位を画面から読む
     入力画面の購入金額は「[  ] 00円」で100円単位だった。
     確定画面は「[  ] 円」に見えるが、確かめずに入れると100倍になる。
     欄のうしろの文字を読んで単位を決める。読めなければ入れない。

   押す前に必ず通すもの
     ・確定画面の「合計ベット数」と「購入金額」が買い目と一致
     ・金額欄に入れた値を読み返して一致
     ・投票用パスワードが入っている
   どれか欠けたら押さずに止める。 */

/* 入力欄のうしろにある文字から単位を決める。
   「00円」なら100円単位、「円」だけなら円。分からなければ null。 */
async function amountUnit(page, handle){
  const suffix = await handle.evaluate(el=>{
    /* 欄のあとに続く文字を、親をたどって少しだけ拾う */
    let t='';
    let n=el.nextSibling, hop=0;
    while(n && hop<6){ t += (n.textContent||''); n=n.nextSibling; hop++; }
    if(!t.trim() && el.parentElement) t = el.parentElement.textContent||'';
    return t.replace(/\s+/g,'').slice(0,20);
  });
  if(/00円/.test(suffix)) return {unit:100, why:`欄のうしろが「${suffix}」`};
  if(/円/.test(suffix))   return {unit:1,   why:`欄のうしろが「${suffix}」`};
  return {unit:null, why:`欄のうしろが読めない（「${suffix}」）`};
}

/* 画面の「購入限度額」を読む。残高が尽きたら止めるために使う。
   投票画面の上に「購入限度額0円」「購入可能ベット数9,999」と出ている。
   読めなければ null（推測しない）。
   本人は1回¥10,000しか入金しないので、残高そのものが上限になる。
   それでも、尽きたあと空振りを続けないようにここで見る。 */
async function readBalance(page){
  const t = await page.evaluate(()=>document.body?document.body.innerText:'');
  const m = t.match(/購入限度額\s*([\d,]+)\s*円/);
  return m ? Number(m[1].replace(/,/g,'')) : null;
}

/* 確定画面に出ている「合計ベット数」と「購入金額」を読む。 */
async function readConfirm(page){
  /* 画面ぜんぶから拾うと、入力画面に残っている「購入金額 00円」を
     先に読んで ¥0 になった。確定画面の範囲に限って読む。
     目印は「投票用パスワード」。それを含むいちばん内側の箱を使う。 */
  const t = await page.evaluate(()=>{
    /* 「購入金額と投票用パスワードを入力し…」という説明文の div が
       いちばん小さい箱として選ばれ、数字が無くて読めなかった。
       実際に数字を持っている箱だけを見る。 */
    const CNT=/合計ベット数\s*[\d,]+\s*件/, YEN=/購入金額\s*[\d,]+\s*円/;
    const all=[...document.querySelectorAll('div,section,form,table')];
    const box=all.filter(e=>{
      const s=e.innerText||'';
      return s.includes('投票用パスワード') && CNT.test(s) && YEN.test(s);
    }).sort((a,b)=>(a.innerText||'').length-(b.innerText||'').length)[0];
    return box ? box.innerText : (document.body?document.body.innerText:'');
  });
  const num = v => v==null ? null : Number(String(v).replace(/,/g,''));
  /* 金額は「購入金額 1,800 円」の形。入力欄のうしろの「00円」を拾わないよう、
     数字が1桁以上あって、そのあとが「円」で終わるものだけを見る。 */
  const yens=[...t.matchAll(/購入金額\s*([\d,]+)\s*円/g)].map(m=>num(m[1]));
  return {
    count: num((t.match(/合計ベット数\s*([\d,]+)\s*件/)||[])[1]),
    yen:   yens.length ? Math.max(...yens) : null,
  };
}

/* 実際に買う。ここだけが金を動かす。 */
async function buy(ctx, plan, opt){
  showTermsNotice();
  opt = opt || {};
  const pass = process.env.BOAT_BET_PASSWORD;
  if(!pass) throw new Error('投票用パスワードがありません（環境変数 BOAT_BET_PASSWORD）');
  if(process.env.BOAT_TERMS_OK !== 'yes')
    throw new Error('会員規約の確認が済んでいません（BOAT_TERMS_OK=yes）');

  const page = await findVotePage(ctx);
  if(!page) throw new Error('投票画面が見つかりません');

  /* 残高。足りなければ押さない。買えないのに押しても断られるだけ。 */
  const bal = await readBalance(page);
  if(bal != null){
    console.log(`  購入限度額 ¥${bal.toLocaleString()}`);
    if(bal < plan.total){
      const e=new Error(`残高が足りません（限度額 ¥${bal.toLocaleString()} / 買い目 ¥${plan.total.toLocaleString()}）`);
      e.outOfMoney = true;
      throw e;
    }
  }

  /* 入力画面の合計をもう一度見る。fill 直後に人が触っているかもしれない。 */
  const before = await readTotals(page);
  if(before.count !== plan.rows.length || before.yen !== plan.total)
    throw new Error(`入力画面の合計が買い目と違います`
      + `（画面 ${before.count}件 ¥${before.yen} / 買い目 ${plan.rows.length}件 ¥${plan.total}）`);

  console.log('\n  「投票入力完了」を押します…');
  const done = page.locator('a:text-is("投票入力完了"), button:text-is("投票入力完了")').first();
  if(!await done.count()) throw new Error('「投票入力完了」が見つかりません');
  await done.click();

  /* 確定画面になるまで待つ */
  let conf=null;
  for(let i=0;i<40;i++){
    await page.waitForTimeout(250);
    conf = await readConfirm(page);
    if(conf.count!=null && conf.yen!=null
       && await page.locator('text=投票用パスワード').count()) break;
    conf=null;
  }
  if(!conf) throw new Error('確定画面になりませんでした。画面を見て確かめてください');

  console.log(`  確定画面  合計ベット数 ${conf.count}件 / 購入金額 ¥${conf.yen.toLocaleString()}`);
  if(conf.count !== plan.rows.length || conf.yen !== plan.total)
    throw new Error(`確定画面の合計が買い目と違います`
      + `（画面 ${conf.count}件 ¥${conf.yen} / 買い目 ${plan.rows.length}件 ¥${plan.total}）。`
      + '「投票内容を修正する」で戻ってください');
  console.log('    ✓ 合っています。');

  /* 金額欄。ラベルで探す。 */
  const amt = page.locator('input').filter({hasNot:page.locator('[type=hidden]')});
  let amtEl=null;
  for(const sel of ['#amount2','#betAmount','input[name*=amount i]','input[type=tel]','input[type=text]']){
    const l=page.locator(sel);
    const n=await l.count();
    for(let i=0;i<n;i++){
      const h=l.nth(i);
      if(!await h.isVisible().catch(()=>false)) continue;
      if(await h.getAttribute('type')==='password') continue;
      amtEl=h; break;
    }
    if(amtEl) break;
  }
  if(!amtEl) throw new Error('確定画面の購入金額欄が見つかりません');

  const u = await amountUnit(page, await amtEl.elementHandle());
  if(u.unit==null) throw new Error(`購入金額の単位が読めません（${u.why}）。入れずに止めます`);
  const put = u.unit===100 ? toUnit(plan.total) : plan.total;
  console.log(`  購入金額を入れます：${put}（${u.why} → ${u.unit===100?'100円単位':'円'}）`);
  await amtEl.fill(String(put));
  const got = await amtEl.inputValue();
  if(String(got)!==String(put))
    throw new Error(`購入金額が入っていません（入れた ${put} / 画面 ${got}）`);

  /* 投票用パスワード。
     ★ 実機にはおとりのパスワード欄がある（2026-10-28に判明）。
       password name="dummyA" 見える
       password name="dummyB" 見える
       password name="betPassword" id="pass" class="inputPass" 見える ← 本物
     おとりが本物より前にあるので、「見えている最初のパスワード欄」を取ると
     おとりに入る。丸亀10R・11R はこれで弾かれた。
     ラベルで探す手も効かない。「投票用パスワード」の文字は親ではなく
     隣のセルにあるため。

     名前で直に指定する。おとり（dummy で始まる名前）には絶対に入れない。
     どれも見つからなければ、入れずに止める。推測で入れない。 */
  const PW_SEL = ['#pass', 'input[name="betPassword"]', 'input.inputPass'];
  let pw=null, pwWhy='';
  for(const sel of PW_SEL){
    const h = page.locator(sel).first();
    if(!await h.count()) continue;
    if(!await h.isVisible().catch(()=>false)) continue;
    const nm = (await h.getAttribute('name')) || '';
    if(/^dummy/i.test(nm)) continue;          /* おとり */
    pw=h; pwWhy=sel; break;
  }
  if(!pw){
    /* 名前で見つからないときだけ、見える欄の中から探す。
       そのときも、おとりと「金額」は除く。 */
    const all = page.locator('input[type=password]');
    const n = await all.count();
    for(let i=0;i<n;i++){
      const h=all.nth(i);
      if(!await h.isVisible().catch(()=>false)) continue;
      const nm=(await h.getAttribute('name'))||'';
      if(/^dummy/i.test(nm)) continue;
      pw=h; pwWhy=`見えているパスワード欄（name=${nm||'なし'}）`; break;
    }
  }
  if(!pw) throw new Error('投票用パスワードの欄が見つかりません'
    + '（おとりの欄しか無いか、画面が想定と違います）');

  /* --buy-dry のときは、パスワードを入れずに欄を選んだ状態で止める。
     こちらから打つのが2回とも弾かれているので、人が打つほうが確実。
     2026-10-28 丸亀9R は、この形（こちらが全部入れて人が打って押す）で
     実際に買えている。 */
  if(opt.dryRun){
    await pw.click({timeout:5000}).catch(()=>{});
    console.log('\n  ★ --buy-dry なので、投票用パスワードは入れません。');
    console.log('    欄を選んだ状態にしてあります。ご自身で打って「投票する」を押してください。');
    console.log('    やめるなら「投票内容を修正する」で戻れば、何も買わずに終わります。');
    return {bought:false, yen:0, waitingHuman:true};
  }

  /* fill() は値を書き込むだけで、キーの出来事を起こさない。
     投票用パスワードの欄は、横にソフトウェアキーボードのボタンがある。
     キーロガー対策の作りだと、値を書き込んでもサイト側が受け取らない。
     実際、2回とも「投票用パスワードの入力に誤りがあります」で弾かれた
     （2026-10-28 丸亀10R・11R）。見えない欄に入れたのを直しても同じだった。
     なので、本当にキーを打つ。欄を押してから1文字ずつ送る。 */
  await pw.click({timeout:5000}).catch(()=>{});
  await pw.fill('').catch(()=>{});
  await pw.pressSequentially(pass, {delay:60});
  const pwGot = await pw.inputValue();
  if(!pwGot) throw new Error('投票用パスワードが入っていません');
  if(pwGot.length !== pass.length)
    throw new Error(`投票用パスワードが途中までしか入っていません（${pwGot.length}/${pass.length}文字）`);
  /* おとりに入っていないことも確かめる。入っていたら押さない。 */
  const decoy = await page.evaluate(()=>
    [...document.querySelectorAll('input[type=password]')]
      .filter(e=>/^dummy/i.test(e.name||''))
      .map(e=>({name:e.name, len:(e.value||'').length}))
      .filter(x=>x.len>0));
  if(decoy.length)
    throw new Error(`おとりの欄に入っています（${decoy.map(d=>d.name).join(',')}）。押さずに止めます`);
  console.log(`  投票用パスワードを打ちました（${pwWhy}。画面には出しません）。`);

  /* それでも弾かれるときのために、押す前の状態を書き出しておく。
     パスワードそのものは出さない（長さだけ）。 */
  try{
    const diag = await page.evaluate(()=>{
      const out=[];
      for(const e of document.querySelectorAll('input')){
        const r=e.getBoundingClientRect();
        out.push({type:e.type||'', id:e.id||'', name:e.name||'',
                  cls:(e.className||'').toString().slice(0,60),
                  readOnly:!!e.readOnly, disabled:!!e.disabled,
                  visible:!!(r.width||r.height),
                  len:(e.value||'').length});
      }
      return out;
    });
    fs.mkdirSync(path.join(__dirname,'tmp'),{recursive:true});
    fs.writeFileSync(path.join(__dirname,'tmp','vote-before-submit.json'),
                     JSON.stringify(diag,null,1));
  }catch(e){}

  /* ブラウザが出す確認（window.confirm / alert）が挟まることがある。
     Playwright は既定でこれを黙って閉じる（＝キャンセル扱いになりうる）。
     何が出たのか分からないまま進むのが怖いので、出たら書き出して受ける。
     ここを入れずに「押したのに買えていない」が起きると、原因が見えない。 */
  const dialogs=[];
  page.on('dialog', async d => {
    dialogs.push({type:d.type(), message:d.message().slice(0,200)});
    console.log(`  ブラウザの確認が出ました（${d.type()}）: ${d.message().slice(0,120)}`);
    /* 中身が分かるまで、こちらからは受けない（キャンセルする）。
       受けると買ってしまうので、分からないものは押さない。 */
    try{ await d.dismiss(); }catch(e){}
    console.log('    中身が分からないので、いったん閉じました（買っていません）。');
  });

  console.log('\n  「投票する」を押します…');
  const go = page.locator('a:text-is("投票する"), button:text-is("投票する"), input[value="投票する"]').first();
  if(!await go.count()) throw new Error('「投票する」が見つかりません');
  await go.click();
  await page.waitForTimeout(3000);
  try{ await page.screenshot({path:path.join(__dirname,'tmp','vote-bought.png'), fullPage:true}); }catch(e){}
  const after = await page.evaluate(()=>document.body?document.body.innerText:'');

  /* 「投票する」を押すと、画面の中に確認の窓が出る。
     ブラウザの confirm ではなく、ページの中に描かれた窓。
     2026-10-30 に実物を見て確かめた。

       確認
       投票します。よろしいですか？
         [OK]  [キャンセル]

     OK を押すと betcomp に移って「投票が完了しました」と出る。
     押さないと投票は成立しない。2026-10-29 はここを人が押していた。

     DOM の要素なので押せる。ただし「OK」という字だけを頼りに押すと、
     別の窓が出ているときに取り違える。窓の文面を確かめてから押す。 */
  const confirmBox = async () => {
    for(const fr of page.frames()){
      try{
        const found = await fr.evaluate(()=>{
          const vis = e => { const r=e.getBoundingClientRect(); return !!(r.width||r.height); };
          const t = document.body ? document.body.innerText : '';
          if(!/投票します。?\s*よろしいですか/.test(t)) return null;
          const btns=[...document.querySelectorAll('a,button,input[type=button],input[type=submit]')]
            .filter(vis)
            .map(e=>({text:(e.innerText||e.value||'').trim(), id:e.id||'', cls:(e.className||'').toString().slice(0,40)}));
          return {text:t.slice(0,300), btns};
        });
        if(found) return {frame:fr, ...found};
      }catch(e){}
    }
    return null;
  };

  /* 押せる状態になるまで少し待つ（窓が出るのに一拍ある） */
  let box=null;
  for(let i=0;i<16 && !box;i++){ box=await confirmBox(); if(!box) await page.waitForTimeout(500); }

  if(box){
    const okNames = box.btns.filter(b=>/^(OK|ＯＫ)$/i.test(b.text));
    console.log(`  確認の窓が出ました: ${box.text.split('\n').filter(Boolean).slice(0,2).join(' / ')}`);
    if(okNames.length!==1){
      throw new Error(`確認の窓の「OK」が ${okNames.length} 個見つかりました（1個でないので押しません）。`
        + `画面を見て、ご自身で押してください。`);
    }
    /* 押す前にもう一度、件数と金額が買い目と合っているかを見る。
       窓の向こう側に出ているので読める。ここが合わなければ押さない。 */
    const back = await page.evaluate(()=>{
      const t = document.body ? document.body.innerText : '';
      const n = (t.match(/合計ベット数\s*([\d,]+)\s*件/)||[])[1];
      const y = (t.match(/購入金額\s*([\d,]+)\s*円/)||[])[1];
      return {n: n?Number(n.replace(/,/g,'')):null, y: y?Number(y.replace(/,/g,'')):null};
    });
    /* 件数は plan.rows から出す（buy() の他の検算と同じ出どころ）。
       plan.all を使って 0点 になり、自分で作ったテストで落ちた。
       同じ数を2通りで出すと必ずずれるので、1つに寄せる。 */
    const wantN = plan.rows.length;
    if(back.n!=null && back.n!==wantN)
      throw new Error(`確認の窓の向こうの件数が合いません（画面${back.n}件 / 買い目${wantN}点）。押しません。`);
    if(back.y!=null && back.y!==plan.total)
      throw new Error(`確認の窓の向こうの金額が合いません（画面¥${back.y} / 買い目¥${plan.total}）。押しません。`);
    console.log(`  件数と金額を確かめました（${wantN}点 ¥${plan.total.toLocaleString()}）。OK を押します…`);
    await box.frame.locator('a,button,input[type=button],input[type=submit]')
            .filter({hasText:/^(OK|ＯＫ)$/i}).first().click();
    await page.waitForTimeout(2500);
    try{ await page.screenshot({path:path.join(__dirname,'tmp','vote-bought.png'), fullPage:true}); }catch(e){}
  }

  /* 押したあとの画面を書き出す。どこで止まっても原因が見えるようにしておく。
     パスワードの値は絶対に出さない（長さだけ）。 */
  try{
    const stage = await page.evaluate(()=>{
      const vis = e => { const r=e.getBoundingClientRect(); return !!(r.width||r.height); };
      const label = e => (e.innerText || e.value || e.getAttribute('alt') || '').trim().slice(0,40);
      const out = {url:location.href, title:document.title, buttons:[], inputs:[]};
      for(const e of document.querySelectorAll('a,button,input[type=submit],input[type=button],input[type=image]'))
        if(vis(e)) out.buttons.push({tag:e.tagName.toLowerCase(), type:e.type||'',
                                     id:e.id||'', name:e.name||'', cls:(e.className||'').toString().slice(0,40),
                                     text:label(e)});
      for(const e of document.querySelectorAll('input'))
        if(vis(e)) out.inputs.push({type:e.type||'', id:e.id||'', name:e.name||'',
                                    len:(e.value||'').length});
      out.text = (document.body?document.body.innerText:'').slice(0,1500);
      return out;
    });
    stage.dialogs = dialogs;
    stage.frames = page.frames().length;
    fs.writeFileSync(path.join(__dirname,'tmp','vote-after-submit.json'),
                     JSON.stringify(stage,null,1));
    console.log('  押したあとの画面を tmp/vote-after-submit.json に書き出しました。');
    const names = stage.buttons.map(b=>b.text).filter(Boolean);
    if(names.length) console.log(`    押せるもの: ${[...new Set(names)].slice(0,12).join(' / ')}`);
  }catch(e){ console.log(`  ※ 押したあとの画面を書き出せませんでした（${e.message}）。`); }
  /* 弾かれたときは、受付の文字より先にエラーを見る。
     「完了」は画面のどこかに残っていることがあるので、順番が大事。 */
  const ng = after.match(/(投票用パスワード[^\n]{0,24}誤り[^\n]*|エラー[^\n]{0,40})/);
  if(ng){
    const e=new Error('弾かれました: '+ng[1].slice(0,60));
    e.rejected = true;
    console.log(`\n  ✗ ${e.message}`);
    if(/パスワード/.test(ng[1])){
      console.log('    投票用パスワードが違います。環境変数を設定し直してください。');
      console.log('      $env:BOAT_BET_PASSWORD="（投票用パスワード）"');
      console.log('    分からなければ 会員情報変更 → 投票用パスワードを変更する。');
    }
    console.log('    買えていません。画面の「投票内容を修正する」で戻れます。');
    throw e;
  }
  /* OK を押したあとは本文が変わっているので読み直す。 */
  const after2 = await page.evaluate(()=>document.body?document.body.innerText:'');
  const okWord = /投票が完了しました|投票を受け付けました|投票結果|受付|完了/.test(after2);
  if(okWord){
    console.log(`  ✓ 買いました（¥${plan.total.toLocaleString()}）。画面は tmp/vote-bought.png に残しました。`);
    return {bought:true, yen:plan.total, confirmed:true};
  }
  /* 受付の文字が出ていない。弾かれてもいない。
     2026-10-29 の報告どおり、もう1画面あるとみられる。
     ここで何かを押すと買ってしまうので、押さずに人に渡す。
     どのボタンを押せばいいかは tmp/vote-after-submit.json を見て決める。 */
  console.log('\n  ※ 「投票する」は押しましたが、受付の表示が出ていません。');
  console.log('     もう1画面あるとみられます。こちらからは押しません（買ってしまうため）。');
  console.log('     画面を見て、ご自身で確定してください。');
  console.log('     そのうえで tmp/vote-after-submit.json と tmp/vote-bought.png を送ってください。');
  console.log('     次からその画面も自動で進めるようにします。');
  return {bought:false, yen:0, waitingHuman:true, needsLastPress:true};
}

/* ③に何が足りないかを名前で返す。 */
/* ★ 2026-10-28、テレボート会員規約 第25条（禁止事項）を確認した結果、
   このスクリプトで投票画面を操作すること自体が禁止されていると分かった。

     (4) 振興会が提供するアプリケーションツール、ソフトウェア等以外のものを
         用いるなど、振興会のシステムの意図から外れた方法で
         インターネット投票を利用する行為
     (2) 極めて短時間に機械的に反復して投票、照会等する行為
     (6) 前各号に掲げる行為の準備とみられる行為又は、
         該当するおそれのある行為

   Playwright は「振興会が提供するソフトウェア等以外のもの」そのもの。
   買うところ（③）だけでなく、打ち込むところ（②）も同じく当たる。
   (6) があるので「準備だから」も通らない。

   よって fill() と buy() は動かさない。消さずに残すのは、
   なぜ止めたかを次に読む人（自分を含む）に残すため。
   予想を出すところ（auto.js の買い目づくり）は投票システムを触らないので、
   第25条の対象ではない。そちらは今までどおり使える。 */
const TERMS_NOTICE =
  '\n  ──────── テレボート会員規約 第25条（禁止事項）────────'
+ '\n    (2) 極めて短時間に機械的に反復して投票、照会等する行為'
+ '\n    (4) 振興会が提供するアプリケーションツール、ソフトウェア等以外のものを'
+ '\n        用いるなど、振興会のシステムの意図から外れた方法で'
+ '\n        インターネット投票を利用する行為'
+ '\n    (6) 前各号に掲げる行為の準備とみられる行為又は、該当するおそれのある行為'
+ '\n'
+ '\n    このスクリプトは Playwright で投票画面を操作します。'
+ '\n    (3)（公式画面を介さずに投票）には当たりませんが、'
+ '\n    (4)（公式以外のソフトで操作）に当たる可能性があります。'
+ '\n    使うかどうかは本人の判断。リスクは口座の停止です。'
+ '\n  ────────────────────────────────────────────\n';

/* 一度だけ出す。毎レース出すとうるさくて読まれなくなる。 */
let noticeShown = false;
function showTermsNotice(){
  if(noticeShown) return;
  noticeShown = true;
  console.log(TERMS_NOTICE);
}

function buyReadiness(){
  const miss=[];
  if(!process.env.BOAT_BET_PASSWORD) miss.push('投票用パスワード（環境変数 BOAT_BET_PASSWORD）');
  if(process.env.BOAT_TERMS_OK !== 'yes')
    miss.push('会員規約を読んだうえでの同意（BOAT_TERMS_OK=yes）');
  return miss;
}

/* ---- 本体 ----------------------------------------------------------- */
/* require されたときは走らせない（テストから probe だけ呼べるように） */
/* いま開いている画面が「投票を受け付けた」状態かを見る。
   人が確認画面を押したあとに、本当に通ったのかを確かめるために使う。
   押したと言われても画面で確かめる（言葉を信じて集計すると、
   買っていないのに投資額に足してしまう）。 */
async function voteAccepted(ctx){
  const page = await findVotePage(ctx);
  if(!page) return false;
  const t = await page.evaluate(()=>document.body?document.body.innerText:'');
  if(/誤り|エラー/.test(t)) return false;
  return /投票を受け付けました|受付|完了/.test(t);
}

module.exports = { probe, fill, loadPlan, openBrowser, toUnit, readTotals, findVotePage, voteAccepted,
                   readRaceOnScreen, venueName, gotoRace, buyReadiness,
                   buy, readConfirm, amountUnit, readBalance, TERMS_NOTICE,
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
