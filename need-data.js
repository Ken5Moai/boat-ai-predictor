/* data/（非公開リポジトリ boat-ai-data）があるか確かめる
   ==================================================================
   レース記録とオッズは別のリポジトリに分けてある。
   公開リポジトリ側から取り込んだ内容を外すためで、理由は data/README.md にある。

   data/ が無いと backtest.js もテストも動かない。
   このコンテナは使い捨てなので、セッションを張り直すたびに data/ は消える。
   そのとき「レース0件」のまま走って、おかしな数字が出るのがいちばん怖い。
   読み込む側の先頭でこれを呼び、無ければ理由と直し方を出して止める。 */
const fs=require('fs'), path=require('path');

module.exports = function needData(root){
  const dir = path.join(root || __dirname, 'data');
  const must = ['races.js','odds.js','odds-live.js','pending.js'];
  const missing = must.filter(f=>!fs.existsSync(path.join(dir,f)));
  if(!missing.length) return dir;

  const lines = [
    '',
    '  ✗ data/ がありません（足りないもの: '+missing.join(' / ')+'）',
    '',
    '    レース記録とオッズは boat-ai-data（非公開）に分けてあります。',
    '    公開リポジトリに取り込んだ内容を置かないためです。',
    '',
    '    取ってくる:',
    '      git clone https://github.com/Ken5Moai/boat-ai-data data',
    '',
    '    このコンテナは使い捨てなので、セッションを張り直すたびに必要です。',
    '    （データが無いまま走らせると「0レース」で計算して、',
    '      もっともらしい間違った数字が出ます。だからここで止めます）',
    '',
  ];
  console.error(lines.join('\n'));
  process.exit(1);
};
