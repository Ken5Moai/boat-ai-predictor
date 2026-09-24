/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
/* 下関10R 予選特賞（9/24 初日・締切19:33・1800m）。枠なり進入。
   締切直前のオッズ（19:29更新）を読み取っている。
   3号艇 正木聖賢がチルト+0.5。5号艇 上野秀和はプロペラ新調（「新」表示）。
   3号艇がスタート展示でF（F.02）。5号艇の展示STは.41と極端に遅い。
   6号艇 平野和明は当地の記録なし（表示の0.00は「無い」の意味なので null）。
   2号艇 岡瀬正人（3746）は下関2Rの6号艇、
   4号艇 井上尚悟（4750）は下関1Rの6号艇と同じ選手で、数字がすべて一致した。 */
{name:'下関10R 予選特賞',jcd:'19',rno:10,date:'2026-09-24',result:null,pop:null,pay:null,
 wind:null,ws:2,wave:2,temp:23,wtemp:26,
 B:[
 {reg:'5081',g:'A2',nat:5.67,loc:5.86,mot:30.77,bt:22.22,st:0.17,F:0,exST:0.16,exF:null,exT:6.79,tilt:0.0,wt:52.3,entry:1,rec:[]},
 {reg:'3746',g:'A2',nat:5.75,loc:5.06,mot:44.68,bt:40.45,st:0.18,F:0,exST:0.15,exF:null,exT:6.83,tilt:0.0,wt:53.1,entry:2,rec:[[6,.23,2]]},
 {reg:'3920',g:'B1',nat:4.71,loc:5.35,mot:28.87,bt:46.67,st:0.17,F:0,exST:0.02,exF:'F',exT:6.83,tilt:0.5,wt:52.5,entry:3,rec:[[2,.12,5]]},
 {reg:'4750',g:'B1',nat:5.13,loc:3.91,mot:29.17,bt:27.47,st:0.16,F:1,exST:0.01,exF:null,exT:6.79,tilt:0.0,wt:52.1,entry:4,rec:[[6,.26,4]]},
 {reg:'4180',g:'A2',nat:5.33,loc:5.08,mot:25.56,bt:35.16,st:0.17,F:0,exST:0.41,exF:null,exT:6.82,tilt:0.0,wt:54.1,parts:'プロペラ新',entry:5,rec:[[2,.13,4]]},
 {reg:'4142',g:'A2',nat:5.67,loc:null,mot:38.89,bt:22.58,st:0.18,F:0,exST:0.11,exF:null,exT:6.86,tilt:0.0,wt:53.4,entry:6,rec:[[2,.16,4]]}]},
];
