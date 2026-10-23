/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
{name:'若松12R 一般特選(10/23)',jcd:'20',rno:12,date:'2026-10-23',result:null,pop:null,pay:null,
 weatherFrom:'若松11Rの直前情報22:08の表示（12Rの直前情報をもらっていない）',
 wind:null,ws:6,wave:6,temp:19,wtemp:22,
 /* 直前情報をもらっていないので、展示タイム・展示ST・チルト・調整重量は入っていない。
    採点はその分を項目ごと外して重みを配り直す。展示が入っている回より精度は落ちる。
    今節成績の進入コースもスマホ画面には無いので、艇番色から枠番を取り、
    枠なりだったと見なしている。ここは推測。 */
 B:[
 {reg:'4193',g:'A2',nat:6.15,loc:5.81,mot:34.27,bt:39.53,st:0.15,F:0,exST:null,exF:null,exT:null,tilt:null,wt:52.0,entry:1,rec:[[4,.11,1],[1,.11,1],[6,.15,3],[2,.14,2]]},
 {reg:'4458',g:'B1',nat:5.45,loc:5.18,mot:26.32,bt:34.48,st:0.15,F:0,exST:null,exF:null,exT:null,tilt:null,wt:53.0,entry:2,rec:[[3,.12,3],[6,.18,3],[1,.01,6],[4,.19,5]]},
 {reg:'4809',g:'A1',nat:5.61,loc:6.76,mot:37.56,bt:35.16,st:0.16,F:0,exST:null,exF:null,exT:null,tilt:null,wt:52.0,entry:3,rec:[[2,.13,1],[1,.21,4],[4,.25,3],[5,.18,1]]},
 {reg:'3853',g:'A2',nat:5.89,loc:5.91,mot:39.42,bt:35.56,st:0.20,F:0,exST:null,exF:null,exT:null,tilt:null,wt:52.1,entry:4,rec:[[6,.27,3],[2,.11,2],[1,.06,3],[3,.31,3]]},
 {reg:'5007',g:'B1',nat:4.57,loc:3.38,mot:28.57,bt:34.18,st:0.18,F:1,exST:null,exF:null,exT:null,tilt:null,wt:53.4,entry:5,rec:[[2,.18,5],[3,.12,5],[5,.14,6],[4,.11,3]]},
 {reg:'4887',g:'B1',nat:5.05,loc:0.00,mot:36.32,bt:40.23,st:0.13,F:1,exST:null,exF:null,exT:null,tilt:null,wt:53.8,entry:6,rec:[[2,.16,1],[5,.12,4],[3,.03,4],[4,.23,3]]}]},
{name:'三国8R 一般(9/25)',jcd:'10',rno:8,date:'2026-09-25',result:null,pop:null,pay:null,wind:null,ws:5,wave:5,temp:23,wtemp:24,
 /* 名前に日付を入れてあるのは、9/24にも「三国8R 一般」があるため。
    odds.js はオブジェクトなので、同じ名前で足すと古いほうが黙って消える。
    風向きは矢印の画像なので読み取れない。風速5mで効くはずだが、推測では入れない。
    全国勝率・当地勝率は公式の出走表から取った。card.js の値とは食い違っている（README参照）。 */
 B:[
 {reg:'4424',g:'A2',nat:5.50,loc:6.00,mot:19.49,bt:37.10,st:0.16,F:0,exST:0.04,exF:null,exT:6.84,tilt:-0.5,wt:52.0},
 {reg:'5329',g:'B1',nat:4.54,loc:3.15,mot:37.21,bt:32.59,st:0.16,F:1,exST:0.15,exF:null,exT:6.87,tilt:-0.5,wt:51.0},
 {reg:'4315',g:'B1',nat:5.23,loc:4.25,mot:26.36,bt:34.66,st:0.18,F:0,exST:0.23,exF:null,exT:6.89,tilt:-0.5,wt:52.7},
 {reg:'5345',g:'B1',nat:3.42,loc:1.83,mot:19.35,bt:38.52,st:0.20,F:0,exST:0.02,exF:'F', exT:6.91,tilt: 0.0,wt:52.1},
 {reg:'4210',g:'A2',nat:5.41,loc:5.95,mot:29.37,bt:22.86,st:0.17,F:0,exST:0.02,exF:'F', exT:6.92,tilt:-0.5,wt:52.0},
 {reg:'4112',g:'A2',nat:5.70,loc:5.85,mot:22.41,bt:39.34,st:0.17,F:1,exST:0.10,exF:'F', exT:6.86,tilt: 0.0,wt:53.3}]}
];
