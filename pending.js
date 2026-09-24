/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
/* 下関11R 予選特選（9/24 初日・締切19:58・1800m）。枠なり進入。
   オッズは19:47更新＝締切の11分前。締切時オッズではないので preClose を付ける。
   3号艇 塩田北斗（A1）は当地8.38・当地2連率75.00%・当地3連率87.50%で断然。
   2号艇 横田貴満はモーター12の2連率が49.44%で6艇トップ。
   5号艇 川上聡介は当地の記録なし（表示の0.00は「無い」の意味なので null）。
   4号艇 大田直弥は下関1Rの1号艇、5号艇 川上聡介は下関2Rの1号艇と同じ選手。
   どちらもそのレースで勝っており、数字もすべて一致した。 */
{name:'下関11R 予選特選',jcd:'19',rno:11,date:'2026-09-24',result:null,pop:null,pay:null,
 preClose:'19:47（締切19:58）',
 wind:null,ws:3,wave:3,temp:23,wtemp:26,
 B:[
 {reg:'3963',g:'A2',nat:5.82,loc:5.32,mot:23.60,bt:39.56,st:0.17,F:0,exST:0.08,exF:null,exT:6.80,tilt:0.0,wt:52.0,entry:1,rec:[[3,.14,2]]},
 {reg:'4949',g:'A2',nat:5.98,loc:6.37,mot:49.44,bt:41.57,st:0.16,F:0,exST:0.12,exF:null,exT:6.77,tilt:0.0,wt:50.0,adj:2.0,entry:2,rec:[[4,.04,2]]},
 {reg:'4566',g:'A1',nat:6.75,loc:8.38,mot:39.76,bt:42.86,st:0.14,F:1,exST:0.05,exF:null,exT:6.84,tilt:0.0,wt:53.2,entry:3,rec:[[4,.17,4]]},
 {reg:'4396',g:'B1',nat:4.68,loc:5.63,mot:38.37,bt:27.59,st:0.20,F:0,exST:0.14,exF:null,exT:6.89,tilt:-0.5,wt:52.9,entry:4,rec:[[1,.19,1]]},
 {reg:'3848',g:'B1',nat:4.33,loc:null,mot:52.27,bt:29.55,st:0.15,F:0,exST:0.26,exF:null,exT:6.85,tilt:0.0,wt:56.5,entry:5,rec:[[1,.17,1]]},
 {reg:'5060',g:'A2',nat:5.96,loc:4.40,mot:28.26,bt:43.96,st:0.17,F:0,exST:0.08,exF:null,exT:6.83,tilt:0.0,wt:51.5,adj:0.5,entry:6,rec:[[4,.18,3]]}]},
];
