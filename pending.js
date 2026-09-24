/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
/* 三国7R（9/24 5日目・締切11:19・1800m）。
   スタート展示は枠なり進入。
   5号艇 小坂尚哉 は全国7.53 / 2連率61.65 / 3連率83.46 と断然の実績。
   6号艇 竹田広樹 は当地の記録なし（表示の0.00は「無い」の意味なので null）。F1持ち。
   今節成績は出走表の右ブロックを読み切れなかったため入れていない。
   アプリは自動で取り込むので、アプリ上の確率とはここの数字が少しずれる。 */
{name:'三国7R 一般',jcd:'10',rno:7,date:'2026-09-24',result:null,pop:null,pay:null,
 wind:null,ws:3,wave:3,temp:24,wtemp:24,
 B:[
 {reg:'4210',g:'A2',nat:5.41,loc:5.95,mot:29.37,bt:35.25,st:0.17,F:0,exST:0.08,exF:null,exT:6.80,tilt:0.0,wt:52.1,entry:1,rec:[]},
 {reg:'4315',g:'B1',nat:5.23,loc:4.25,mot:26.36,bt:34.96,st:0.18,F:0,exST:0.05,exF:null,exT:6.74,tilt:-0.5,wt:52.3,entry:2,rec:[]},
 {reg:'4016',g:'B1',nat:5.50,loc:5.76,mot:26.92,bt:39.69,st:0.16,F:0,exST:0.05,exF:null,exT:6.81,tilt:-0.5,wt:55.0,entry:3,rec:[]},
 {reg:'4711',g:'A2',nat:5.94,loc:6.15,mot:28.68,bt:30.16,st:0.16,F:0,exST:0.11,exF:null,exT:6.73,tilt:-0.5,wt:52.0,entry:4,rec:[]},
 {reg:'4295',g:'A1',nat:7.53,loc:6.50,mot:31.62,bt:30.08,st:0.14,F:0,exST:0.09,exF:null,exT:6.75,tilt:-0.5,wt:52.0,entry:5,rec:[]},
 {reg:'3617',g:'B1',nat:3.63,loc:null,mot:36.43,bt:36.92,st:0.19,F:1,exST:0.09,exF:null,exT:6.78,tilt:0.0,wt:52.1,entry:6,rec:[]}]},
];
