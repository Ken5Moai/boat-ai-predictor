/* 指定した秒数、確実に待つ
   ==================================================================
   もとは外の sleep コマンドを呼んでいた。

     const sleep = sec => { try{ execFileSync('sleep',[String(sec)]); }catch(e){} };

   Windows に sleep コマンドは無い。失敗を握りつぶしていたので、
   待たずに即座に戻り、ループが空回りした（2026-10-28、丸亀10Rの待機で
   「10分待ちます」が1秒に何十回も出た）。
   このまま展示待ちに入ると、公式サイトを高速で叩き続けることになる。
   まさに会員規約 第25条(2)「極めて短時間に機械的に反復して…照会」の状態。

   Atomics.wait は、どのOSでも、CPUを食わずに、同期で待つ。
   待つ相手のいない SharedArrayBuffer を使うので、必ず時間切れで戻る。 */
const SAB = new Int32Array(new SharedArrayBuffer(4));

module.exports = function sleep(sec){
  const ms = Math.max(0, Math.round(Number(sec) * 1000));
  if(!ms) return;
  Atomics.wait(SAB, 0, 0, ms);
};
