/* 結果待ちのレース。結果が分かったら backtest.js の RACES に移す。
   スクショから読み取った内容を失わないための置き場。
   node backtest.js を走らせると、末尾にモデルと市場の見方の差が出る。 */
module.exports = [
{name:'大村12R 発祥地選抜',jcd:'24',rno:12,date:'2026-10-22',result:null,pop:null,pay:null,
 preClose:'20:31（締切20:45）',wind:null,ws:3,wave:2,temp:20,wtemp:24,
 /* 2026-10-08に書いた「枠の重み+0.12」の判定に入る1件目。
    モデルの1号艇40%に対し市場61%で、差は21ポイント。
    大村の公表イン率は62%なので、市場のほうが場の平均どおりに見ている。 */
 B:[
 {reg:'3946',g:'A1',nat:7.41,loc:5.55,mot:27.38,bt:36.59,st:0.15,F:1,exST:0.06,exF:null,exT:6.83,tilt:-0.5,wt:56.3,entry:1,rec:[[2,.18,2]]},
 {reg:'3257',g:'A1',nat:6.93,loc:6.48,mot:29.27,bt:38.27,st:0.13,F:1,exST:0.10,exF:null,exT:6.87,tilt:-0.5,wt:51.0,adj:1.0,entry:2,rec:[[2,.28,2]]},
 {reg:'4397',g:'A1',nat:7.44,loc:8.30,mot:26.14,bt:39.02,st:0.13,F:0,exST:0.08,exF:null,exT:6.77,tilt: 0.0,wt:52.0,parts:'キャブ',entry:3,rec:[[1,.14,1]]},
 {reg:'4290',g:'A1',nat:6.91,loc:7.64,mot:38.30,bt:29.63,st:0.12,F:0,exST:0.08,exF:null,exT:6.88,tilt: 0.0,wt:52.0,entry:4,rec:[[2,.04,2]]},
 {reg:'4798',g:'A1',nat:6.91,loc:4.81,mot:28.57,bt:30.12,st:0.13,F:0,exST:0.13,exF:null,exT:6.79,tilt: 0.0,wt:52.9,entry:5,rec:[[3,.12,1]]},
 {reg:'4530',g:'A1',nat:7.28,loc:6.38,mot:39.78,bt:40.74,st:0.15,F:0,exST:0.04,exF:null,exT:6.80,tilt: 0.0,wt:46.5,adj:0.5,entry:6,rec:[[2,.10,4]]}]},
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
