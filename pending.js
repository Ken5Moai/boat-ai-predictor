/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
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
