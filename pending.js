/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
{name:'若松11R 予選特選(10/23)',jcd:'20',rno:11,date:'2026-10-23',result:null,pop:null,pay:null,
 wind:null,ws:6,wave:6,temp:19,wtemp:22,
 /* 直前情報22:08の表示。チルトと調整重量はこの画面に出ていないので入れていない。
    今節成績の「進入コース」もこの画面には無い。艇番色から枠番は分かるので、
    枠なりだったと見なして rec のコースに枠番を入れている。ここだけ推測が入る。 */
 B:[
 {reg:'4036',g:'A1',nat:6.32,loc:6.33,mot:35.91,bt:28.26,st:0.16,F:0,exST:0.05,exF:null,exT:6.99,tilt:null,wt:52.0,entry:1,rec:[[5,.23,4],[3,.12,4],[4,.04,1],[2,.22,1]]},
 {reg:'4803',g:'B1',nat:3.92,loc:2.50,mot:30.88,bt:47.78,st:0.19,F:0,exST:0.02,exF:null,exT:6.89,tilt:null,wt:57.1,entry:2,rec:[[3,.09,3],[5,.33,4],[6,.26,6],[1,.14,2]]},
 {reg:'4771',g:'A1',nat:6.83,loc:7.13,mot:38.24,bt:34.15,st:0.16,F:0,exST:0.03,exF:'F', exT:6.96,tilt:null,wt:54.1,entry:3,rec:[[4,.16,1],[6,.11,5],[2,.23,3],[1,.15,1]]},
 {reg:'5177',g:'B1',nat:4.68,loc:4.96,mot:38.50,bt:31.76,st:0.20,F:0,exST:0.01,exF:'F', exT:6.95,tilt:null,wt:51.5,entry:4,rec:[[2,.21,6],[4,.33,3],[3,.15,3],[5,.24,4]]},
 {reg:'4394',g:'A2',nat:6.13,loc:5.49,mot:30.77,bt:22.89,st:0.15,F:0,exST:0.04,exF:'F', exT:7.10,tilt:null,wt:54.0,entry:5,rec:[[4,.25,2],[1,.11,2],[3,.24,4],[2,.09,5]]},
 {reg:'4572',g:'B1',nat:5.03,loc:6.86,mot:35.48,bt:37.21,st:0.16,F:0,exST:0.12,exF:null,exT:7.09,tilt:null,wt:56.2,entry:6,rec:[[1,.14,1],[5,.20,3],[2,.19,2],[3,.17,1]]}]},
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
