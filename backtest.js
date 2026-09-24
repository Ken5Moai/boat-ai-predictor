// 実際に走ったレースで採点の当たり具合を測る道具。
// 重みやバンドを思いつきで変えないための検証環境。
//   使い方: node backtest.js        （index.html と同じ場所で実行）
const fs=require('fs'),path=require('path'),{JSDOM}=require('jsdom');
const HTML_PATH=path.join(__dirname,'index.html');
const HTML=fs.readFileSync(HTML_PATH,'utf8');

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
  for(const R of RACES){
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
               probs:combos.map(c=>c.p)};
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

function summarize(res){
  const r=res.map(x=>x.rank);
  return { ranks:r, avg:r.reduce((a,c)=>a+c,0)/r.length,
           in6:r.filter(x=>x<=6).length, in12:r.filter(x=>x<=12).length,
           in20:r.filter(x=>x<=20).length, n:r.length };
}
const line=s=>`[${s.ranks.map(x=>String(x).padStart(3)).join(' ')}]  平均${s.avg.toFixed(1)}  `+
  `6点${s.in6}/${s.n} 12点${s.in12}/${s.n} 20点${s.in20}/${s.n}`;

if(require.main===module){
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
}
module.exports={RACES,runWith,summarize};
