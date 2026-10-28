/* vote-assist.js の buy() — ここだけが金を動かす
   ==================================================================
   本物の投票サイトには触らない。確定画面を写した
   tests/fixtures/mock-vote.html で、実際に「投票する」まで押して確かめる。

   いちばん大事なのは3つ。
     ・金額の単位を画面から読み、100倍にしない
     ・合計が買い目と違えば押さない
     ・環境変数（パスワード・規約の確認）が無ければ押さない */
const path=require('path'), fs=require('fs');
let ok=0, ng=0;
const ok_=(c,m)=>{ if(c){ok++;console.log('  ✓ '+m);} else {ng++;console.log('  ✗ FAIL: '+m);} };

let pw; try{ pw=require('playwright'); }
catch(e){ console.log('\n=== buy ===\n  － playwright が無いので飛ばしました');
          console.log('\n================ 結果: 0 件成功 / 0 件失敗 ================'); process.exit(0); }
const V=require('../vote-assist.js');
const MOCK='file://'+path.join(__dirname,'fixtures','mock-vote.html');

const PLAN={ jcd:'23', rno:6, date:'2026-10-28', race:'唐津6R', best:'1-2-3',
  rows:[{combo:'1-2-3',yen:500},{combo:'1-3-2',yen:100},{combo:'2-1-3',yen:100},
        {combo:'3-1-2',yen:100},{combo:'6-3-1',yen:100}] };
PLAN.total = PLAN.rows.reduce((a,r)=>a+r.yen,0);   /* ¥900 */

const quiet = async f => { const r=console.log; const said=[]; console.log=(...a)=>said.push(a.join(' '));
  let err=null, out=null; try{ out=await f(); }catch(e){ err=e; } console.log=r;
  return {err, out, said:said.join('\n')}; };

(async()=>{
  console.log('\n=== buy（本物の投票サイトには触らない） ===');
  let browser;
  try{ browser=await pw.chromium.launch({headless:true}); }
  catch(e){ console.log('  － ブラウザが無いので飛ばしました');
            console.log('\n================ 結果: 0 件成功 / 0 件失敗 ================'); return; }

  const OLD={pw:process.env.BOAT_BET_PASSWORD, ok:process.env.BOAT_TERMS_OK};
  const setEnv=(p,t)=>{ if(p===null) delete process.env.BOAT_BET_PASSWORD; else process.env.BOAT_BET_PASSWORD=p;
                        if(t===null) delete process.env.BOAT_TERMS_OK;     else process.env.BOAT_TERMS_OK=t; };
  const prep = async (unit='円') => {
    const ctx=await browser.newContext();
    const pg=await ctx.newPage(); await pg.goto(MOCK);
    await pg.evaluate(u=>{document.getElementById('c_unit').textContent=' '+u;}, unit);
    await quiet(()=>V.fill(ctx, PLAN, null));     /* 5点入れておく */
    return {ctx, pg};
  };

  console.log('\n  環境変数が無ければ押さない');
  {
    setEnv(null,'yes');
    const {ctx,pg}=await prep();
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!!err && /投票用パスワード/.test(err.message), `パスワードが無ければ止まる（${err?err.message.slice(0,24):'止まらなかった'}）`);
    ok_((await pg.title())!=='★買ってしまった★', 'そのとき買っていない');
    await ctx.close();
  }
  {
    setEnv('abc1234', null);
    const {ctx,pg}=await prep();
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!!err && /規約/.test(err.message), `規約の確認が無ければ止まる（${err?err.message.slice(0,20):'止まらなかった'}）`);
    ok_((await pg.title())!=='★買ってしまった★', 'そのとき買っていない');
    await ctx.close();
  }

  setEnv('abc1234','yes');

  console.log('\n  ふつうに買えるか（確定画面の単位が「円」）');
  {
    const {ctx,pg}=await prep('円');
    const {err,out,said}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!err, `最後まで通る（${err?err.message:'エラーなし'}）`);
    ok_(out && out.bought===true, '買ったと返す');
    const b=await pg.evaluate(()=>window.__bought);
    ok_(!!b, '「投票する」が押されている');
    ok_(b && b.yen===PLAN.total, `買った額が ¥${PLAN.total}（画面 ¥${b?b.yen:'-'}）＝100倍になっていない`);
    ok_(b && b.pw==='abc1234', '投票用パスワードが入っている');
    ok_(!said.includes('abc1234'), '画面にパスワードを出していない');
    ok_(out && out.confirmed===true, '受付の表示を確かめている');
    await ctx.close();
  }

  console.log('\n  ★ 確定画面の単位が「00円」だったら（100倍事故の検査）');
  {
    const {ctx,pg}=await prep('00円');
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!err, `単位を読んで入れ直す（${err?err.message.slice(0,40):'エラーなし'}）`);
    const b=await pg.evaluate(()=>window.__bought);
    ok_(b && b.yen===PLAN.total, `買った額が ¥${PLAN.total}（画面 ¥${b?b.yen:'-'}）＝単位が違っても100倍にならない`);
    await ctx.close();
  }

  console.log('\n  単位が読めなければ入れない');
  {
    const {ctx,pg}=await prep('');
    await pg.evaluate(()=>{ const e=document.getElementById('c_unit'); if(e) e.remove(); });
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!!err && /単位/.test(err.message), `単位が読めなければ止まる（${err?err.message.slice(0,30):'止まらなかった'}）`);
    ok_(!(await pg.evaluate(()=>window.__bought)), 'そのとき買っていない');
    await ctx.close();
  }

  console.log('\n  合計が買い目と違えば押さない');
  {
    const {ctx,pg}=await prep();
    /* 人が1点足したことにする */
    await pg.click('#regbtn_4_1'); await pg.click('#regbtn_5_2'); await pg.click('#regbtn_6_3');
    await pg.fill('#amount','1'); await pg.click('#add');
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!!err && /合計/.test(err.message), `入力画面の合計が違えば止まる（${err?err.message.slice(0,24):'止まらなかった'}）`);
    ok_(!(await pg.evaluate(()=>window.__bought)), 'そのとき買っていない');
    await ctx.close();
  }

  console.log('\n  残高（購入限度額）');
  {
    const {ctx,pg}=await prep();
    ok_((await V.readBalance(pg))===10000, '画面から購入限度額を読める（¥10,000）');
    await ctx.close();
  }
  {
    /* 残高が買い目に足りない */
    const {ctx,pg}=await prep();
    await pg.evaluate(()=>{document.getElementById('bal').textContent='購入限度額 500 円　購入可能ベット数 9,999';});
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!!err && /残高が足りません/.test(err.message),
        `足りなければ押さない（${err?err.message.slice(0,30):'止まらなかった'}）`);
    ok_(!!err && err.outOfMoney===true, 'ループに「残高切れ」と伝える印が付く');
    ok_(!(await pg.evaluate(()=>window.__bought)), 'そのとき買っていない');
    await ctx.close();
  }
  {
    /* ちょうど足りる */
    const {ctx,pg}=await prep();
    await pg.evaluate(()=>{document.getElementById('bal').textContent='購入限度額 900 円　購入可能ベット数 9,999';});
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!err, `ちょうど足りれば買える（${err?err.message.slice(0,30):'エラーなし'}）`);
    await ctx.close();
  }
  {
    /* 限度額が読めない画面でも、ほかが揃っていれば買える（読めないだけで止めない） */
    const {ctx,pg}=await prep();
    await pg.evaluate(()=>{const e=document.getElementById('bal'); if(e) e.remove();});
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!err, `限度額が読めなくても、ほかが揃っていれば進む（${err?err.message.slice(0,30):'エラーなし'}）`);
    await ctx.close();
  }

  console.log('\n  --buy-dry なら押さない');
  {
    const {ctx,pg}=await prep();
    const {err,out}=await quiet(()=>V.buy(ctx, PLAN, {dryRun:true}));
    ok_(!err, `最後まで通る（${err?err.message.slice(0,40):'エラーなし'}）`);
    ok_(out && out.bought===false, '買っていないと返す');
    ok_(!(await pg.evaluate(()=>window.__bought)), '「投票する」を押していない');
    /* --buy-dry はパスワードを入れない。人が打つほうが確実だと分かったため
       （こちらから入れるのは実機で2回とも弾かれた）。 */
    ok_((await pg.inputValue('#c_pw')).length===0, 'パスワードは入れない（人が打つ）');
    ok_(out && out.waitingHuman===true, '人の入力待ちだと返す');
    await ctx.close();
  }

  console.log('\n  ★ 見えないパスワード欄に入れない（実機で弾かれた罠）');
  {
    const {ctx,pg}=await prep();
    const {err}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!err, `最後まで通る（${err?err.message.slice(0,50):'エラーなし'}）`);
    ok_(!(await pg.evaluate(()=>window.__rejected)), '弾かれていない');
    ok_((await pg.inputValue('#c_pw'))==='abc1234', '見えている「投票用パスワード」の欄に入っている');
    ok_((await pg.inputValue('#hiddenpw'))==='', '見えない欄には入れていない');
    const b=await pg.evaluate(()=>window.__bought);
    ok_(b && b.pw==='abc1234', '送られたパスワードが正しい');
    await ctx.close();
  }
  {
    /* 弾かれたときに、買えていないことをはっきり伝える */
    const {ctx,pg}=await prep();
    await pg.evaluate(()=>{ /* 見える欄を読み取り専用にして入らなくする */
      const e=document.getElementById('c_pw'); e.readOnly=true; });
    const {err,said}=await quiet(()=>V.buy(ctx, PLAN, {}));
    ok_(!!err, `入らなければ止まる（${err?err.message.slice(0,40):'止まらなかった'}）`);
    ok_(!(await pg.evaluate(()=>window.__bought)), 'そのとき買っていない');
    await ctx.close();
  }

  console.log('\n  会員規約の条文を必ず出すこと');
  {
    /* 2026-10-28、第25条(4)（公式以外のソフトで投票画面を操作）に当たる
       可能性があると分かったうえで、本人の判断で使うことになった。
       黙って動く版に戻らないよう、ここで固定する。 */
    const SRC=fs.readFileSync(path.join(__dirname,'..','vote-assist.js'),'utf8');
    const AUTO=fs.readFileSync(path.join(__dirname,'..','auto.js'),'utf8');
    ok_(/第25条/.test(V.TERMS_NOTICE), '条文番号が入っている');
    for(const w of ['(2)','(4)','(6)'])
      ok_(V.TERMS_NOTICE.includes(w), `${w} が引いてある`);
    ok_(/口座の停止/.test(V.TERMS_NOTICE), '何が起きうるかが書いてある');
    ok_(/showTermsNotice\(\);/.test(SRC.slice(SRC.indexOf('async function fill'), SRC.indexOf('async function fill')+200)),
        'fill() の先頭で出す');
    ok_(/showTermsNotice\(\);/.test(SRC.slice(SRC.indexOf('async function buy'), SRC.indexOf('async function buy')+200)),
        'buy() の先頭で出す');
    ok_(/TERMS_NOTICE/.test(AUTO), 'auto.js も --fill/--buy のとき出す');
    /* 公式への当たり方を緩めたこと */
    ok_(/sleep\(180\)/.test(AUTO), '展示の確認は3分おき（30秒おきにしない）');
  }

  setEnv(OLD.pw ?? null, OLD.ok ?? null);
  await browser.close();
  console.log(`\n================ 結果: ${ok} 件成功 / ${ng} 件失敗 ================`);
  process.exitCode = ng ? 1 : 0;
})();
