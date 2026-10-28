/* vote-assist.js の fill() — 投票画面への打ち込み
   ==================================================================
   ここは金額を扱うので、いちばん丁寧に見る。
   本物の投票サイトには触らない。実機（2026-10-27 唐津6R）の作りを写した
   tests/fixtures/mock-vote.html を使う。

   いちばん大事なのは2つ。
     ・購入金額が100円単位であること（素の円を入れると100倍になる）
     ・「投票入力完了」を押さないこと
   どちらもここで確かめる。 */
const path=require('path'), fs=require('fs');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };

let pw;
try{ pw=require('playwright'); }
catch(e){
  console.log('\n=== vote-assist の fill ===\n  － playwright が無いので飛ばしました');
  console.log('\n================ 結果: 0 件成功 / 0 件失敗 ================');
  process.exitCode = 0; return;
}
const V=require('../vote-assist.js');
const MOCK='file://'+path.join(__dirname,'fixtures','mock-vote.html');

/* モックは「唐津 6R」を表示している。plan もそれに合わせる。 */
const PLAN={ jcd:'23', rno:6, date:'2026-10-27', race:'唐津6R', total:1800,
  best:'1-2-3', rows:[
    {combo:'1-2-3',yen:500,kind:'本線'},
    {combo:'1-3-2',yen:100,kind:'本線'},
    {combo:'2-1-3',yen:100,kind:'本線'},
    {combo:'3-1-2',yen:100,kind:'波乱'},
    {combo:'6-3-1',yen:100,kind:'波乱'},
  ]};
PLAN.total = PLAN.rows.reduce((a,r)=>a+r.yen,0);

(async()=>{
  console.log('\n=== vote-assist の fill（本物の投票サイトには触らない） ===');
  let browser;
  try{ browser=await pw.chromium.launch({headless:true}); }
  catch(e){ console.log('  － ブラウザが無いので飛ばしました');
            console.log('\n================ 結果: 0 件成功 / 0 件失敗 ================'); return; }

  const run = async (prep) => {
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    if(prep) await prep(pg);
    const said=[]; const real=console.log; console.log=(...a)=>said.push(a.join(' '));
    let err=null;
    try{ await V.fill(ctx, PLAN, null); }catch(e){ err=e; }
    console.log=real;
    return {ctx, pg, err, said:said.join('\n')};
  };

  /* ---- ふつうに通る場合 ---- */
  {
    const {ctx,pg,err,said}=await run();
    ok_(!err, `最後まで通る（${err?err.message:'エラーなし'}）`);
    const cnt=await pg.textContent('#cnt'), sum=await pg.textContent('#sum');
    ok_(cnt==='5', `5点ぶん入った（画面 ${cnt}件）`);

    /* ★ ここが100倍事故の検査。plan は円、画面は100円単位。 */
    ok_(sum.replace(/,/g,'')===String(PLAN.total),
        `総購入金額が ¥${PLAN.total}（画面 ¥${sum}）＝100倍になっていない`);

    const items=await pg.$$eval('#list li', es=>es.map(e=>e.textContent));
    ok_(items.length===5, `ベットリストが5行（${items.length}行）`);
    ok_(items[0]==='1-2-3 ¥500', `1点目が 1-2-3 ¥500（${items[0]}）＝至極を厚くした分が正しい`);
    ok_(items[4]==='6-3-1 ¥100', `5点目が 6-3-1 ¥100（${items[4]}）＝艇番の並びが崩れていない`);
    const want=PLAN.rows.map(r=>r.combo).join(',');
    ok_(items.map(t=>t.split(' ')[0]).join(',')===want, '組番が買い目どおりの順で入っている');

    /* ★ 投票入力完了を押していないこと。押すと mock のタイトルが変わる。 */
    ok_((await pg.title())!=='★買ってしまった★', '「投票入力完了」を押していない');
    ok_(/買いません/.test(said), '買わないことを画面に出す');
    ok_(/合っています/.test(said), '合計が合ったことを出す');
    await ctx.close();
  }

  /* ---- ベットリストが空でない場合は触らない ---- */
  {
    const {ctx:ctx2,pg,err}=await run(async pg=>{
      await pg.click('#regbtn_1_1'); await pg.click('#regbtn_2_2'); await pg.click('#regbtn_3_3');
      await pg.fill('#amount','3'); await pg.click('#add');     /* 人が手で1点入れてある */
    });
    ok_(!!err && /既に/.test(err.message), `空でなければ止まる（${err?err.message.slice(0,40):'止まらなかった'}）`);
    ok_((await pg.textContent('#cnt'))==='1', '人が入れた1点を消していない（全削除を押していない）');
    ok_((await pg.textContent('#sum')).replace(/,/g,'')==='300', '人が入れた金額も変えていない');
    await ctx2.close();
  }

  /* ---- 投票画面でないところでは何もしない ---- */
  {
    const ctx=await browser.newContext();
    const pg=await ctx.newPage();
    await pg.goto('data:text/html,<title>ちがう画面</title><p>ここは投票画面ではない</p>');
    let err=null;
    const real=console.log; console.log=()=>{};
    try{ await V.fill(ctx, PLAN, null); }catch(e){ err=e; }
    console.log=real;
    ok_(!!err && /投票画面が見つかりません/.test(err.message),
        `投票画面が無ければ止まる（${err?err.message.slice(0,30):'止まらなかった'}）`);
    await ctx.close();
  }

  /* ---- 画面のレースと買い目のレースの照合 ----
     2026-10-27、丸亀6Rの買い目が残ったまま7Rの画面を開いていた。
     ここを見ていなければ、別のレースの買い目をそのまま打ち込んでいた。

     そのあと、同じ場の中ならタブで切り替えるようにした（auto.js 用）。
     なので「R が違う」は、同じ場なら切り替えて進み、場が違えば止まる。 */
  console.log('\n  画面のレースと買い目のレースの照合');
  {
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    const r=await V.readRaceOnScreen(pg);
    ok_(r.venue==='唐津' && r.rno===6, `画面から「唐津 6R」を読める（${r.venue} ${r.rno}R）`);
    ok_(await V.gotoRace(pg, 9), 'タブでレースを切り替えられる');
    ok_((await V.readRaceOnScreen(pg)).rno===9, '切り替わったことを読み返して確かめている');
    ok_(!(await V.gotoRace(pg, 99)), '無いレースには切り替わらない（false を返す）');
    await ctx.close();
  }
  {
    /* 同じ場で R だけ違う → 切り替えて進む */
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    const real=console.log; const said=[]; console.log=(...a)=>said.push(a.join(' '));
    let err=null; try{ await V.fill(ctx, {...PLAN, rno:9}, null); }catch(e){ err=e; }
    console.log=real;
    ok_(!err, `同じ場なら R が違っても切り替えて進む（${err?err.message.slice(0,40):'エラーなし'}）`);
    ok_((await V.readRaceOnScreen(pg)).rno===9, '画面が9Rに変わっている');
    ok_((await pg.textContent('#cnt'))==='5', '切り替えたうえで5点入っている');
    ok_(said.join('\n').includes('切り替えます'), '切り替えたことを画面に出す');
    await ctx.close();
  }
  {
    /* 場が違う → 止まる（場の切り替えは自動でやらない） */
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    const real=console.log; console.log=()=>{};
    let err=null; try{ await V.fill(ctx, {...PLAN, jcd:'15'}, null); }catch(e){ err=e; }
    console.log=real;
    ok_(!!err && /場が違います/.test(err.message),
        `場が違えば止まる（${err?err.message.slice(0,24):'止まらなかった'}）`);
    ok_((await pg.textContent('#cnt'))==='0', '場が違うときは1点も入れていない');
    await ctx.close();
  }
  {
    /* 切り替えられないとき（タブが無い）→ 止まる */
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    await pg.evaluate(()=>document.getElementById('tabs').remove());
    const real=console.log; console.log=()=>{};
    let err=null; try{ await V.fill(ctx, {...PLAN, rno:9}, null); }catch(e){ err=e; }
    console.log=real;
    ok_(!!err && /レース番号が違います/.test(err.message),
        `切り替えられなければ止まる（${err?err.message.slice(0,24):'止まらなかった'}）`);
    ok_((await pg.textContent('#cnt'))==='0', '切り替え失敗のときは1点も入れていない');
    await ctx.close();
  }
  {
    /* レースが読めない画面でも進まない */
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    await pg.evaluate(()=>document.getElementById('raceline').remove());
    const real=console.log; console.log=()=>{};
    let e=null; try{ await V.fill(ctx, PLAN, null); }catch(x){ e=x; }
    console.log=real;
    ok_(!!e && /読めません/.test(e.message),
        `レースが読めなければ止まる（${e?e.message.slice(0,24):'止まらなかった'}）`);
    ok_((await pg.textContent('#cnt'))==='0', '読めないときも1点も入れていない');
    await ctx.close();
  }

  /* ---- 金額の単位 ---- */
  console.log('\n  購入金額の単位（画面は100円単位）');
  for(const [yen,unit] of [[100,1],[500,5],[1000,10],[2000,20]])
    ok_(V.toUnit(yen)===unit, `¥${yen} は「${unit}」と入れる`);
  for(const bad of [150,99,0,-100,1.5])
    ok_((()=>{try{V.toUnit(bad);return false}catch(e){return true}})(), `¥${bad} は入れずに止まる`);

  await browser.close();
  console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
  process.exitCode = ng ? 1 : 0;
})();
