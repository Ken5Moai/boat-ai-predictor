/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
/* 三国8R（9/24 5日目・締切11:50・1800m）。
   スタート展示は枠なり進入。6号艇 渥美卓郎が展示でF（F.01）。
   5号艇 生方靖亜 は当地の記録なし（表示の0.00は「無い」の意味なので null）。
   3号艇 塩嶋泰空 はB2で全国1.42・2連率2.63%。F1持ち。
   風速4m。これまでの検証13レースで一度も発動していなかった
   「風（風速4m以上）」の補正が初めて効くレースになる。
   rec は直前情報に出ている前走1本だけ（出走表の今節ブロックは読み切れない）。
   1本しか無いので今節の重みは自動的に小さくなる。 */
{name:'三国8R 一般',jcd:'10',rno:8,date:'2026-09-24',result:null,pop:null,pay:null,
 wind:null,ws:4,wave:4,temp:24,wtemp:24,
 B:[
 {reg:'5282',g:'B1',nat:5.19,loc:4.09,mot:31.85,bt:34.62,st:0.17,F:0,exST:0.05,exF:null,exT:6.83,tilt:-0.5,wt:53.0,entry:1,rec:[[3,.16,2]]},
 {reg:'4888',g:'B1',nat:6.03,loc:5.46,mot:45.45,bt:28.13,st:0.19,F:0,exST:0.04,exF:null,exT:6.81,tilt:-0.5,wt:52.1,entry:2,rec:[[5,.13,4]]},
 {reg:'5366',g:'B2',nat:1.42,loc:1.31,mot:26.40,bt:39.39,st:0.19,F:1,exST:0.00,exF:null,exT:6.88,tilt:-0.5,wt:53.7,entry:3,rec:[[6,.26,6]]},
 {reg:'5190',g:'B1',nat:4.00,loc:3.97,mot:33.59,bt:41.32,st:0.18,F:1,exST:0.11,exF:null,exT:6.86,tilt:-0.5,wt:52.0,entry:4,rec:[[3,.25,3]]},
 {reg:'5090',g:'B1',nat:5.16,loc:null,mot:32.03,bt:30.43,st:0.15,F:1,exST:0.08,exF:null,exT:6.77,tilt:-0.5,wt:52.9,entry:5,rec:[[2,.16,1]]},
 {reg:'4197',g:'B1',nat:3.66,loc:3.97,mot:25.86,bt:37.30,st:0.19,F:0,exST:0.01,exF:'F',exT:6.84,tilt:-0.5,wt:54.6,entry:6,rec:[]}]},
];
