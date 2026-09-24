/* 「外にA級なし」で選んだレースの成績。
   ------------------------------------------------------------------
   screen.js が選んだレースを、結果が出たらここに足していく。

   採点に使った情報が2種類あるので分けて持つ。
     info:'full'  … 直前情報（展示タイム・展示ST・チルト）まで入れて採点
     info:'card'  … 出走予定表だけで採点（前夜の状態）
   同じ「6点で何番目か」でも意味が違うので、混ぜるときは必ず断る。

   採用の判定は node screen.js の末尾に出る。
   20レースそろった時点で3条件すべてを満たせば採用、1つでも欠ければ捨てる。 */
module.exports = [
 {name:'三国1R 一般',        date:'2026-09-24', pay:510,  rank:3,  info:'full'},
 {name:'三国8R 一般',        date:'2026-09-24', pay:420,  rank:1,  info:'full'},
 {name:'徳山1R 一般',        date:'2026-09-23', pay:790,  rank:4,  info:'full'},
 {name:'徳山4R 予選',        date:'2026-09-23', pay:890,  rank:2,  info:'full'},
 {name:'徳山1R 朝トク予選',    date:'2026-09-24', pay:2490, rank:6,  info:'full'},
 {name:'徳山4R ガチトク予選',  date:'2026-09-24', pay:720,  rank:2,  info:'full'},
 {name:'下関1R 予選',        date:'2026-09-24', pay:1230, rank:2,  info:'full'},
 /* ここから screen.js で前夜に選んだぶん */
 {name:'桐生6R 一般',        date:'2026-09-24', pay:2880, rank:17, info:'card', pop:9},
 {name:'桐生12R 一般特賞',    date:'2026-09-24', pay:860,  rank:1,  info:'card', pop:1}
];
