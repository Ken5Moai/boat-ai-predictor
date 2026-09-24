// 実際に走ったレースで採点の当たり具合を測る道具。
// 重みやバンドを思いつきで変えないための検証環境。
//   使い方: node backtest.js        （index.html と同じ場所で実行）
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const ODDS=require('./odds.js');   /* 実オッズ120通り（あるレースだけ） */
const PENDING=require('./pending.js'); /* まだ結果の出ていないレース */

const HTML_PATH=path.join(__dirname,'index.html');
const HTML=fs.readFileSync(HTML_PATH,'utf8');
/* 競艇場ごとの公表イン率（1コース1着率）。index.html の VENUES から読む。
   17レースの勝率よりずっと確かな物差しとして、採点の校正に使う。 */
const VENUE_IN_RATE = (()=>{
  const out = {};
  const src = HTML;
  const re = /'(\d{2})':\{name:'[^']+',\s*water:'[^']+',\s*inRate:(\d+)/g;
  let m; while((m = re.exec(src))) out[m[1]] = Number(m[2]);
  return out;
})();

// ---- 実際に走ったレース（結果つき） ----
// rec は [進入コース, ST, 着順] の並び。新しい順ではなく出走表の並び（古い→新しい）。
const RACES=[
{name:'桐生8R 女子',jcd:'01',rno:1,date:'2026-09-23',result:'1-5-4',pop:null,pay:1400,wind:'向かい風',ws:2,wave:1,
 B:[
 {reg:'4373',g:'A1',nat:6.14,loc:7.40,mot:38.31,bt:37.84,st:0.17,F:1,exST:0.22,exF:null,exT:6.74,tilt:-0.5,wt:46.5,rec:[[2,.18,4],[6,.26,3],[3,.24,3],[1,.24,1],[5,.23,4]]},
 {reg:'4720',g:'B1',nat:3.33,loc:5.70,mot:29.89,bt:37.70,st:0.20,F:1,exST:0.15,exF:null,exT:6.74,tilt:0.0,wt:47.8,rec:[[6,.23,6],[3,.08,4],[5,.26,6],[4,.17,3],[1,.23,6]]},
 {reg:'4443',g:'B1',nat:5.51,loc:null,mot:49.04,bt:40.86,st:0.19,F:0,exST:0.13,exF:null,exT:6.82,tilt:0.0,wt:50.2,rec:[[2,.19,1],[3,.27,5],[1,.14,2],[4,.15,3],[6,.20,5]]},
 {reg:'5213',g:'B1',nat:5.24,loc:5.09,mot:37.58,bt:37.31,st:0.20,F:0,exST:0.03,exF:'F',exT:6.69,tilt:-0.5,wt:46.5,rec:[[4,.11,'失'],[3,.15,2],[2,.25,1],[5,.30,2],[1,.22,2]]},
 {reg:'5195',g:'A2',nat:5.28,loc:4.22,mot:34.31,bt:31.28,st:0.15,F:1,exST:0.02,exF:'F',exT:6.87,tilt:0.0,wt:48.0,rec:[[4,.18,5],[6,.08,3],[3,.04,1],[1,.18,1],[2,.17,1]]},
 {reg:'5437',g:'B2',nat:1.61,loc:null,mot:29.65,bt:28.65,st:0.23,F:1,exST:0.05,exF:null,exT:6.71,tilt:-0.5,wt:51.4,rec:[[6,.17,5],[6,.19,6],[6,.23,5],[6,.21,'失']]}]},
{name:'桐生9R 男子',jcd:'01',rno:9,date:'2026-09-23',result:'1-3-2',pop:null,pay:4100,wind:'向かい風',ws:1,wave:1,
 B:[
 {reg:'4311',g:'A1',nat:6.34,loc:6.81,mot:34.41,bt:39.01,st:0.15,F:1,exST:0.02,exF:null,exT:6.80,tilt:-0.5,wt:54.2,rec:[[1,.22,1],[5,.28,4],[4,.18,5],[3,.18,5],[6,.19,4]]},
 {reg:'4228',g:'A2',nat:6.50,loc:5.75,mot:27.89,bt:32.80,st:0.17,F:1,exST:0.02,exF:'F',exT:6.84,tilt:-0.5,wt:54.3,rec:[[2,.21,6],[5,.17,5],[6,.22,6],[3,.12,3],[1,.20,2]]},
 {reg:'5179',g:'B1',nat:4.55,loc:2.63,mot:35.79,bt:30.05,st:0.20,F:0,exST:0.02,exF:'F',exT:6.81,tilt:0.0,wt:52.5,rec:[[5,.21,4],[6,.09,6],[2,.23,5],[4,.13,4],[1,.10,5]]},
 {reg:'4351',g:'A1',nat:6.94,loc:7.18,mot:27.84,bt:31.09,st:0.13,F:1,exST:0.07,exF:'F',exT:6.83,tilt:-0.5,wt:52.0,rec:[[6,.08,3],[3,.16,4],[2,.12,1],[1,.18,3],[2,.17,1]]},
 {reg:'5427',g:'B1',nat:3.04,loc:2.35,mot:36.79,bt:34.36,st:0.22,F:0,exST:0.05,exF:'F',exT:6.74,tilt:-0.5,wt:52.0,rec:[[6,.15,4],[5,.21,5],[4,.14,3],[5,.18,3],[6,.03,6]]},
 {reg:'3538',g:'B2',nat:3.92,loc:5.48,mot:41.54,bt:34.55,st:0.21,F:0,exST:0.11,exF:null,exT:6.94,tilt:-0.5,wt:52.0,rec:[[1,.18,5],[4,.07,5],[2,.21,5],[5,.14,5],[3,.15,5]]}]},
{name:'桐生12R 特選',jcd:'01',rno:12,date:'2026-09-23',result:'1-5-4',pop:33,pay:10960,wind:'向かい風',ws:2,wave:1,
 B:[
 {reg:'4627',g:'A2',nat:6.29,loc:5.27,mot:28.18,bt:34.02,st:0.15,F:0,exST:0.02,exF:null,exT:6.77,tilt:-0.5,wt:47.1,rec:[[3,.12,5],[1,.15,1],[5,.11,1],[2,.19,1],[6,.19,5],[3,.21,'失']]},
 {reg:'4478',g:'A1',nat:5.94,loc:6.04,mot:30.93,bt:40.44,st:0.16,F:0,exST:0.06,exF:null,exT:6.71,tilt:-0.5,wt:47.2,rec:[[5,.15,2],[1,.13,1],[2,.13,3],[6,.12,5],[3,.17,1],[1,.13,3]]},
 {reg:'5265',g:'B1',nat:3.82,loc:2.88,mot:31.55,bt:38.54,st:0.15,F:0,exST:0.24,exF:null,exT:6.78,tilt:0.0,wt:45.0,rec:[[5,.12,4],[4,.11,3],[2,.08,3],[1,.21,1],[6,.13,2]]},
 {reg:'4373',g:'A1',nat:6.14,loc:7.40,mot:38.31,bt:37.84,st:0.17,F:1,exST:0.03,exF:null,exT:6.59,tilt:-0.5,wt:46.5,rec:[[2,.18,4],[6,.26,3],[3,.24,3],[1,.24,1],[5,.23,4],[1,.13,1]]},
 {reg:'5335',g:'B1',nat:3.10,loc:2.78,mot:37.31,bt:38.59,st:0.18,F:0,exST:0.01,exF:'F',exT:6.67,tilt:-0.5,wt:47.0,rec:[[5,.05,1],[1,.23,2],[4,.18,5],[2,.19,6],[6,.05,5]]},
 {reg:'4642',g:'A2',nat:6.98,loc:5.40,mot:33.49,bt:33.88,st:0.16,F:0,exST:0.01,exF:null,exT:6.71,tilt:-0.5,wt:46.5,rec:[[1,.22,3],[4,.11,2],[6,.23,5],[5,.21,3],[3,.17,1],[2,.17,1]]}]},
// 徳山1R: 1号艇の展示STが最悪(.24)なのに本番.05で逃げ切った。実績と展示が正面から対立した例。
{name:'徳山1R 一般',pays:{tan:130, ni:300, nifuku:280, sanfuku:370},jcd:'18',rno:1,date:'2026-09-23',result:'1-2-4',pop:1,pay:790,wind:null,ws:3,wave:3,temp:27,wtemp:27,
 B:[
 {reg:'4388',g:'A2',nat:6.22,loc:4.96,mot:35.59,bt:29.61,st:0.17,F:0,exST:0.24,exF:null,exT:6.91,tilt:-0.5,wt:52.0,rec:[[5,.32,3],[3,.17,2],[5,.09,4],[5,.16,5]]},
 {reg:'5206',g:'B1',nat:4.62,loc:4.22,mot:29.47,bt:28.90,st:0.15,F:1,exST:0.08,exF:null,exT:6.83,tilt:0.0,wt:52.8,rec:[[6,.15,5],[3,.18,3],[5,.13,5]]},
 {reg:'5124',g:'B1',nat:4.31,loc:4.76,mot:21.11,bt:35.21,st:0.17,F:0,exST:0.02,exF:null,exT:6.87,tilt:-0.5,wt:52.7,rec:[[6,.14,6],[2,.24,6],[2,.19,3]]},
 {reg:'4663',g:'B2',nat:5.73,loc:null,mot:30.97,bt:38.14,st:0.16,F:1,exST:0.07,exF:null,exT:6.87,tilt:-0.5,wt:51.0,adj:1.0,rec:[[5,.21,3],[2,.21,5],[1,.16,5]]},
 {reg:'3401',g:'B1',nat:4.61,loc:4.32,mot:24.75,bt:40.00,st:0.22,F:0,exST:0.15,exF:null,exT:6.91,tilt:-0.5,wt:52.5,parts:'リング2',rec:[[2,.16,5],[6,.20,3],[3,.23,4]]},
 {reg:'4943',g:'B1',nat:4.50,loc:3.44,mot:38.00,bt:36.28,st:0.15,F:0,exST:0.03,exF:null,exT:6.86,tilt:-0.5,wt:52.6,rec:[[2,.07,4],[5,.15,6],[3,.09,2]]}]},
// 徳山2R: 修正後ロジックの初実戦。1号艇の展示ST .28(最悪)を理由に
// 3号艇を頭にした判断が当たった。決まり手は3号艇のまくり差し。
// 6号艇の展示ST .74 は範囲外として不採用（スタート練習をしていない数字）。
{name:'徳山2R 特選',pays:{tan:290, ni:450, nifuku:280, sanfuku:520},jcd:'18',rno:2,date:'2026-09-23',result:'3-1-2',pop:17,pay:4240,wind:null,ws:1,wave:1,temp:25,wtemp:26,
 B:[
 {reg:'4375',g:'A2',nat:5.75,loc:5.47,mot:22.11,bt:34.27,st:0.17,F:0,exST:0.28,exF:null,exT:6.95,tilt:0.0,wt:52.2,rec:[[3,.15,3],[4,.13,1],[5,.12,3]]},
 {reg:'4583',g:'B1',nat:5.52,loc:3.17,mot:34.82,bt:37.14,st:0.15,F:1,exST:0.13,exF:null,exT:7.00,tilt:0.0,wt:52.0,rec:[[3,.19,2],[6,.37,6],[4,.02,3]]},
 {reg:'4702',g:'A1',nat:5.85,loc:5.92,mot:42.27,bt:41.06,st:0.14,F:0,exST:0.09,exF:null,exT:6.91,tilt:-0.5,wt:52.0,rec:[[1,.11,1],[5,.06,3],[2,.13,3]]},
 {reg:'4163',g:'A2',nat:5.65,loc:4.72,mot:28.93,bt:28.16,st:0.16,F:0,exST:0.12,exF:null,exT:6.83,tilt:0.0,wt:52.0,rec:[[5,.30,3],[2,.27,3],[6,.16,3]]},
 {reg:'4159',g:'A2',nat:6.59,loc:5.36,mot:39.56,bt:28.71,st:0.17,F:0,exST:0.17,exF:null,exT:6.93,tilt:0.0,wt:52.0,rec:[[2,.11,2],[3,.02,2],[6,.06,4]]},
 {reg:'3772',g:'B1',nat:4.87,loc:4.95,mot:37.07,bt:32.04,st:0.16,F:0,exST:0.74,exF:null,exT:7.00,tilt:0.0,wt:53.1,parts:'リング4',rec:[[4,.17,3],[1,.32,4],[2,.10,4]]}]},
// 徳山3R: スタート展示で5号艇と6号艇が入れ替わり（entry を指定）。
// 1・2・3号艇は展示でF。5号艇は当地勝率も平均STも記録なし。
// 買い目の1番手で決まったが、12点均等では払戻¥1,020 < 投資¥1,200 で赤字だった。
{name:'徳山3R 特賞',pays:{tan:110, ni:430, nifuku:310, sanfuku:360},jcd:'18',rno:3,date:'2026-09-23',result:'1-6-4',pop:4,pay:1020,wind:null,ws:2,wave:2,temp:25,wtemp:26,
 B:[
 {reg:'4529',g:'A1',nat:5.66,loc:5.08,mot:50.93,bt:27.96,st:0.14,F:0,exST:0.06,exF:'F',exT:6.90,tilt:0.0,wt:53.4,entry:1,rec:[[1,.12,1],[5,.20,2],[4,.12,2],[3,.17,2]]},
 {reg:'3577',g:'B1',nat:4.36,loc:3.44,mot:24.27,bt:27.75,st:0.17,F:0,exST:0.06,exF:'F',exT:6.96,tilt:-0.5,wt:58.6,entry:2,rec:[[1,.29,4],[5,.09,5],[3,.07,2]]},
 {reg:'4173',g:'B1',nat:5.31,loc:4.80,mot:24.73,bt:24.73,st:0.17,F:0,exST:0.04,exF:'F',exT:6.96,tilt:0.0,wt:55.9,entry:3,rec:[[5,.24,5],[2,.20,1],[4,.13,3]]},
 {reg:'4079',g:'A2',nat:5.95,loc:5.94,mot:29.11,bt:31.75,st:0.19,F:0,exST:0.06,exF:null,exT:6.92,tilt:-0.5,wt:52.2,entry:4,rec:[[2,.13,1],[6,.09,5],[5,.14,4]]},
 {reg:'5460',g:'B2',nat:1.70,loc:null,mot:32.48,bt:31.16,st:null,F:0,exST:0.19,exF:null,exT:6.95,tilt:0.0,wt:52.8,entry:6,rec:[[6,.16,6],[6,.25,5]]},
 {reg:'4883',g:'A2',nat:6.35,loc:4.71,mot:47.00,bt:27.27,st:0.16,F:0,exST:0.08,exF:null,exT:6.92,tilt:-0.5,wt:52.1,entry:5,rec:[[5,.18,3],[2,.26,1],[1,.06,1],[4,.17,6]]}]},
// 徳山4R: 進入は枠なり。展示で1・2・5号艇がF。1号艇は通算F1持ちで今節も2,6,6。
// モデルは2号艇を頭にしたが1号艇が逃げ切り。上位3艇の顔ぶれ{1,2,4}は当てた。
// スコア差4.8（小さい＝荒れる想定）だったのに配当は¥890（2番人気）。
// 「差が小さい＝高配当」の見立てが初めて外れたレース。
{name:'徳山4R 予選',pays:{tan:120, ni:250, nifuku:140, sanfuku:250},jcd:'18',rno:4,date:'2026-09-23',result:'1-2-4',pop:2,pay:890,wind:null,ws:2,wave:2,temp:25,wtemp:26,
 B:[
 {reg:'4911',g:'A2',nat:4.72,loc:5.43,mot:38.21,bt:37.56,st:0.14,F:1,exST:0.06,exF:'F',exT:6.96,tilt:0.0,wt:52.5,adj:0.0,entry:1,rec:[[3,.33,2],[3,.12,6],[6,.19,6]]},
 {reg:'4757',g:'A1',nat:6.64,loc:6.46,mot:30.17,bt:28.84,st:0.15,F:0,exST:0.01,exF:'F',exT:6.97,tilt:0.0,wt:52.1,adj:0.0,entry:2,rec:[[5,.12,1],[1,.10,1],[5,.08,2]]},
 {reg:'5286',g:'B1',nat:4.67,loc:3.77,mot:24.75,bt:21.48,st:0.16,F:1,exST:0.08,exF:null,exT:6.94,tilt:0.0,wt:51.0,adj:1.0,entry:3,rec:[[4,.13,4],[2,.09,6],[6,.14,3]]},
 {reg:'4594',g:'B1',nat:6.26,loc:5.55,mot:40.63,bt:35.07,st:0.16,F:0,exST:0.13,exF:null,exT:6.95,tilt:0.0,wt:52.0,adj:0.0,entry:4,rec:[[2,.11,2],[6,.27,5],[5,.15,5]]},
 {reg:'4811',g:'B1',nat:4.97,loc:5.13,mot:38.95,bt:28.57,st:0.16,F:0,exST:0.01,exF:'F',exT:6.87,tilt:0.0,wt:50.5,adj:1.5,entry:5,rec:[[4,.11,6],[1,.18,1],[3,.13,4]]},
 {reg:'4090',g:'B2',nat:6.08,loc:6.18,mot:20.59,bt:38.14,st:0.16,F:0,exST:0.21,exF:null,exT:6.93,tilt:0.0,wt:54.0,adj:0.0,entry:6,rec:[[4,.08,5],[5,.12,6],[3,.13,1]]}]},
// 徳山5R: 進入は枠なり。展示で5・6号艇がF。3号艇はシリンダ交換。
// 2号艇の今節1走目は転覆、3号艇は落水（着順の平均からは除外される）。
// 直前の水面は風速1m・波高1cmだったが、レース時は風速3m・波高3cmに変わった。
// モデル5位（1着率6.2%）の3号艇が2着に入り、12点では取れなかった。
// チルト+0.5 で +3.0 した6号艇は最下位。
{name:'徳山5R 予選',pays:{tan:120, ni:670, nifuku:800, sanfuku:1150},jcd:'18',rno:5,date:'2026-09-23',result:'1-3-4',pop:9,pay:2060,wind:null,ws:3,wave:3,temp:26,wtemp:26,
 B:[
 {reg:'4323',g:'B1',nat:6.09,loc:4.13,mot:41.75,bt:36.74,st:0.17,F:0,exST:0.19,exF:null,exT:6.86,tilt:0.0,wt:55.4,entry:1,rec:[[5,.07,3],[4,.22,2],[4,.08,1]]},
 {reg:'4677',g:'A1',nat:6.09,loc:5.82,mot:25.58,bt:29.38,st:0.15,F:0,exST:0.27,exF:null,exT:6.95,tilt:0.0,wt:52.1,entry:2,rec:[[3,.12,'転'],[1,.16,4],[4,.11,6]]},
 {reg:'4981',g:'B1',nat:5.24,loc:5.72,mot:20.79,bt:37.09,st:0.18,F:0,exST:0.12,exF:null,exT:6.97,tilt:-0.5,wt:52.4,entry:3,parts:'シリンダ',rec:[[5,.14,'落'],[2,.19,4],[1,.32,6]]},
 {reg:'4839',g:'A2',nat:6.18,loc:5.32,mot:43.68,bt:30.84,st:0.15,F:0,exST:0.13,exF:null,exT:6.96,tilt:0.0,wt:52.0,entry:4,rec:[[3,.10,4],[6,.14,4],[4,.28,5],[2,.12,4]]},
 {reg:'3637',g:'B1',nat:3.58,loc:3.74,mot:30.56,bt:31.46,st:0.18,F:0,exST:0.02,exF:'F',exT:6.96,tilt:-0.5,wt:52.8,entry:5,rec:[[1,.11,2],[3,.23,5],[4,.15,6]]},
 {reg:'4679',g:'A2',nat:6.09,loc:5.77,mot:35.71,bt:40.00,st:0.16,F:0,exST:0.08,exF:'F',exT:6.83,tilt:0.5,wt:56.0,entry:6,rec:[[3,.15,1],[3,.44,5],[4,.11,2],[3,.15,2]]}]},
// 徳山6R: スタート展示の進入は 1-2-6-3-4-5（6号艇が3コースまで前づけ）。
// ところが本番は 1-6-2-3-4-5 と、さらに動いた（石川が2コースまで入り、
// 押し出された村松が3コースからまくって1着）。
// entry は「賭ける時点で分かっていた展示の進入」を入れる。
// actualEntry は本番の進入で、答え合わせ用。採点には使わない。
// 1号艇の梅原（F1持ち）は本番ST .32 で最下位。
{name:'徳山6R 予選',pays:{tan:170, ni:2390, nifuku:1650, sanfuku:1040},jcd:'18',rno:6,date:'2026-09-23',result:'2-3-6',pop:25,pay:5660,wind:null,ws:3,wave:3,temp:26,wtemp:26,
 actualEntry:{1:1,2:3,3:4,4:5,5:6,6:2},
 B:[
 {reg:'5206',g:'B1',nat:4.62,loc:4.22,mot:29.47,bt:28.90,st:0.15,F:1,exST:0.06,exF:null,exT:6.88,tilt:0.0,wt:52.8,entry:1,rec:[[6,.15,5],[3,.18,6],[5,.13,5],[2,.13,2]]},
 {reg:'4816',g:'A2',nat:5.63,loc:5.67,mot:21.79,bt:37.26,st:0.16,F:0,exST:0.06,exF:null,exT:6.93,tilt:0.0,wt:55.0,entry:2,rec:[[3,.07,2],[6,.15,3],[1,.03,1],[5,.16,2]]},
 {reg:'5027',g:'B1',nat:4.38,loc:5.53,mot:28.87,bt:33.33,st:0.20,F:0,exST:0.19,exF:null,exT:6.88,tilt:-0.5,wt:53.7,entry:4,rec:[[2,.20,4],[4,.22,6],[5,.13,2]]},
 {reg:'4159',g:'A2',nat:6.59,loc:5.36,mot:39.56,bt:28.71,st:0.17,F:0,exST:0.07,exF:null,exT:6.87,tilt:-0.5,wt:52.0,entry:5,rec:[[2,.11,2],[3,.02,2],[6,.06,4],[5,.11,5]]},
 {reg:'5290',g:'B1',nat:3.43,loc:1.25,mot:37.38,bt:28.97,st:0.17,F:0,exST:0.05,exF:null,exT:6.92,tilt:0.0,wt:52.0,entry:6,rec:[[6,.22,6],[4,.11,2],[2,.07,4]]},
 {reg:'3473',g:'A1',nat:6.75,loc:6.75,mot:39.58,bt:37.75,st:0.14,F:1,exST:0.19,exF:null,exT:6.93,tilt:-0.5,wt:52.5,entry:3,rec:[[2,.18,4],[1,.15,1],[1,.20,1]]}]},
// 三国1R（2026-09-24 5日目）: 初めて3連単オッズ120通りが揃ったレース。
// 進入は枠なり。今節成績は5日目で表が密になり読み取りが安定しなかったため入れていない。
// 期待値で選んだ4点はすべて外れ、確率順12点なら3番目で当たっていた。
// モデルが市場より高く買っていた5号艇（展示タイム最速・展示ST.02）は
// 本番ST .27 で5着。展示が当てにならなかった例がまた1つ増えた。
{name:'三国1R 一般',pays:{tan:140, ni:230, nifuku:150, sanfuku:350},jcd:'10',rno:1,date:'2026-09-24',result:'1-2-3',pop:2,pay:510,wind:null,ws:1,wave:1,temp:23,wtemp:23,
 B:[
 {reg:'3333',g:'A1',nat:6.56,loc:6.67,mot:35.61,bt:18.75,st:0.15,F:0,exST:0.01,exF:null,exT:6.67,tilt:-0.5,wt:52.1,entry:1,rec:[]},
 {reg:'4894',g:'B1',nat:4.64,loc:null,mot:32.80,bt:35.34,st:0.19,F:0,exST:0.10,exF:null,exT:6.75,tilt:-0.5,wt:52.0,entry:2,rec:[]},
 {reg:'5190',g:'B1',nat:4.00,loc:3.97,mot:33.59,bt:41.32,st:0.18,F:1,exST:0.10,exF:null,exT:6.70,tilt:-0.5,wt:52.0,entry:3,rec:[]},
 {reg:'3652',g:'B1',nat:3.57,loc:3.72,mot:36.62,bt:31.45,st:0.19,F:0,exST:0.11,exF:null,exT:6.73,tilt:-0.5,wt:54.4,entry:4,rec:[]},
 {reg:'4902',g:'B1',nat:4.26,loc:4.94,mot:36.96,bt:32.54,st:0.20,F:0,exST:0.02,exF:null,exT:6.65,tilt:0.0,wt:52.0,entry:5,rec:[]},
 {reg:'5465',g:'B2',nat:1.07,loc:1.11,mot:34.53,bt:33.08,st:null,F:1,exST:0.15,exF:null,exT:6.66,tilt:-0.5,wt:54.2,entry:6,rec:[]}]},
// 三国3R（2026-09-24 5日目）: 進入は枠なり。1号艇(A1 一瀬)の展示STが .32 と断トツに遅く、
// モデルは1着確率を48.4%まで下げた（市場は57.9%のまま）。結果その1号艇は4着。
// モデルが市場と食い違った方向は、1・2・3号艇すべてで正しかった。
// それでも結果 2-4-3 はモデル65番目（0.27%）で、4号艇の2着はまったく読めていない。
// 「1着は当てられるが2着3着の並びは当てられない」がまた出た。
{name:'三国3R 一般',pays:{tan:370, ni:5850, nifuku:2060, sanfuku:2960},jcd:'10',rno:3,date:'2026-09-24',result:'2-4-3',pop:43,pay:26460,wind:null,ws:1,wave:1,temp:24,wtemp:23,
 B:[
 {reg:'3641',g:'A1',nat:6.09,loc:2.00,mot:34.38,bt:32.09,st:0.17,F:0,exST:0.32,exF:null,exT:6.68,tilt:-0.5,wt:52.2,adj:0.0,entry:1,rec:[]},
 {reg:'5090',g:'B1',nat:5.16,loc:null,mot:32.03,bt:30.43,st:0.15,F:1,exST:0.18,exF:null,exT:6.68,tilt:-0.5,wt:52.9,adj:0.0,entry:2,rec:[]},
 {reg:'4675',g:'A2',nat:5.69,loc:6.60,mot:12.04,bt:34.68,st:0.14,F:0,exST:0.11,exF:null,exT:6.73,tilt:-0.5,wt:51.5,adj:0.5,entry:3,rec:[]},
 {reg:'5329',g:'B1',nat:4.54,loc:3.15,mot:37.21,bt:32.59,st:0.16,F:1,exST:0.16,exF:null,exT:6.66,tilt:-0.5,wt:51.0,adj:1.0,entry:4,rec:[]},
 {reg:'4016',g:'B1',nat:5.50,loc:5.76,mot:26.92,bt:39.69,st:0.16,F:0,exST:0.13,exF:null,exT:6.71,tilt:0.0,wt:55.0,adj:0.0,entry:5,rec:[]},
 {reg:'5453',g:'B2',nat:2.03,loc:null,mot:39.10,bt:30.30,st:null,F:0,exST:0.07,exF:null,exT:6.63,tilt:0.0,wt:52.2,adj:0.0,entry:6,rec:[]}]},
// 三国5R（2026-09-24 5日目）: A1の茅原（全国7.47/当地8.60/当地2連率90%）が
// 6枠から3コースまで前づけ。市場も6号艇を本命（51.5%）にした。
// 1・2号艇は展示でF。6号艇の展示STは .25 で最も遅い。
// 結果 6-4-2 はモデル27番目。期待値で買った4番手が 6-4-1 で、3着だけ違った。
// このレースの実オッズは、枠順の目安との順位相関が -0.21 で検算を弾いた。
// モデルの確率と突き合わせると 0.86 で通る（v16.26 で物差しを2つにした）。
{name:'三国5R 一般',jcd:'10',rno:5,date:'2026-09-24',result:'6-4-2',pop:33,pay:8750,
 pays:{tan:140, ni:1270, nifuku:1300, sanfuku:2230},
 wind:null,ws:2,wave:2,temp:24,wtemp:23,
 B:[
 {reg:'4004',g:'B1',nat:4.81,loc:5.00,mot:36.92,bt:36.43,st:0.18,F:0,exST:0.08,exF:'F',exT:6.72,tilt:0.0,wt:52.1,entry:1,rec:[]},
 {reg:'4112',g:'A2',nat:5.70,loc:5.85,mot:22.41,bt:39.34,st:0.17,F:1,exST:0.02,exF:'F',exT:6.75,tilt:-0.5,wt:53.7,entry:2,parts:'リング2',rec:[]},
 {reg:'5143',g:'B1',nat:3.92,loc:3.40,mot:34.40,bt:42.61,st:0.19,F:0,exST:0.13,exF:null,exT:6.67,tilt:-0.5,wt:53.7,entry:4,rec:[]},
 {reg:'4894',g:'B1',nat:4.64,loc:null,mot:32.80,bt:35.34,st:0.19,F:0,exST:0.13,exF:null,exT:6.71,tilt:-0.5,wt:52.0,entry:5,rec:[]},
 {reg:'5009',g:'A2',nat:5.17,loc:5.09,mot:25.00,bt:41.23,st:0.16,F:1,exST:0.08,exF:null,exT:6.75,tilt:-0.5,wt:54.7,entry:6,rec:[]},
 {reg:'4418',g:'A1',nat:7.47,loc:8.60,mot:35.51,bt:35.04,st:0.13,F:0,exST:0.25,exF:null,exT:6.67,tilt:-0.5,wt:52.7,entry:3,rec:[]}]},
{name:'三国6R 一般',jcd:'10',rno:6,date:'2026-09-24',result:'1-4-6',pop:1,pay:1300,
 wind:null,ws:3,wave:3,temp:24,wtemp:23,
 /* 進入は枠なり。展示ST 1:.06 2:.03 3:.02 4:.02 5:.03 6:.11
    モデルと市場が過去最大に食い違ったレース（1号艇で 32.3pt）。
      1号艇 谷口丞   モデル18.8% / 市場51.2%  ← 当地2.47・当地2連率6.98%・F1持ち
      2号艇 庄司孝輔 モデル25.6% / 市場 9.7%
      3号艇 伊藤啓三 モデル16.9% / 市場 7.4%
      6号艇 田中和也 モデル13.6% / 市場 5.4%  ← 当地7.88・当地3連率90.91%（A1）
    市場は「1号艇だから」で51.2%を付けている。モデルは当地成績を見て下げている。
    結果は 1-4-6（¥1,300 = 13.0倍）。市場の1番人気がそのまま来た。
    モデルはこの組を120通り中43番目に置いていた。
    なお読み取ったオッズの 1-4-6 は 13.0倍 で、払戻と完全に一致した
    （オッズの書き写しが正確だったことの裏付けになる）。
    モデルが当地成績を根拠に1号艇を大きく下げたのは外れ。
    ※ アプリ上でのモデルの1着確率は10.3%（ここでの手計算は18.8%）。
       アプリは出走表から今節成績も自動で取り込んでいるための差。 */
 B:[
 {reg:'5344',g:'B1',nat:5.34,loc:2.47,mot:27.91,bt:32.80,st:0.15,F:1,exST:0.06,exF:null,exT:6.76,tilt:-0.5,wt:52.0,entry:1,rec:[]},
 {reg:'4360',g:'A2',nat:5.54,loc:5.23,mot:32.80,bt:35.59,st:0.18,F:0,exST:0.03,exF:null,exT:6.75,tilt:-0.5,wt:53.1,entry:2,rec:[]},
 {reg:'3838',g:'B1',nat:5.40,loc:5.95,mot:37.50,bt:29.93,st:0.16,F:0,exST:0.02,exF:null,exT:6.81,tilt:-0.5,wt:52.3,entry:3,rec:[]},
 {reg:'4441',g:'A2',nat:5.81,loc:6.92,mot:29.17,bt:31.15,st:0.14,F:0,exST:0.02,exF:null,exT:6.80,tilt:-0.5,wt:52.6,entry:4,rec:[]},
 {reg:'3965',g:'A1',nat:5.86,loc:5.81,mot:29.93,bt:39.32,st:0.17,F:1,exST:0.03,exF:null,exT:6.87,tilt:-0.5,wt:52.0,entry:5,rec:[]},
 {reg:'4357',g:'A1',nat:6.71,loc:7.88,mot:37.01,bt:33.06,st:0.18,F:0,exST:0.11,exF:null,exT:6.76,tilt:-0.5,wt:52.1,entry:6,rec:[]}]},
// 三国7R: モデルは1号艇を40.9%、市場は56.3%と見ていた（−15.4pt）。
// 1号艇は3着に沈み、モデルの低い評価のほうが近かった。6Rの逆。
// ただし来たのは3号艇（モデル9.6% / 市場9.1%）で、どちらも推していない。
// 「1号艇を下げたのが当たった」だけで、当てたわけではない。
// オッズ73.0倍 → 払戻¥7,300 と完全一致。読み取りの正確さの裏付け（2例目）。
// 今節成績は出走表の右ブロックを読み切れなかったため入れていない。
{name:'三国7R 一般',jcd:'10',rno:7,date:'2026-09-24',result:'3-4-1',pop:25,pay:7300,
 wind:null,ws:3,wave:3,temp:24,wtemp:24,
 B:[
 {reg:'4210',g:'A2',nat:5.41,loc:5.95,mot:29.37,bt:35.25,st:0.17,F:0,exST:0.08,exF:null,exT:6.80,tilt:0.0,wt:52.1,entry:1,rec:[]},
 {reg:'4315',g:'B1',nat:5.23,loc:4.25,mot:26.36,bt:34.96,st:0.18,F:0,exST:0.05,exF:null,exT:6.74,tilt:-0.5,wt:52.3,entry:2,rec:[]},
 {reg:'4016',g:'B1',nat:5.50,loc:5.76,mot:26.92,bt:39.69,st:0.16,F:0,exST:0.05,exF:null,exT:6.81,tilt:-0.5,wt:55.0,entry:3,rec:[]},
 {reg:'4711',g:'A2',nat:5.94,loc:6.15,mot:28.68,bt:30.16,st:0.16,F:0,exST:0.11,exF:null,exT:6.73,tilt:-0.5,wt:52.0,entry:4,rec:[]},
 {reg:'4295',g:'A1',nat:7.53,loc:6.50,mot:31.62,bt:30.08,st:0.14,F:0,exST:0.09,exF:null,exT:6.75,tilt:-0.5,wt:52.0,entry:5,rec:[]},
 {reg:'3617',g:'B1',nat:3.63,loc:null,mot:36.43,bt:36.92,st:0.19,F:1,exST:0.09,exF:null,exT:6.78,tilt:0.0,wt:52.1,entry:6,rec:[]}]},
// 三国8R: モデルの1番手（1-2-5）がそのまま来た。検証で初めての1番目的中。
// ただし市場の1番人気でもあり、4.2倍。12点均等なら¥420 < ¥1,200 で赤字。
// 「当たったのに負ける」がいちばんはっきり出た形。
// 食い違いは2号艇（モデル37.7% / 市場18.3%）。2号艇は2着に入り、
// モデルが高く見たほうが近かった。
// 風速4mだが風向きが不明なため風の補正は発動していない（未検証のまま）。
// オッズ4.2倍 → 払戻¥420 と完全一致。読み取りの裏付け3例目。
{name:'三国8R 一般',jcd:'10',rno:8,date:'2026-09-24',result:'1-2-5',pop:1,pay:420,
 wind:null,ws:4,wave:4,temp:24,wtemp:24,
 B:[
 {reg:'5282',g:'B1',nat:5.19,loc:4.09,mot:31.85,bt:34.62,st:0.17,F:0,exST:0.05,exF:null,exT:6.83,tilt:-0.5,wt:53.0,entry:1,rec:[[3,.16,2]]},
 {reg:'4888',g:'B1',nat:6.03,loc:5.46,mot:45.45,bt:28.13,st:0.19,F:0,exST:0.04,exF:null,exT:6.81,tilt:-0.5,wt:52.1,entry:2,rec:[[5,.13,4]]},
 {reg:'5366',g:'B2',nat:1.42,loc:1.31,mot:26.40,bt:39.39,st:0.19,F:1,exST:0.00,exF:null,exT:6.88,tilt:-0.5,wt:53.7,entry:3,rec:[[6,.26,6]]},
 {reg:'5190',g:'B1',nat:4.00,loc:3.97,mot:33.59,bt:41.32,st:0.18,F:1,exST:0.11,exF:null,exT:6.86,tilt:-0.5,wt:52.0,entry:4,rec:[[3,.25,3]]},
 {reg:'5090',g:'B1',nat:5.16,loc:null,mot:32.03,bt:30.43,st:0.15,F:1,exST:0.08,exF:null,exT:6.77,tilt:-0.5,wt:52.9,entry:5,rec:[[2,.16,1]]},
 {reg:'4197',g:'B1',nat:3.66,loc:3.97,mot:25.86,bt:37.30,st:0.19,F:0,exST:0.01,exF:'F',exT:6.84,tilt:-0.5,wt:54.6,entry:6,rec:[]}]},
// 三国9R: 1号艇の逃げ。モデルも市場も1号艇が本命で、そこは両方当たり。
// 2着が5号艇（モデル4番手・市場3番手）で、組としては14番人気 ¥3,110。
// モデルはこの組を24番目に置いていた。
// オッズ31.1倍 → 払戻¥3,110、しかも人気順も公式の「14番人気」と一致。
// 組番1つではなく120個の並び全体が正しかったことの裏付け（4例目）。
//
// 展示STと本番STが大きく食い違ったレースでもある。
//   枠     1     2     3     4     5     6
//   展示  .07   .26   .08   .11   .29   .04
//   本番  .03   .11   .06   .02   .05   .01
// 展示で最も遅かった5号艇が本番.05で2着に来た。
// 展示STの重みが妥当かを測るため、ここから本番STも記録する（actualST）。
{name:'三国9R 一般',jcd:'10',rno:9,date:'2026-09-24',result:'1-5-3',pop:14,pay:3110,pays:{tan:420, ni:610, nifuku:510, sanfuku:830},
 actualST:{1:.03,2:.11,3:.06,4:.02,5:.05,6:.01},
 wind:null,ws:4,wave:4,temp:24,wtemp:24,
 B:[
 {reg:'4241',g:'A2',nat:5.71,loc:5.50,mot:31.78,bt:40.74,st:0.17,F:0,exST:0.07,exF:null,exT:6.96,tilt:-0.5,wt:52.0,entry:1,rec:[[6,.11,5]]},
 {reg:'4424',g:'A2',nat:5.50,loc:6.00,mot:19.49,bt:37.10,st:0.16,F:0,exST:0.26,exF:null,exT:6.82,tilt:-0.5,wt:52.0,entry:2,rec:[]},
 {reg:'5345',g:'B1',nat:3.42,loc:1.83,mot:19.35,bt:38.52,st:0.20,F:0,exST:0.08,exF:null,exT:6.88,tilt:0.0,wt:52.0,entry:3,rec:[]},
 {reg:'4675',g:'A2',nat:5.69,loc:6.60,mot:12.04,bt:34.68,st:0.14,F:0,exST:0.11,exF:null,exT:6.85,tilt:-0.5,wt:51.0,adj:1.0,entry:4,rec:[[3,.12,3]]},
 {reg:'4150',g:'A2',nat:5.94,loc:5.89,mot:33.07,bt:32.84,st:0.15,F:0,exST:0.29,exF:null,exT:6.81,tilt:0.0,wt:55.9,entry:5,rec:[[2,.15,3]]},
 {reg:'5465',g:'B2',nat:1.07,loc:1.11,mot:34.53,bt:33.08,st:null,F:1,exST:0.04,exF:null,exT:6.89,tilt:-0.5,wt:55.4,entry:6,rec:[[6,.25,6]]}]},
// 三国10R 準優勝戦: 1号艇の逃げ。市場が正しかった。
// モデルは4号艇（58歳A1・丸尾義孝）を28.8%、市場は9.3%。4号艇は3着。
// 1号艇はモデル44.6%・市場61.8%で、来たのは1号艇。
// 「枠より実績を取るモデル」と「枠を取る市場」の正面衝突で、市場の勝ち。
// モデルは結果の組を6番目に置いていた（12点なら当たるが4.3%・期待値0.40）。
// オッズ9.5倍 → 払戻¥950、人気順も公式の「2番人気」と一致（5例目）。
//
// 展示STと本番ST（5・6号艇は展示Fなので比較対象外）
//   枠     1     2     3     4
//   展示  .01   .11   .01   .05
//   本番  .06   .06   .04   .13
// 三国9Rでは6艇すべて本番のほうが速かったが、ここでは逆向きが3艇。
// 「展示より本番が速い」は一般則ではなさそう。1レースで決めなくてよかった。
{name:'三国10R 準優勝戦',jcd:'10',rno:10,date:'2026-09-24',result:'1-3-4',pop:2,pay:950,pays:{tan:110, ni:390, nifuku:270, sanfuku:500},
 actualST:{1:.06,2:.06,3:.04,4:.13,5:.17,6:.17},
 wind:null,ws:3,wave:3,temp:24,wtemp:24,
 B:[
 {reg:'5167',g:'B1',nat:5.38,loc:4.56,mot:29.10,bt:30.53,st:0.16,F:0,exST:0.01,exF:null,exT:6.80,tilt:-0.5,wt:52.0,entry:1,rec:[[5,.19,4]]},
 {reg:'5009',g:'A2',nat:5.17,loc:5.09,mot:25.00,bt:41.23,st:0.16,F:1,exST:0.11,exF:null,exT:6.83,tilt:-0.5,wt:54.7,entry:2,rec:[[6,.14,5]]},
 {reg:'5352',g:'B1',nat:5.40,loc:2.50,mot:23.53,bt:31.34,st:0.16,F:0,exST:0.01,exF:null,exT:6.83,tilt:-0.5,wt:53.0,entry:3,rec:[[4,.10,2]]},
 {reg:'3333',g:'A1',nat:6.56,loc:6.67,mot:35.61,bt:18.75,st:0.15,F:0,exST:0.05,exF:null,exT:6.83,tilt:-0.5,wt:52.1,entry:4,rec:[[1,.17,1]]},
 {reg:'5344',g:'B1',nat:5.34,loc:2.47,mot:27.91,bt:32.80,st:0.15,F:1,exST:0.12,exF:'F',exT:6.80,tilt:-0.5,wt:52.0,entry:5,rec:[[1,.08,1]]},
 {reg:'4004',g:'B1',nat:4.81,loc:5.00,mot:36.92,bt:36.43,st:0.18,F:0,exST:0.05,exF:'F',exT:6.81,tilt:-0.5,wt:52.1,entry:6,rec:[[1,.17,4]]}]},
// 三国11R 準優勝戦: 55番人気の大荒れ（2-5-3 ¥45,840）。まくり決着。
// オッズ458.4倍 → 払戻¥45,840、人気順も公式の「55番人気」と一致（6例目）。
//
// これまでで唯一、市場が大きく外したレース。
// 市場は1号艇（A1 田中和也・当地7.88・当地2連率63.64%）を80.6%と見ていた。
// 9レースで最も強い本命。その1号艇は4着。
// モデルは62.5%で、来た2号艇には7.4%（市場5.2%）を置いていた。
// 1着の対数スコアでは、このレースだけモデルが市場に明確に勝っている。
//
// 1・2・3号艇がそろってスタート展示でF。展示は全体に前へ行っていた。
// 本番STは 1:.24 2:.12 3:.12 4:.21 5:.17 6:.21 で、
// 1号艇が.24と最も遅く、そこを2号艇が.12でまくった。
//
// モデルの採点順は 1 → 5 → 3 → 2、実際の着順は 2 → 5 → 3 → 1。
// 上位4艇の顔ぶれは完全に一致していて、頭だけが逆だった。
{name:'三国11R 準優勝戦',jcd:'10',rno:11,date:'2026-09-24',result:'2-5-3',pop:55,pay:45840,
 pays:{tan:1050, ni:13880, nifuku:6470, sanfuku:3510},
 actualST:{1:.24,2:.12,3:.12,4:.21,5:.17,6:.21},
 wind:null,ws:2,wave:2,temp:24,wtemp:24,
 B:[
 {reg:'4357',g:'A1',nat:6.71,loc:7.88,mot:37.01,bt:33.06,st:0.18,F:0,exST:0.08,exF:'F',exT:6.78,tilt:-0.5,wt:52.1,entry:1,rec:[[6,.17,3]]},
 {reg:'3965',g:'A1',nat:5.86,loc:5.81,mot:29.93,bt:39.32,st:0.17,F:1,exST:0.04,exF:'F',exT:6.92,tilt:-0.5,wt:52.0,entry:2,rec:[[5,.14,6]]},
 {reg:'4711',g:'A2',nat:5.94,loc:6.15,mot:28.68,bt:30.16,st:0.16,F:0,exST:0.01,exF:'F',exT:6.83,tilt:-0.5,wt:52.0,entry:3,rec:[[4,.16,2]]},
 {reg:'5143',g:'B1',nat:3.92,loc:3.40,mot:34.40,bt:27.54,st:0.19,F:0,exST:0.05,exF:null,exT:6.81,tilt:-0.5,wt:53.7,entry:4,rec:[[4,.14,6]]},
 {reg:'5038',g:'A2',nat:6.57,loc:6.19,mot:41.09,bt:33.59,st:0.16,F:0,exST:0.12,exF:null,exT:6.73,tilt:-0.5,wt:52.0,parts:'リング2',entry:5,rec:[[1,.11,1]]},
 {reg:'3837',g:'A2',nat:6.40,loc:5.55,mot:30.00,bt:31.30,st:0.17,F:0,exST:0.24,exF:null,exT:6.84,tilt:-0.5,wt:52.2,entry:6,rec:[[1,.15,1]]}]},
// 三国12R 準優勝戦: 38番人気（2-3-4 ¥64,820）。まくり決着。11Rに続く波乱。
// オッズ648.2倍 → 払戻¥64,820、人気順も公式の「38番人気」と一致（7例目）。
//
// 市場は1号艇（A1 茅原悠紀・当地8.60・当地2連率90.00%）を90.9%と見ていた。
// 10レースで最も極端な本命。その1号艇は6着（最下位）。
// 来た2号艇（A1 小坂尚哉・全国7.53）にモデルは16.6%、市場は3.4%。
// 1着の対数スコアで、モデルがこのレースでも市場に大きく勝っている。
//
// 本番STは 1:.18 2:.15 3:.17 4:.15 5:.17 6:.18 でほぼ横一線。
// 展示でも1号艇と2号艇はどちらも.06で差が無かった。
// つまり「1号艇が失敗した」のではなく、単に2号艇に外から押し切られた。
// 市場の90.9%のほうが、材料に対して強すぎたということ。
//
// 5号艇 松村康太（4210）は三国7Rの1号艇、
// 2号艇 小坂尚哉（4295）は三国7Rの5号艇と同じ選手で、
// 全国・当地・モーター・ボートの数字がすべて一致した。7Rの読み取りの裏付け。
{name:'三国12R 準優勝戦',jcd:'10',rno:12,date:'2026-09-24',result:'2-3-4',pop:38,pay:64820,
 pays:{tan:550, ni:15000, nifuku:2610, sanfuku:4880},
 actualST:{1:.18,2:.15,3:.17,4:.15,5:.17,6:.18},
 wind:null,ws:4,wave:4,temp:25,wtemp:24,
 B:[
 {reg:'4418',g:'A1',nat:7.47,loc:8.60,mot:35.51,bt:35.04,st:0.13,F:0,exST:0.06,exF:null,exT:6.74,tilt:-0.5,wt:52.7,entry:1,rec:[[3,.11,1]]},
 {reg:'4295',g:'A1',nat:7.53,loc:6.50,mot:31.62,bt:30.08,st:0.14,F:0,exST:0.06,exF:null,exT:6.79,tilt:-0.5,wt:52.0,entry:2,rec:[[5,.15,4]]},
 {reg:'4441',g:'A2',nat:5.81,loc:6.92,mot:29.17,bt:31.15,st:0.14,F:0,exST:0.19,exF:null,exT:6.77,tilt:-0.5,wt:52.6,entry:3,rec:[[4,.08,2]]},
 {reg:'4363',g:'A2',nat:5.47,loc:6.25,mot:30.47,bt:25.74,st:0.17,F:0,exST:0.10,exF:null,exT:6.77,tilt:-0.5,wt:52.6,entry:4,rec:[[3,.03,3]]},
 {reg:'4210',g:'A2',nat:5.41,loc:5.95,mot:29.37,bt:35.25,st:0.17,F:0,exST:0.16,exF:null,exT:6.84,tilt:-0.5,wt:52.1,entry:5,rec:[[1,.10,3]]},
 {reg:'3641',g:'A1',nat:6.09,loc:2.00,mot:34.38,bt:32.09,st:0.17,F:0,exST:0.09,exF:null,exT:6.92,tilt:-0.5,wt:52.2,entry:6,rec:[[1,.21,4]]}]},
// 下関1R: 三国以外で実オッズを取った最初のレース。
// これまでの10レースは全部三国だったので「三国だから」と「モデルだから」が
// 分けられていなかった。ここからそれを分け始める。
// 下関の公表イン率は58%（三国は54%）。
//
// 結果は1号艇の逃げ（1-2-4 ¥1,230・3番人気）。
// モデルはこの組を120通り中2番目に置いていた。確率6.33%・期待値0.78。
// 順位としてはこれまでで最良に近いが、期待値は1.00に届かない。
// オッズ12.3倍 → 払戻¥1,230、人気順も公式の「3番人気」と一致（8例目）。
//
// 初日なので今節成績は無し（rec は全艇空）。
// 2号艇 多羅尾達之は当地の記録なし（表示の0.00は「無い」の意味なので null）。
// 5号艇 山川波乙は47.3kgで6艇中いちばん軽い。展示STも.01で最速だったが
// 本番は.26で最も遅く、5着。展示STがまた当てにならなかった例。
{name:'下関1R 予選',jcd:'19',rno:1,date:'2026-09-24',result:'1-2-4',pop:3,pay:1230,
 pays:{tan:170, ni:510, nifuku:310, sanfuku:380},
 actualST:{1:.19,2:.18,3:.19,4:.24,5:.26,6:.26},
 wind:null,ws:1,wave:1,temp:26,wtemp:26,
 B:[
 {reg:'4396',g:'B1',nat:4.68,loc:5.63,mot:38.37,bt:27.59,st:0.20,F:0,exST:0.07,exF:null,exT:6.83,tilt:-0.5,wt:52.9,entry:1,rec:[]},
 {reg:'3859',g:'B1',nat:3.99,loc:null,mot:38.82,bt:23.08,st:0.15,F:0,exST:0.18,exF:null,exT:6.86,tilt:0.0,wt:51.0,adj:1.0,entry:2,rec:[]},
 {reg:'3710',g:'B1',nat:4.60,loc:5.38,mot:34.44,bt:33.70,st:0.18,F:0,exST:0.19,exF:null,exT:6.87,tilt:0.0,wt:54.3,entry:3,rec:[]},
 {reg:'3284',g:'B1',nat:5.71,loc:5.81,mot:39.58,bt:28.26,st:0.18,F:1,exST:0.08,exF:null,exT:6.92,tilt:0.0,wt:52.4,entry:4,rec:[]},
 {reg:'5078',g:'B1',nat:4.46,loc:4.33,mot:29.70,bt:47.25,st:0.19,F:1,exST:0.01,exF:null,exT:6.87,tilt:0.0,wt:47.3,entry:5,rec:[]},
 {reg:'4750',g:'B1',nat:5.13,loc:3.91,mot:29.17,bt:27.47,st:0.16,F:1,exST:0.06,exF:null,exT:6.79,tilt:0.0,wt:52.1,entry:6,rec:[]}]},
// 徳山1R 朝トク予選（9/24）: 枠の天井バグを直したあと、
// 初めて入った徳山のレース。修正が効く場（イン率60%）での実地確認になる。
//   モデルの1号艇 77.9% / 市場 79.1% / 結果 1号艇の逃げ
// 修正前の徳山はモデル平均41.0%だった。ほぼ市場と並んだ。
//
// 期待値方式がこれまで0/10だったが、このレースで初めて的中した。
//   買った8点のうち 1-2-6（24.9倍・確率5.7%・期待値1.43）が来た
//   投資 8点×100円 = 800円 → 払戻 2,490円
// オッズ24.9倍 → 払戻¥2,490、人気順も公式の「10番人気」と一致（9例目）。
//
// 天候の読み取りで注意が要った点:
// 直前情報のスクショは17:42に撮ったもので、水面気象が「14:23現在」と出ていた。
// これは1R（締切08:40）の天候ではなく、見た時点の天候。
// レース時の値は結果画面にある 風速1m・波高1cm を採った。
// 直前情報を後から見ると、別のレースの天候を拾ってしまう。
{name:'徳山1R 朝トク予選',jcd:'18',rno:1,date:'2026-09-24',result:'1-2-6',pop:10,pay:2490,
 pays:{tan:130, ni:500, nifuku:240, sanfuku:1740},
 actualST:{1:.18,2:.15,3:.13,4:.12,5:.14,6:.22},
 wind:null,ws:1,wave:1,temp:24,wtemp:26,
 B:[
 {reg:'4159',g:'A2',nat:6.59,loc:5.36,mot:39.56,bt:28.71,st:0.17,F:0,exST:0.16,exF:null,exT:6.85,tilt:0.0,wt:52.0,entry:1,rec:[]},
 {reg:'3637',g:'B1',nat:3.58,loc:3.74,mot:30.56,bt:31.46,st:0.18,F:0,exST:0.01,exF:null,exT:6.91,tilt:-0.5,wt:52.6,entry:2,rec:[]},
 {reg:'3577',g:'B1',nat:4.36,loc:3.44,mot:24.27,bt:27.75,st:0.17,F:0,exST:0.01,exF:'F',exT:6.92,tilt:-0.5,wt:58.4,entry:3,rec:[]},
 {reg:'3808',g:'B1',nat:4.01,loc:4.16,mot:38.20,bt:29.77,st:0.17,F:0,exST:0.11,exF:null,exT:6.99,tilt:0.0,wt:57.7,entry:4,rec:[]},
 {reg:'5338',g:'B1',nat:4.58,loc:2.89,mot:36.61,bt:35.38,st:0.16,F:0,exST:0.12,exF:'F',exT:6.89,tilt:0.0,wt:52.0,entry:5,rec:[]},
 {reg:'4981',g:'B1',nat:5.24,loc:5.72,mot:20.79,bt:37.09,st:0.18,F:0,exST:0.04,exF:null,exT:6.98,tilt:-0.5,wt:52.6,entry:6,rec:[]}]},
// 下関2R: モデルが1号艇を市場より大きく高く見て、当たったレース。
//   モデルの1号艇 65.9% / 市場 47.9% / 結果 1号艇の逃げ
// 1号艇 川上聡介は全国4.33と低いがモーター18の2連率が52.27%で6艇中断然。
// 当地の記録は無い（表示の0.00は「無い」の意味なので null）。
// 市場は4号艇に22.6%を置いていたが3着。
//
// 期待値方式が2連続で的中。9点のうち 1-6-4（67.0倍・確率4.3%・期待値2.90）。
// 投資900円 → 払戻6,700円。
// オッズ67.0倍 → 払戻¥6,700、人気順も公式の「28番人気」と一致（10例目）。
{name:'下関2R 予選',jcd:'19',rno:2,date:'2026-09-24',result:'1-6-4',pop:28,pay:6700,
 pays:{tan:210, ni:2160, nifuku:2040, sanfuku:990},
 actualST:{1:.17,2:.21,3:.26,4:.19,5:.28,6:.23},
 wind:null,ws:2,wave:2,temp:27,wtemp:26,
 B:[
 {reg:'3848',g:'B1',nat:4.33,loc:null,mot:52.27,bt:29.55,st:0.15,F:0,exST:0.18,exF:null,exT:6.82,tilt:0.0,wt:56.5,entry:1,rec:[]},
 {reg:'5076',g:'B1',nat:5.04,loc:4.79,mot:27.06,bt:31.46,st:0.17,F:0,exST:0.29,exF:null,exT:6.88,tilt:-0.5,wt:54.7,entry:2,rec:[]},
 {reg:'3681',g:'B1',nat:4.89,loc:null,mot:30.49,bt:34.78,st:0.15,F:1,exST:0.21,exF:null,exT:6.73,tilt:0.0,wt:52.0,entry:3,rec:[]},
 {reg:'3692',g:'B1',nat:5.20,loc:5.14,mot:38.20,bt:32.97,st:0.18,F:0,exST:0.07,exF:null,exT:6.85,tilt:0.0,wt:52.0,entry:4,rec:[]},
 {reg:'3581',g:'B1',nat:5.45,loc:5.38,mot:27.17,bt:26.09,st:0.20,F:0,exST:0.18,exF:null,exT:6.91,tilt:0.0,wt:52.2,entry:5,rec:[]},
 {reg:'3746',g:'A2',nat:5.75,loc:5.06,mot:44.68,bt:40.45,st:0.18,F:0,exST:0.23,exF:null,exT:6.86,tilt:0.0,wt:53.1,entry:6,rec:[]}]},
// 徳山2R 狙いトク特選（9/24）: 着順が 1-2-3-4-5-6 と枠順どおりに決まった珍しいレース。
// 3連単 1-2-3 ¥620（2番人気）。オッズ6.2倍 → 払戻¥620、人気順も一致（11例目）。
//
// モデルは4号艇 堀本和也を19.1%、市場は6.7%。4号艇は4着で市場が正しかった。
// 堀本は当地8.44・当地2連率72.22%・当地3連率94.44%・平均ST0.12 と
// 紙の上では6艇で断然だった。モデルはそこを買い、市場は買わなかった。
// 「実績を取るモデル」が外れた典型例。
//   モデルの1号艇 56.4% / 市場 71.6% / 結果 1号艇の逃げ → ここも市場が正しい
//
// 期待値方式は7点買って不的中（通算 2/14）。
// 前の2レースで2連続的中していたが、続かなかった。
{name:'徳山2R 狙いトク特選',jcd:'18',rno:2,date:'2026-09-24',result:'1-2-3',pop:2,pay:620,
 pays:{tan:130, ni:350, nifuku:290, sanfuku:310},
 actualST:{1:.18,2:.15,3:.13,4:.14,5:.19,6:.17},
 wind:null,ws:1,wave:1,temp:24,wtemp:26,
 B:[
 {reg:'4163',g:'A2',nat:5.65,loc:4.72,mot:28.93,bt:28.16,st:0.16,F:0,exST:0.13,exF:null,exT:6.77,tilt:0.0,wt:52.4,entry:1,rec:[]},
 {reg:'4090',g:'B2',nat:6.08,loc:6.18,mot:20.59,bt:38.14,st:0.16,F:0,exST:0.12,exF:null,exT:6.87,tilt:0.0,wt:54.5,entry:2,rec:[]},
 {reg:'4136',g:'A1',nat:6.15,loc:null,mot:19.23,bt:35.48,st:0.17,F:0,exST:0.12,exF:null,exT:6.89,tilt:-0.5,wt:51.5,adj:0.5,entry:3,rec:[]},
 {reg:'4732',g:'A2',nat:7.09,loc:8.44,mot:41.12,bt:32.56,st:0.12,F:0,exST:0.14,exF:null,exT:6.92,tilt:0.0,wt:54.6,entry:4,rec:[]},
 {reg:'4173',g:'B1',nat:5.31,loc:4.80,mot:24.73,bt:33.33,st:0.17,F:0,exST:0.01,exF:'F',exT:6.91,tilt:0.0,wt:56.2,entry:5,rec:[]},
 {reg:'5027',g:'B1',nat:4.38,loc:5.53,mot:28.87,bt:33.33,st:0.20,F:0,exST:0.06,exF:null,exT:6.87,tilt:0.0,wt:53.2,entry:6,rec:[]}]},
// 徳山3R 決めトク特賞（9/24）: 1番人気で決着（1-3-2 ¥910）。
// オッズ9.1倍 → 払戻¥910、人気順も公式の「1番人気」と一致（12例目）。
//   モデルの1号艇 71.3% / 市場 73.9% / 結果 1号艇の逃げ。ほぼ並んだ。
//
// 展示STがまた大きく裏切ったレース。
// 1号艇 石川真二の展示STは .37 で、バンドの下限(.20)を超えていたため
// 展示STの点は 0 だった。それでも総合77.3で1番手、本番は .07 で6艇中最速。
//   枠     1     2     3     4     5     6
//   展示  .37   .22   .10   .04   .05   .02
//   本番  .07   .11   .13   .10   .06   .09
// 展示で最も遅かった艇が本番で最も速い、という形。
// 徳山1R(9/23)の .24→.05、三国9Rの .29→.05 に続いて3例目。
// 「展示で極端に遅い」は本番の遅さを意味していない可能性がある。
{name:'徳山3R 決めトク特賞',jcd:'18',rno:3,date:'2026-09-24',result:'1-3-2',pop:1,pay:910,
 pays:{tan:140, ni:290, nifuku:290, sanfuku:460},
 actualST:{1:.07,2:.11,3:.13,4:.10,5:.06,6:.09},
 wind:null,ws:1,wave:1,temp:26,wtemp:26,
 B:[
 {reg:'3473',g:'A1',nat:6.75,loc:6.75,mot:39.58,bt:37.75,st:0.14,F:1,exST:0.37,exF:null,exT:6.90,tilt:-0.5,wt:52.4,entry:1,rec:[]},
 {reg:'3519',g:'B1',nat:3.98,loc:4.86,mot:38.10,bt:25.73,st:0.16,F:1,exST:0.22,exF:null,exT:6.94,tilt:-0.5,wt:52.0,entry:2,rec:[]},
 {reg:'4663',g:'B2',nat:5.73,loc:null,mot:30.97,bt:38.14,st:0.16,F:1,exST:0.10,exF:null,exT:6.91,tilt:-0.5,wt:51.0,adj:1.0,entry:3,rec:[]},
 {reg:'5206',g:'B1',nat:4.62,loc:4.22,mot:29.47,bt:28.90,st:0.15,F:1,exST:0.04,exF:null,exT:6.86,tilt:0.0,wt:52.4,entry:4,rec:[]},
 {reg:'4839',g:'A2',nat:6.18,loc:5.32,mot:43.68,bt:30.84,st:0.15,F:0,exST:0.05,exF:null,exT:6.94,tilt:0.0,wt:52.0,entry:5,rec:[]},
 {reg:'4375',g:'A2',nat:5.75,loc:5.47,mot:22.11,bt:34.27,st:0.17,F:0,exST:0.02,exF:null,exT:6.91,tilt:0.0,wt:52.0,entry:6,rec:[]}]},
// 徳山4R ガチトク予選（9/24）: 2番人気決着（1-4-2 ¥720）。
// モデルはこの組を120通り中2番目に置いていた（確率8.17%）。
// オッズ7.2倍 → 払戻¥720、人気順も公式の「2番人気」と一致（13例目）。
//   モデルの1号艇 56.0% / 市場 71.5% / 結果 1号艇の逃げ
// 2号艇 片橋幸貴（A1）が展示でF。モデルはそれでも21.5%と高く見たが3着。
// これで徳山が10レースになり、場ごとの比較に足る数になった。
{name:'徳山4R ガチトク予選',jcd:'18',rno:4,date:'2026-09-24',result:'1-4-2',pop:2,pay:720,
 pays:{tan:130, ni:490, nifuku:520, sanfuku:190},
 actualST:{1:.13,2:.09,3:.15,4:.08,5:.11,6:.09},
 wind:null,ws:2,wave:2,temp:26,wtemp:26,
 B:[
 {reg:'4079',g:'A2',nat:5.95,loc:5.94,mot:29.11,bt:31.75,st:0.19,F:0,exST:0.15,exF:null,exT:6.83,tilt:0.0,wt:52.0,entry:1,rec:[]},
 {reg:'4677',g:'A1',nat:6.09,loc:5.82,mot:25.58,bt:29.38,st:0.15,F:0,exST:0.05,exF:'F',exT:6.88,tilt:0.0,wt:52.2,entry:2,rec:[]},
 {reg:'5124',g:'B1',nat:4.31,loc:4.76,mot:21.11,bt:35.21,st:0.17,F:0,exST:0.06,exF:null,exT:6.96,tilt:-0.5,wt:53.5,entry:3,rec:[]},
 {reg:'4158',g:'B1',nat:4.50,loc:5.33,mot:38.39,bt:32.67,st:0.16,F:0,exST:0.03,exF:null,exT:6.89,tilt:-0.5,wt:55.3,entry:4,rec:[]},
 {reg:'3772',g:'B1',nat:4.87,loc:4.95,mot:37.07,bt:32.04,st:0.16,F:0,exST:0.13,exF:null,exT:6.92,tilt:0.0,wt:53.1,entry:5,rec:[]},
 {reg:'3804',g:'B1',nat:5.03,loc:4.52,mot:30.00,bt:26.96,st:0.16,F:0,exST:0.01,exF:'F',exT:6.89,tilt:-0.5,wt:52.0,entry:6,rec:[]}]},
];

function runWith(weightPatch, bandPatch, opt){
  opt=opt||{};
  const dom=new JSDOM(opt.html||HTML,{runScripts:'dangerously',url:'https://ken5moai.github.io/',
   beforeParse(w){w.Tesseract={createWorker:async()=>({})};w.fetch=async()=>{throw new Error('x')};w.alert=()=>{}}});
  const w=dom.window,d=w.document;
  w.Element.prototype.scrollIntoView=function(){};
  const W=w.eval('W'); Object.assign(W, weightPatch||{});
  if(bandPatch) Object.assign(w.eval('BAND'), bandPatch);
  const state=w.eval('state'),newBoat=w.eval('newBoat'),setField=w.eval('setField');
  const out=[];
  for(const R of (opt.races || RACES)){
    state.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
    R.B.forEach((x,i)=>{ d.getElementById('reg'+(i+1)).value=x.reg; });
    w.syncRegsFromInputs();
    R.B.forEach((x,i)=>{
      const b=w.boatOf(i+1);
      setField(b,'name','選手'+(i+1),'official'); setField(b,'grade',x.g,'official');
      setField(b,'nationalWinRate',x.nat,'official');
      if(x.loc!=null) setField(b,'localWinRate',x.loc,'official');
      setField(b,'motor2Rate',x.mot,'official'); setField(b,'boat2Rate',x.bt,'official');
      if(x.st!=null) setField(b,'averageST',x.st,'official');
      setField(b,'exhibitionTime',x.exT,'official');
      b.exhibitionSTFlag=x.exF; setField(b,'exhibitionST',x.exST,'official');
      setField(b,'tilt',x.tilt,'official'); setField(b,'weight',x.wt,'official');
      if(x.adj!=null) setField(b,'adjustmentWeight',x.adj,'official');
      if(x.parts) b.partsChange=x.parts;
      b.flagF=x.F; b.flagL=0;
      if(x.entry) b.entryCourse = (opt.useActualEntry && R.actualEntry) ? R.actualEntry[i+1] : x.entry;
      if(x.rec && x.rec.length){
        b.recentRaces=x.rec.map(r=>({course:r[0],st:r[1],stFlag:null,result:r[2]}));
        b.recentSource='official';
      }
    });
    d.getElementById('venue').value=R.jcd; d.getElementById('raceDate').value=R.date;
    d.getElementById('raceNo').value=String(R.rno||1);
    d.getElementById('wave').value=String(R.wave); d.getElementById('windSpeed').value=String(R.ws);
    if(R.wind) d.getElementById('windDir').value=R.wind;
    if(R.temp!=null) d.getElementById('temp').value=String(R.temp);
    if(R.wtemp!=null) d.getElementById('waterTemp').value=String(R.wtemp);
    const ctx=w.scoreAll();
    const combos=w.buildProbabilities(ctx);
    const rank=combos.findIndex(c=>c.combo===R.result)+1;
    const sorted=[...state.boats].sort((a,b)=>b.score-a.score);
    const rec={name:R.name, result:R.result, pop:R.pop, pay:R.pay, pays:R.pays, rank,
               gap: Math.round((sorted[0].score-sorted[1].score)*10)/10,
               probs:combos.map(c=>c.p),
               /* probs は確率の高い順。組番と対応させるにはこちらを使う。 */
               probOf:Object.fromEntries(combos.map(c=>[c.combo,c.p]))};
    if(opt.detail){
      rec.order=[...state.boats].sort((a,b)=>b.score-a.score).map(b=>`${b.lane}(${b.score.toFixed(1)})`);
      rec.head=combos[0].combo.split('-')[0];
      rec.top3=combos.slice(0,3).map(c=>c.combo);
      rec.breakdown=state.boats.map(b=>({lane:b.lane,
        parts:b.scoreBreakdown.map(p=>`${p.label}:${Math.round(p.val)}`)}));
    }
    out.push(rec);
  }
  return out;
}

const allCombos = (()=>{ const o=[];
  for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ if(b===a) continue;
    for(let c=1;c<=6;c++){ if(c===a||c===b) continue; o.push(`${a}-${b}-${c}`); } }
  return o; })();

function summarize(res){
  const r=res.map(x=>x.rank);
  return { ranks:r, avg:r.reduce((a,c)=>a+c,0)/r.length,
           in6:r.filter(x=>x<=6).length, in12:r.filter(x=>x<=12).length,
           in20:r.filter(x=>x<=20).length, n:r.length };
}
const line=s=>`[${s.ranks.map(x=>String(x).padStart(3)).join(' ')}]  平均${s.avg.toFixed(1)}  `+
  `6点${s.in6}/${s.n} 12点${s.in12}/${s.n} 20点${s.in20}/${s.n}`;

if(require.main===module){
  /* オッズはレース名で引いている。名前が重なると別のレースのオッズを拾う。
     同じ場の同じレース番号が別の日に出てくるので、実際に起きかけた（徳山2Rが2つ）。
     気づけない種類の取り違えなので、毎回ここで止める。 */
  {
    const seen = new Map();
    for(const r of RACES) seen.set(r.name, (seen.get(r.name)||0)+1);
    const dup = [...seen].filter(([,v])=>v>1).map(([k])=>k);
    if(dup.length){
      console.error(`★ レース名が重複しています: ${dup.join(', ')}`);
      console.error('  オッズはレース名で引いているので、別のレースの数字を拾います。');
      console.error('  名前を分けてください（例「徳山2R 特選」「徳山2R 狙いトク特選」）。');
      process.exit(1);
    }
    const missing = Object.keys(ODDS).filter(k=>!RACES.some(r=>r.name===k));
    if(missing.length){
      console.error(`★ odds.js にあるのに RACES に無いレース: ${missing.join(', ')}`);
      console.error('  名前の書き間違いか、RACES への移し忘れです。');
      process.exit(1);
    }
  }
  console.log(`検証レース ${RACES.length}件\n`);
  console.log('=== 現在の重み ===');
  const base=runWith({},null,{detail:true});
  base.forEach(x=>console.log(
    `  ${x.name.padEnd(12)} 結果 ${x.result}${x.pop?`(${x.pop}番人気)`:''} は ${String(x.rank).padStart(3)} 番目`+
    `   採点順 ${x.order.join(' ')}`));
  console.log('  '+line(summarize(base))+'\n');

  console.log('=== 実績の重みを下げ、展示の重みを上げた場合 ===');
  const grid=[];
  for(const shift of [0,0.02,0.04,0.06,0.08]){
    const patch={ national:0.11-shift*0.6, local:0.08-shift*0.4,
                  exST:0.07+shift*0.5, exTime:0.08+shift*0.5 };
    const s=summarize(runWith(patch));
    grid.push({shift,...s});
    console.log(`  実績${(0.19-shift).toFixed(2)} / 展示${(0.15+shift).toFixed(2)}   `+line(s));
  }
  const best=grid.reduce((a,c)=>c.avg<a.avg?c:a);
  console.log(`\n  平均が最小なのは shift=${best.shift}（実績${(0.19-best.shift).toFixed(2)} / 展示${(0.15+best.shift).toFixed(2)}）`);
  console.log('  ※ n が少ないうちは平均が1レースで大きく動く。採用は慎重に。\n');

  console.log('=== 勝率バンドの影響（重みは既定のまま） ===');
  [[3.0,8.0],[2.5,7.5],[2.0,7.5],[1.5,7.5],[2.0,8.0]].forEach(bd=>{
    console.log(`  勝率 ${bd[0].toFixed(1)}〜${bd[1].toFixed(1)}  `+line(summarize(runWith({}, {winRate:bd}))));
  });

  console.log('\n=== 買い方ごとの回収率（1レース1,200円で統一） ===');
  console.log('  ※ 件数が少ないうちは偶然の幅が大きい。傾向を見るだけで、これで買い方を決めない。');
  const PAID = base.filter(r=>r.pay);
  const stakeTable = [];
  /* 1点・2点は予算を使い切らない。点数を絞る側の目安として並べる。 */
  for(const n of [1,2]){
    let inv=0, ret=0, hits=0;
    for(const r of PAID){ inv += 100*n;
      if(r.rank<=n){ ret += r.pay; hits++; } }
    stakeTable.push({label:`${n}点 100円ずつ`, inv, ret, hits});
  }
  /* 均等買い */
  for(const n of [3,4,6,8,10,12,15]){
    const unit = Math.floor(1200/n/100)*100;
    if(unit<100) continue;
    let inv=0, ret=0, hits=0;
    for(const r of PAID){ inv += unit*n;
      if(r.rank<=n){ ret += r.pay/100*unit; hits++; } }
    stakeTable.push({label:`${n}点 均等 ${unit}円`, inv, ret, hits});
  }
  /* 確率に応じて傾ける（100円単位、最低100円） */
  for(const n of [6,8,12]){
    let inv=0, ret=0, hits=0;
    for(const r of PAID){
      const ps = r.probs.slice(0,n), sum = ps.reduce((a,c)=>a+c,0);
      let amt = ps.map(p=>Math.max(100, Math.round(1200*p/sum/100)*100));
      /* 合計が1200円を超えたら後ろから削る */
      let total = amt.reduce((a,c)=>a+c,0);
      for(let i=n-1;i>=0 && total>1200;i--){
        while(amt[i]>100 && total>1200){ amt[i]-=100; total-=100; }
      }
      inv += total;
      if(r.rank<=n){ ret += r.pay/100*amt[r.rank-1]; hits++; }
    }
    stakeTable.push({label:`${n}点 確率比例`, inv, ret, hits});
  }
  console.log('  買い方              投資      払戻      回収率   的中');
  for(const t of stakeTable){
    console.log(`  ${t.label.padEnd(18)}${String(t.inv).padStart(7)}円${String(Math.round(t.ret)).padStart(8)}円`+
      `${(t.ret/t.inv*100).toFixed(0).padStart(8)}%   ${t.hits}/${PAID.length}`);
  }
  /* 回収率だけを見ると必ず騙される。ここまでで2回それをやりかけた。
       15レース時点で「1点買い96%」→ 19レースで76%
       12レース時点で「期待値方式21%」→ 13レースで73%
     どちらも1〜2レースが数字を作っていた。
     だから100%を超えた買い方は、必ず中身を割って見る。 */
  const over = stakeTable.filter(t=>t.ret/t.inv >= 1.0);
  if(over.length){
    console.log('\n  100%を超えた買い方の中身（1〜2レースが作っていないか）');
    for(const t of over){
      const m = t.label.match(/^(\d+)点/);
      if(!m) continue;
      const n = Number(m[1]);
      const unit = Math.max(100, Math.floor(1200/n/100)*100);
      const rows = PAID.map(r=>({ name:r.name,
        d: (r.rank<=n ? r.pay/100*unit : 0) - unit*n }));
      const tot = rows.reduce((a,c)=>a+c.d,0);
      const top = [...rows].sort((a,b)=>b.d-a.d).slice(0,2);
      const topSum = top.reduce((a,c)=>a+c.d,0);
      const restInv = (rows.length-2)*unit*n;
      const restRet = restInv + (tot - topSum);
      console.log(`    ${t.label}`);
      console.log(`      いちばん効いた2レース: `+
        top.map(x=>`${x.name} ${x.d>=0?'+':''}${x.d.toLocaleString()}円`).join(' / '));
      console.log(`      その2つを除いた残り${rows.length-2}レースの回収率 `+
        `${(restRet/restInv*100).toFixed(0)}%`);
      let win=0; const N=20000;
      for(let i=0;i<N;i++){ let t2=0;
        for(let j=0;j<rows.length;j++) t2 += rows[Math.floor(Math.random()*rows.length)].d;
        if(t2>0) win++; }
      console.log(`      引き直してプラスになる割合 ${(win/N*100).toFixed(0)}%`+
        `（50%に近いほど、ただの運）`);
    }
    console.log('    → 残りの回収率が100%を大きく下回るなら、その買い方はまだ根拠にならない。');
  }

  console.log('\n  レース別の払戻（100円あたり）');
  PAID.forEach(r=>console.log(`    ${r.name.padEnd(12)} ${r.result}  ${String(r.pay).padStart(6)}円  `+
    `${String(r.pop||'?').padStart(2)}番人気  評価${String(r.rank).padStart(3)}番目`));

  console.log('\n=== 1着だけを見た場合の成績（3連単とは別に測る） ===');
  {
    let hit=0, n=0; const lines=[];
    for(const x of base){
      const top = Number(x.order[0].split('(')[0]);
      const win = Number(x.result.split('-')[0]);
      n++; if(top===win) hit++;
      lines.push(`  ${x.name.padEnd(12)} モデル1位 ${top}号艇 / 実際の1着 ${win}号艇  ${top===win?'○':'×'}`);
    }
    lines.forEach(l=>console.log(l));
    console.log(`\n  1着の的中 ${hit}/${n}（${(hit/n*100).toFixed(0)}%）`);
    console.log('  ※ 3連単で当てるより、ここが本当の実力。買い方を考えるときの土台になる。');
  }

  console.log('\n=== 券種を変えれば勝てるのか ===');
  {
    /* 3連単120通りの確率から、他の券種の確率を足し合わせて作る。
       払戻を記録してあるレースだけで比べる。 */
    const withPay = base.filter(x=>x.pays);
    if(withPay.length){
      const all = [];
      for(let a=1;a<=6;a++) for(let b=1;b<=6;b++){ if(b===a) continue;
        for(let c=1;c<=6;c++){ if(c===a||c===b) continue; all.push(`${a}-${b}-${c}`); } }
      const TYPES = [['tan','単勝',6],['ni','2連単',30],['nifuku','2連複',15],
                     ['sanfuku','3連複',20],['san','3連単',120]];
      const keyOf = (t,a,b,c)=>
        t==='tan' ? String(a)
        : t==='ni' ? `${a}-${b}`
        : t==='nifuku' ? [a,b].sort().join('=')
        : t==='sanfuku' ? [a,b,c].sort().join('=') : `${a}-${b}-${c}`;
      const ranks = {}; TYPES.forEach(([t])=>ranks[t]=[]);
      console.log('  結果がモデルの何番目だったか\n');
      console.log('  レース          単勝  2連単 2連複 3連複 3連単');
      for(const x of withPay){
        const [ra,rb,rc] = x.result.split('-').map(Number);
        const line = [];
        for(const [t] of TYPES){
          const m = {};
          all.forEach((k,i)=>{ const [a,b,c]=k.split('-').map(Number);
            const kk = keyOf(t,a,b,c); m[kk] = (m[kk]||0) + x.probs[i]; });
          const target = keyOf(t,ra,rb,rc);
          const rk = Object.keys(m).sort((p1,p2)=>m[p2]-m[p1]).indexOf(target)+1;
          ranks[t].push(rk); line.push(String(rk).padStart(4));
        }
        console.log(`  ${x.name.padEnd(12)} ${line.join('  ')}`);
      }
      console.log('\n  予算1,200円で上位N点を均等に買った場合の回収率');
      for(const [t,name,total] of TYPES){
        const out = [];
        for(const n of [1,2,3,4,6,8,12]){
          if(n > total) break;
          const unit = Math.floor(1200/n/100)*100; if(unit < 100) continue;
          let inv=0, ret=0, hit=0;
          withPay.forEach((x,i)=>{ inv += unit*n;
            if(ranks[t][i] <= n){ ret += (t==='san'?x.pay:x.pays[t])/100*unit; hit++; } });
          out.push(`${n}点 ${String(Math.round(ret/inv*100)).padStart(4)}%(${hit}/${withPay.length})`);
        }
        console.log(`  ${name.padEnd(6)} ${out.join('  ')}`);
      }
      console.log('\n  ※ 100%を超えている数字があっても、1レースの高配当が持っていることが多い。');
      console.log('     件数が少ないうちは、ここから券種を決めないこと。');
      console.log('     単勝が一度も100%を超えないのは、1着の予想が「常に1号艇」と同成績で、');
      console.log('     しかも単勝はいちばん効率よく値付けされているから。');
    }
  }

  console.log('\n=== モデルの確率 vs 市場の確率（回収率の核心） ===');
  console.log('  市場の推定確率 = 0.75 ÷ オッズ（3連単の控除率25%を戻した値）');
  console.log('  期待値 = モデルの確率 × オッズ。1.00を超える組だけが買う価値を持つ。\n');
  console.log('  レース          結果    配当   モデル  市場   期待値');
  let evSum = 0, evN = 0, mpSum = 0, mkSum = 0;
  const evGood = [], evBad = [];
  for(const x of base.filter(r=>r.pay)){
    const odds = x.pay/100, mp = x.probs[x.rank-1], market = 0.75/odds, ev = mp*odds;
    evSum += ev; evN++; mpSum += mp; mkSum += market;
    (ev >= 1 ? evGood : evBad).push(x);
    console.log(`  ${x.name.padEnd(12)} ${x.result}  ${String(x.pay).padStart(6)}円  `+
      `${(mp*100).toFixed(1).padStart(5)}%  ${(market*100).toFixed(1).padStart(5)}%  `+
      `${ev.toFixed(2).padStart(5)}  ${ev>=1?'★':''}`);
  }
  if(evN){
    const sum = a => a.reduce((s,x)=>s+x.pay,0);
    console.log(`\n  期待値1.00以上だった的中 ${evGood.length}件  払戻合計 ${sum(evGood).toLocaleString()}円`);
    console.log(`  期待値1.00未満だった的中 ${evBad.length}件  払戻合計 ${sum(evBad).toLocaleString()}円`);
    console.log(`\n  的中した組に付いていた確率の平均   モデル ${(mpSum/evN*100).toFixed(1)}%  /  市場 ${(mkSum/evN*100).toFixed(1)}%`);
    console.log('  この2つが近ければ、モデルの確率は市場と同じくらい校正されている。');
    console.log('  モデルが大きく低ければ自信不足、大きく高ければ自信過剰ということ。');
    console.log('\n  ※ 当たった組のオッズしか分からないので、これは「当たったレースだけ」の集計。');
    console.log('     買った全点での本当の回収率は、アプリのSTEP8に払戻を入れて');
    console.log('     「期待値ごとの回収率」の表で確かめること。');
  }

  console.log('\n=== 1着の当て方を点数化する（モデル vs 市場） ===');
  console.log('  「いちばん離れた艇が来たか」は1艇しか見ていない弱い物差し。');
  console.log('  6艇ぜんぶの確率を使って、実際に来た艇にどれだけ確率を置けていたかで測る。');
  console.log('  対数スコア = ln(来た艇に置いた確率)。0に近いほど良い。');
  console.log('  枠順の平年値（1号艇55%…）を第3の比較相手として並べる。\n');
  {
    const PRIOR = {1:.55,2:.14,3:.12,4:.11,5:.06,6:.02};
    const rows = [];
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const map = ODDS[R.name];
      if(!map || Object.keys(map).length !== 120) continue;
      const ks = Object.keys(map);
      const md = {}, mk = {};
      for(let a=1;a<=6;a++){
        md[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + (x.probOf[k]||0), 0);
        mk[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + 0.75/map[k], 0);
      }
      const nm = Object.values(md).reduce((a,c)=>a+c,0);
      const nk = Object.values(mk).reduce((a,c)=>a+c,0);
      const win = Number(R.result.split('-')[0]);
      rows.push({ name:R.name, win,
                  m: md[win]/nm, k: mk[win]/nk, p: PRIOR[win],
                  top: Math.max(...Object.values(mk))/nk });
    }
    if(!rows.length){ console.log('  実オッズのあるレースがまだ無い'); }
    else {
      console.log('  レース          1着   モデル   市場    枠順のみ');
      rows.forEach(r=>console.log(`  ${r.name.padEnd(14)}${r.win}号艇  `+
        `${(r.m*100).toFixed(1).padStart(5)}%  ${(r.k*100).toFixed(1).padStart(5)}%  ${(r.p*100).toFixed(1).padStart(5)}%`));
      const ln = a => a.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0) / a.length;
      const lm = ln(rows.map(r=>r.m)), lk = ln(rows.map(r=>r.k)), lp = ln(rows.map(r=>r.p));
      console.log(`\n  対数スコア（0に近いほど良い）  モデル ${lm.toFixed(3)}  市場 ${lk.toFixed(3)}  枠順のみ ${lp.toFixed(3)}`);
      const better = rows.filter(r=>r.m > r.k).length;
      console.log(`  来た艇に市場より高い確率を置けた回数  ${better}/${rows.length}`);
      console.log(`  ${lm > lk ? 'いまのところモデルのほうが上。' : 'いまのところ市場のほうが上。'}`);

      /* 合計だけ見ると「どの1レースが効いているか」が隠れる。
         1レースで大きく勝った回が全体をひっくり返していないかを必ず確かめる。 */
      const diff = rows.map(r=>({ name:r.name, d: Math.log(Math.max(r.m,1e-6)) - Math.log(Math.max(r.k,1e-6)) }));
      console.log('\n  レースごとの「モデル − 市場」（プラスならモデルの勝ち）');
      diff.forEach(x=>console.log(`    ${x.name.padEnd(16)}${x.d>=0?'+':''}${x.d.toFixed(3)}`));
      const tot = diff.reduce((t,x)=>t+x.d,0);
      const sortedByAbs = [...diff].sort((a,b)=>Math.abs(b.d)-Math.abs(a.d));
      const top2 = sortedByAbs.slice(0,2);
      const top2sum = top2.reduce((t,x)=>t+x.d,0);
      console.log(`\n    合計 ${tot>=0?'+':''}${tot.toFixed(3)}`);
      console.log(`    いちばん大きい2レース（${top2.map(x=>x.name).join(' / ')}）だけで `+
                  `${top2sum>=0?'+':''}${top2sum.toFixed(3)}`);
      console.log(`    その2つを除いた残り${diff.length-2}レースの合計 `+
                  `${tot-top2sum>=0?'+':''}${(tot-top2sum).toFixed(3)}`);
      if(Math.abs(top2sum) > Math.abs(tot)){
        console.log('    → **勝ち負けの向きが、2レースだけで決まっている。**');
        console.log('       残りを見ると逆の結論になる。合計を信じてはいけない。');
      }

      /* 引き直し（ブートストラップ）。50%に近いほど「どちらとも言えない」。 */
      let winCount = 0; const N = 20000;
      for(let i=0;i<N;i++){
        let t = 0;
        for(let j=0;j<diff.length;j++) t += diff[Math.floor(Math.random()*diff.length)].d;
        if(t > 0) winCount++;
      }
      const pct = winCount/N*100;
      console.log(`\n    同じ${diff.length}レースを重複ありで引き直すと、モデルが勝つ割合 ${pct.toFixed(0)}%`);
      console.log('    （50%に近いほど「どちらが上とも言えない」。95%を超えて初めて差と呼べる）');

      /* 市場がどれだけ強気だったかで分けてみる。
         いまのところ、モデルが勝っているのは市場が極端に強気だった回に偏っている。 */
      const byTop = rows.map((r,i)=>({ top:r.top, d:diff[i].d })).sort((a,b)=>a.top-b.top);
      const half = Math.floor(byTop.length/2);
      const mean = a => a.length ? a.reduce((t,x)=>t+x.d,0)/a.length : NaN;
      console.log('\n  市場の1番人気の確率で半分に分けると');
      console.log(`    市場が控えめな${half}レース（〜${(byTop[half-1].top*100).toFixed(0)}%）  平均 `+
                  `${mean(byTop.slice(0,half))>=0?'+':''}${mean(byTop.slice(0,half)).toFixed(3)}`);
      console.log(`    市場が強気な${byTop.length-half}レース（${(byTop[half].top*100).toFixed(0)}%〜）  平均 `+
                  `${mean(byTop.slice(half))>=0?'+':''}${mean(byTop.slice(half)).toFixed(3)}`);
      console.log('    仮説: 市場が極端に強気なとき、モデルは言い切らないぶん得をする。');
      console.log('    まだ仮説。件数を増やして同じ向きが続くかを見る。');
    }
  }

  console.log('\n=== モデルは枠ごとに確率を付けすぎ／付けなさすぎていないか ===');
  console.log('  1着の対数スコアで市場に負けているが、どこで負けているのかは別の話。');
  console.log('  枠ごとに「モデルが平均で何%と言ったか」と「実際に何%勝ったか」を並べる。');
  console.log('  オッズの有無に関係なく全レースが使えるので、いちばん件数が多い物差し。\n');
  {
    const n = base.length;
    const said = {1:0,2:0,3:0,4:0,5:0,6:0}, won = {1:0,2:0,3:0,4:0,5:0,6:0};
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const w = Number(R.result.split('-')[0]);
      won[w]++;
      for(let a=1;a<=6;a++)
        said[a] += Object.keys(x.probOf).filter(k=>k[0]===String(a))
                         .reduce((t,k)=>t + x.probOf[k], 0);
    }
    console.log('  枠   モデルの平均   実際に勝った   差');
    for(let a=1;a<=6;a++){
      const m = said[a]/n, r = won[a]/n, d = (m-r)*100;
      console.log(`  ${a}    ${(m*100).toFixed(1).padStart(6)}%   `+
        `${(r*100).toFixed(1).padStart(6)}% (${won[a]}/${n})   ${d>=0?'+':''}${d.toFixed(1)}pt`);
    }
    /* ここでの比較相手は「この17レースの実績」ではなく、競艇場の公表イン率。
       17レースの勝率はぶれが大きすぎて、真の値の代わりにならない。
       イン率は何千レースもの集計なので、そちらのほうがはるかに確かな物差し。 */
    const m1 = said[1]/n, r1 = won[1]/n;
    const rates = [...new Set(base.map(x=>{
      const R = RACES.find(r=>r.name===x.name);
      return (typeof VENUE_IN_RATE === 'object' && VENUE_IN_RATE[R.jcd]) || null;
    }).filter(Boolean))];
    const inRate = rates.length ? rates.reduce((a,c)=>a+c,0)/rates.length/100 : 0.55;
    var binomAtLeast = (k,nn,p)=>{ let t=0;
      const C=(nn,r)=>{ let v=1; for(let i=0;i<r;i++) v=v*(nn-i)/(i+1); return v; };
      for(let i=k;i<=nn;i++) t += C(nn,i)*Math.pow(p,i)*Math.pow(1-p,nn-i); return t; };
    const pAtLeast = binomAtLeast(won[1], n, inRate);
    console.log(`\n  1号艇: モデルの平均 ${(m1*100).toFixed(1)}%  /  `+
                `この${n}レースの実績 ${(r1*100).toFixed(1)}%  /  `+
                `競艇場の公表イン率 ${(inRate*100).toFixed(0)}%`);
    console.log(`  実績${won[1]}/${n}が公表イン率から出る確率は ${(pAtLeast*100).toFixed(0)}%。`+
      (pAtLeast > 0.05
        ? ' 珍しくないので、この実績を真の値と思ってはいけない。'
        : ' さすがに偏っている。'));
    if(m1 < inRate - 0.05){
      console.log(`  **ただしモデルの${(m1*100).toFixed(1)}%は、公表イン率${(inRate*100).toFixed(0)}%も下回っている。**`);
      console.log('  イン率は何千レースもの集計なので、こちらとのズレは件数のせいにできない。');
      console.log('  モデルは1号艇を構造的に低く見ている可能性がある。');
    } else if(m1 > inRate + 0.05){
      console.log(`  モデルの${(m1*100).toFixed(1)}%は公表イン率を上回っている。`);
    } else {
      console.log('  モデルの平均は公表イン率とおおむね合っている。');
    }
    console.log('  ※ 重みをいじる前に、まず「どこまでなら重みで動くのか」を下で測る。');

    /* 競艇場ごとに分ける。全部が同じ場のデータだと
       「その場だから」なのか「モデルだから」なのかが分けられない。 */
    const byV = {};
    for(const x of base){
      const R = RACES.find(r=>r.name===x.name);
      const v = R.jcd;
      byV[v] = byV[v] || { n:0, said:0, won:0, name:(HTML.match(new RegExp(`'${v}':\\{name:'([^']+)'`))||[])[1] || v };
      byV[v].n++;
      if(Number(R.result.split('-')[0]) === 1) byV[v].won++;
      byV[v].said += Object.keys(x.probOf).filter(k=>k[0]==='1')
                           .reduce((t,k)=>t + x.probOf[k], 0);
    }
    console.log('\n  競艇場ごとの1号艇（件数が偏っていないかを必ず見る）');
    console.log('    場        件数  モデルの平均  実際に勝った  公表イン率');
    for(const [v,o] of Object.entries(byV).sort((a,b)=>b[1].n-a[1].n)){
      const ir = VENUE_IN_RATE[v];
      console.log(`    ${String(o.name).padEnd(8)}${String(o.n).padStart(3)}件  `+
        `${(o.said/o.n*100).toFixed(1).padStart(7)}%  ${(o.won/o.n*100).toFixed(1).padStart(9)}%`+
        ` (${o.won}/${o.n})  ${ir!=null?ir+'%':'?'}`);
    }
    /* 場ごとの勝率は件数が少なすぎて真の値にならない。
       比べる相手は必ず公表イン率のほう。
       場をまたいで同じ向きのズレが出るなら、それはモデルの性質。 */
    console.log('\n  公表イン率との差（モデル − 公表）。場をまたいで同じ向きか');
    let wsum = 0, wn = 0;
    for(const [v,o] of Object.entries(byV).sort((a,b)=>b[1].n-a[1].n)){
      const ir = VENUE_IN_RATE[v]; if(ir==null) continue;
      const d = (o.said/o.n - ir/100) * 100;
      const pk = binomAtLeast(o.won, o.n, ir/100);
      console.log(`    ${String(o.name).padEnd(8)}${String(o.n).padStart(3)}件  `+
        `差 ${d>=0?'+':''}${d.toFixed(1)}pt   `+
        `実績${o.won}/${o.n}が公表イン率から出る確率 ${(pk*100).toFixed(0)}%`);
      wsum += d*o.n; wn += o.n;
    }
    if(wn){
      const avg = wsum/wn;
      console.log(`    件数で重みづけした平均の差  ${avg>=0?'+':''}${avg.toFixed(1)}pt`);
      console.log(Math.abs(avg) < 6
        ? '    → 場をまたいで数pt。小さいので、これだけで重みを動かす理由にはならない。'
        : '    → 場をまたいで同じ向きに大きくズレている。重みを見直す材料になる。');
    }

    const big = Object.values(byV).sort((a,b)=>b.n-a.n)[0];
    if(big && big.n / n > 0.5){
      console.log(`    → ${big.name}だけで全体の${(big.n/n*100).toFixed(0)}%。`+
                  `いまの結論は「${big.name}での結論」でしかない。`);
      console.log('       他場のレースを足すまで、モデル全体の性質とは呼べない。');
    }
  }

  console.log('\n=== 1号艇の低さは、重みをいじれば直るのか ===');
  console.log('  「直すべきか」の前に「直せるのか」を見る。');
  console.log('  枠の重み(W.lane)と、確率の広がりを決める温度(TEMPERATURE)を動かして、');
  console.log('  モデルの1号艇平均が公表イン率に近づくか、そのとき順位の成績が落ちないかを測る。\n');
  {
    const n = base.length;
    const lane1 = res => res.reduce((t,x)=>t + Object.keys(x.probOf)
      .filter(k=>k[0]==='1').reduce((u,k)=>u + x.probOf[k], 0), 0) / res.length;
    const logScore = res => {
      const rows = [];
      for(const x of res){
        const R = RACES.find(r=>r.name===x.name);
        const map = ODDS[R.name];
        if(!map || Object.keys(map).length !== 120) continue;
        const w = Number(R.result.split('-')[0]);
        const md = Object.keys(x.probOf).filter(k=>k[0]===String(w))
                         .reduce((t,k)=>t + x.probOf[k], 0);
        rows.push(md);
      }
      return rows.length ? rows.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0)/rows.length : NaN;
    };
    const show = (label, res) => {
      const st = summarize(res);
      console.log(`  ${label.padEnd(26)}1号艇 ${(lane1(res)*100).toFixed(1).padStart(5)}%  `+
        `対数 ${logScore(res).toFixed(3)}  平均順位 ${st.avg.toFixed(1)}  12点 ${st.in12}/${st.n}`);
    };
    console.log('  設定                        モデルの1号艇  1着の対数  3連単の順位');
    show('いまのまま', base);
    /* 温度を下げると確率の差が開く（自信を強める）。枠の重みは動かさない。 */
    for(const t of [10, 9, 8, 7]){
      const patched = HTML.replace('const TEMPERATURE = 11;', `const TEMPERATURE = ${t};`);
      if(patched === HTML){ console.log('  TEMPERATUREの箇所が見つからない'); break; }
      show(`温度 ${t}（11→${t}）`, runWith({},null,{html:patched}));
    }
    /* 枠の重みを増やす。増やしたぶんは全国勝率から取る（合計を変えない）。 */
    for(const add2 of [0.04, 0.08, 0.12]){
      show(`枠の重み +${add2.toFixed(2)}`, runWith({lane:0.14+add2, national:0.11-add2}));
    }
    console.log('\n  対数スコアは市場が -0.965。ここを超えられる設定があるかを見る。');
    console.log('  ※ どれかが良く見えても、まだ変えない。17レースでは選んだ時点で');
    console.log('     その17レースに合わせただけになる。次の10レースでも同じ向きなら考える。');
  }

  console.log('\n=== 展示STは本番STを言い当てているか ===');
  console.log('  展示STは採点の中でも重い項目のひとつ。');
  console.log('  「展示で遅い艇は本番でも遅い」が本当かどうかは、両方を並べないと分からない。');
  console.log('  結果画面のスタート情報から本番STを写した回だけが対象（actualST）。\n');
  {
    const withST = RACES.filter(r=>r.actualST);
    if(!withST.length){
      console.log('  本番STを記録したレースがまだ無い。');
      console.log('  結果画面の「スタート情報」の6つの数字を actualST に写すと、ここで測れる。');
    } else {
      const pairs = [];
      for(const R of withST){
        R.B.forEach((b,i)=>{
          const a = R.actualST[i+1];
          if(b.exST==null || a==null) return;
          /* 展示でFだった艇は、本番の出方と別物なので外す */
          if(b.exF === 'F') return;
          pairs.push({race:R.name, lane:i+1, ex:b.exST, ac:a});
        });
      }
      console.log('  レース          枠   展示ST  本番ST   差');
      pairs.forEach(x=>console.log(`  ${x.race.padEnd(14)}${x.lane}   `+
        `${x.ex.toFixed(2).padStart(5)}  ${x.ac.toFixed(2).padStart(5)}  ${(x.ac-x.ex>=0?'+':'')}${(x.ac-x.ex).toFixed(2)}`));
      const n = pairs.length;
      const mean = a => a.reduce((t,v)=>t+v,0)/a.length;
      const ex = pairs.map(x=>x.ex), ac = pairs.map(x=>x.ac);
      const mx = mean(ex), my = mean(ac);
      let num=0, dx=0, dy=0;
      for(let i=0;i<n;i++){ num+=(ex[i]-mx)*(ac[i]-my); dx+=(ex[i]-mx)**2; dy+=(ac[i]-my)**2; }
      const r = (dx&&dy) ? num/Math.sqrt(dx*dy) : 0;
      console.log(`\n  ${n}艇分。展示STの平均 ${mx.toFixed(3)} / 本番STの平均 ${my.toFixed(3)}`);
      console.log(`  相関 ${r.toFixed(2)}（1に近いほど「展示が速い艇は本番も速い」）`);
      const shift = my - mx;
      const allFaster = pairs.every(x=>x.ac < x.ex);
      console.log(`  本番のほうが速い艇 ${pairs.filter(x=>x.ac<x.ex).length}/${n}`+
                  `（平均で ${shift>=0?'+':''}${shift.toFixed(3)} 秒）`);
      if(allFaster && n >= 6){
        console.log('  ※ 全艇が本番のほうが速い。展示のスタートは競っていないので');
        console.log('     押していないだけ、という説明が付く。ただし件数が要る。');
        console.log('     もしこれが続くなら、展示STは「絶対値」ではなく');
        console.log('     「そのレースの中での速い遅い」として使うほうが筋が通る。');
      }
      if(n < 30){
        console.log('  ※ 30艇分に満たないので、この相関はまだ読まないこと。');
        console.log('     符号が逆でも偶然の幅に入る。');
      } else if(r < 0.2){
        console.log('  ※ 展示STは本番STをほとんど言い当てていない。');
        console.log('     ただし「本番STを当てていない」＝「採点に役立たない」ではない。');
        console.log('     重みを下げたら成績がどうなるかを、そのまま下で測る。');
      }

      /* 相関が低いことと、重みを下げるべきことは別。
         ここを分けずに「当てていないから外そう」とやると、実際には悪くなる。
         だから相関の直後に、必ず重みを振った結果を並べる。 */
      console.log('\n  展示STの重みを下げたらどうなるか（減らしたぶんは展示タイムへ回す）');
      console.log('    設定                        1着の対数  平均順位  6点     12点');
      const W0 = 0.07, WT0 = 0.08;
      const showW = (label, patch) => {
        const r2 = runWith(patch, null, {});
        const st = summarize(r2);
        const rows2 = [];
        for(const y of r2){
          const R2 = RACES.find(q=>q.name===y.name); const m2 = ODDS[R2.name];
          if(!m2 || Object.keys(m2).length !== 120) continue;
          const w2 = Number(R2.result.split('-')[0]);
          rows2.push(Object.keys(y.probOf).filter(k=>k[0]===String(w2))
                           .reduce((t,k)=>t + y.probOf[k], 0));
        }
        const ls = rows2.reduce((t,v)=>t + Math.log(Math.max(v,1e-6)), 0)/rows2.length;
        console.log(`    ${label.padEnd(26)}${ls.toFixed(3).padStart(8)}  `+
          `${st.avg.toFixed(1).padStart(7)}  ${st.in6}/${st.n}   ${st.in12}/${st.n}`);
      };
      showW('いまのまま exST 0.07', {});
      for(const v of [0.03, 0]){
        showW(`exST ${v.toFixed(2)} / exTime ${(W0+WT0-v).toFixed(2)}`,
              { exST:v, exTime:W0+WT0-v });
      }
      console.log('    → 下げるほど悪くなるなら、相関が低くても外してはいけない。');
      console.log('       展示STは本番STそのものではなく、別の何か（気合い・');
      console.log('       仕上がり）を映している可能性がある。'); 
    }
  }

  console.log('\n=== 市場と食い違ったレースは儲かるのか ===');
  {
    const withOdds = base.filter(x=>ODDS[x.name]);
    if(withOdds.length){
      console.log('  1着の確率をモデルと市場で比べ、いちばん離れた艇の差（pt）を出す。');
      console.log('  「市場が見落としている情報をモデルが見ている」なら、差の大きいレースが儲かるはず。\n');
      console.log('  レース          最大の差  その艇  モデル  市場   実際  期待値で買った結果');
      for(const x of withOdds){
        const O = ODDS[x.name];
        const win = Number(x.result.split('-')[0]);
        let top = null;
        for(let a=1;a<=6;a++){
          const mk = Object.keys(O).filter(k=>k[0]===String(a)).reduce((s2,k)=>s2+0.75/O[k],0);
          const mp = allCombos.reduce((s2,k)=>s2 + (k[0]===String(a) ? x.probOf[k] : 0), 0);
          const d = Math.abs(mp-mk);
          if(!top || d>top.d) top = { a, d, mp, mk };
        }
        /* 期待値1.10以上・確率2%以上で買っていたら、いくらになったか */
        const picks = allCombos.map(k=>({k, p:x.probOf[k], o:O[k], ev:x.probOf[k]*O[k]}))
          .filter(c=>c.p>=0.02 && c.ev>=1.10).sort((a,b)=>b.ev-a.ev).slice(0,12);
        const hit = picks.find(c=>c.k===x.result);
        /* 1点あたりは100円単位に丸める。実際に出す金額は「丸めた単価×点数」で、
           予算1,200円ではない。以前はここで予算をまるごと使ったことにしていて、
           買っていない分まで損に数えていた（8点なら800円しか出していないのに
           1,200円払ったことになっていた）。 */
        const unit = picks.length ? Math.max(100, Math.floor(1200/picks.length/100)*100) : 0;
        const spend = unit * picks.length;
        const back = hit ? x.pay/100*unit : 0;
        console.log(`  ${x.name.padEnd(12)} ${top.d>=0 ? (top.d*100).toFixed(1).padStart(5) : ''}pt  ${top.a}号艇  `+
          `${(top.mp*100).toFixed(1).padStart(5)}% ${(top.mk*100).toFixed(1).padStart(5)}%  ${win}号艇  `+
          `${picks.length}点 ${hit?'的中':'不的中'} ${String(back-spend).padStart(6)}円`);
      }
      console.log('\n  ※ 差が大きくても、賭けているのが2着3着の並びなら当たらない。');
      console.log('     モデルが市場より正しかったレース（三国3R）でも、買った点は全部外れている。');
      {
        let inv=0, ret=0, hits=0, n=0;
        for(const x of withOdds){
          const O = ODDS[x.name];
          const picks = allCombos.map(k=>({k, p:x.probOf[k], o:O[k], ev:x.probOf[k]*O[k]}))
            .filter(c=>c.p>=0.02 && c.ev>=1.10).sort((a,b)=>b.ev-a.ev).slice(0,12);
          if(!picks.length) continue;
          n++;
          const unit = Math.max(100, Math.floor(1200/picks.length/100)*100);
          inv += unit*picks.length;
          const hit = picks.find(c=>c.k===x.result);
          if(hit){ ret += x.pay/100*unit; hits++; }
        }
        console.log(`\n  期待値方式の通算  ${n}レース  投資${inv.toLocaleString()}円  `+
          `払戻${ret.toLocaleString()}円  回収率${(ret/inv*100).toFixed(0)}%  的中${hits}/${n}`);
      }
    }
  }

  console.log('\n=== 手書き補正の点検 ===');
  console.log('  採点の重み(W)と違い、下の補正は結果から決めたものではなく手で書いた値。');
  console.log('  何件に当たっていて、外すと順位がどう動くかを毎回ここで見る。\n');
  const allB = [].concat(...RACES.map(r=>r.B.map(b=>({...b, ws:r.ws, wave:r.wave, wind:r.wind}))));
  const counts = [
    ['F持ち',            allB.filter(b=>b.F).length,       'if(b.flagF)  bump(', 'if(false)  bump('],
    ['L持ち',            allB.filter(b=>b.L).length,       null, null],
    ['展示F',            allB.filter(b=>b.exF).length,
      '  if(b.exhibitionSTFlag)\n    bump(-3,', '  if(false)\n    bump(-3,'],
    ['チルト0.5以上',      allB.filter(b=>b.tilt>=0.5).length,
      'if(crs>=4) bump(+3.0,', 'if(false) bump(+3.0,'],
    ['部品交換',          allB.filter(b=>b.parts).length,   'if(b.partsChange) bump(', 'if(false) bump('],
    ['進入変更（内へ/外へ）',
      [].concat(...RACES.map(r=>r.B.filter((b,i)=>b.entry && b.entry!==i+1))).length,
      '  if(b.entryCourse){\n    if(crs > b.lane)', '  if(false){\n    if(crs > b.lane)'],
    ['風（風速4m以上）',    allB.filter(b=>b.ws>=4 && b.wind).length, null, null],
    ['波（波高5cm以上）',   allB.filter(b=>b.wave>=5).length, null, null],
    ['潮',               0,                                null, null],
  ];
  const baseRanks = base.map(r=>r.rank);
  const fmt = r => `[${r.map(x=>String(x).padStart(3)).join(' ')}] 平均${(r.reduce((a,c)=>a+c,0)/r.length).toFixed(1)} `+
                   `12点${r.filter(x=>x<=12).length}/${r.length}`;
  console.log(`  ${'補正'.padEnd(18)}該当   外した場合`);
  console.log(`  ${'（いまのまま）'.padEnd(17)}  —   ${fmt(baseRanks)}`);
  for(const [name, n, find, repl] of counts){
    if(n === 0){
      console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  一度も発動していない（検証できない）`);
      continue;
    }
    if(!find){ console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  外し方を用意していない`); continue; }
    const patched = HTML.split(find).join(repl);
    if(patched === HTML){ console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  該当箇所が見つからない（コードが変わった？）`); continue; }
    console.log(`  ${name.padEnd(18)}${String(n).padStart(3)}件  ${fmt(runWith({},null,{html:patched}).map(r=>r.rank))}`);
  }
  console.log('\n  外したほうが平均が良くなる補正は、値が大きすぎる可能性がある。');
  console.log('  ただし12点の的中数が変わらないなら、8レース程度では偶然の幅。すぐには変えないこと。');

  console.log('\n=== 当地勝率が無い選手（初出走）の扱い ===');
  console.log('  当地の重み 0.08（既定） '+line(summarize(runWith({}))));
  [0.06,0.04,0.02].forEach(v=>{
    console.log(`  当地の重み ${v.toFixed(2)}          `+
      line(summarize(runWith({local:v, national:0.11+(0.08-v)}))));
  });

  if(PENDING.length){
    console.log('\n=== 結果まちのレース（モデルと市場の見方） ===');
    console.log('  結果が出たら pending.js から RACES へ移す。買い目を出すためのものではない。');
    const res = runWith({},null,{races:PENDING, detail:true});
    res.forEach((r,i)=>{
      const R = PENDING[i];
      const map = ODDS[R.name];
      console.log(`\n  ${R.name}`);
      console.log(`  モデルの並び  ${r.order.join(' ')}`);
      console.log(`  モデルの上位3 ${r.top3.join(' / ')}`);
      if(!map){ console.log('  実オッズが odds.js に無いので市場とは比べられない'); return; }
      const ks = Object.keys(map);
      if(ks.length !== 120){ console.log(`  オッズが${ks.length}通りしかない（120通り必要）`); return; }
      const mk = {}, md = {};
      for(let a=1;a<=6;a++){
        mk[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + 0.75/map[k], 0);
        md[a] = ks.filter(k=>k[0]===String(a)).reduce((t,k)=>t + (r.probOf[k]||0), 0);
      }
      console.log('  1着確率   ' + [1,2,3,4,5,6]
        .map(n=>`${n}号艇 モデル${(md[n]*100).toFixed(1)}% 市場${(mk[n]*100).toFixed(1)}%`).join('\n            '));
      let gap = 0, gl = 0;
      for(let n=1;n<=6;n++){ const d=Math.abs(md[n]-mk[n]); if(d>gap){ gap=d; gl=n; } }
      console.log(`  一番食い違う艇  ${gl}号艇（${((md[gl]-mk[gl])*100>0?'+':'')}${((md[gl]-mk[gl])*100).toFixed(1)}pt）`);
      const best = ks.map(k=>({k, ev:(r.probOf[k]||0)*map[k], p:r.probOf[k]||0, o:map[k]}))
                     .filter(x=>x.p >= 0.02).sort((a,b)=>b.ev-a.ev).slice(0,3);
      console.log('  期待値の上位  ' + (best.length
        ? best.map(x=>`${x.k} ${x.o}倍 期待値${x.ev.toFixed(2)}`).join(' / ')
        : '確率2%以上の組が無い'));
    });
  }
}
module.exports={RACES,runWith,summarize};
