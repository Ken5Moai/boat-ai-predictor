/* 風の補正は風速だけでは効かない（風向きが要る）ことを見えるようにする
   ------------------------------------------------------------------
   三国8Rは風速4m。「風速4m以上」の補正が初めて条件に当たるレースだった。
   ところが採点は1mの時とまったく同じだった。理由は風向きが未設定だから。
   公式サイトは風向きを矢印の画像でしか出しておらず、自動では取れない。
   黙って効かないままだと原因が分からないので、画面に出すようにした。
   その表示が出続けることをここで固定する。 */
const path=require('path');
const HTML_PATH=path.join(__dirname,'..','index.html');
const fs=require('fs'),{JSDOM}=require('jsdom');
let pass=0,fail=0;
const ok=(c,m)=>{ if(c){pass++;console.log('  ✓ '+m);} else {fail++;console.log('  ✗ FAIL: '+m);} };

const dom=new JSDOM(fs.readFileSync(HTML_PATH,'utf8'),
 {runScripts:'dangerously',url:'https://ken5moai.github.io/',
  beforeParse(w){ w.Tesseract={createWorker:async()=>({})}; w.alert=()=>{};
    w.fetch=async()=>{throw new Error('x')}; }});
const w=dom.window,d=w.document;
w.Element.prototype.scrollIntoView=function(){};

const set=(ws,wd)=>{ d.getElementById('windSpeed').value=ws; d.getElementById('windDir').value=wd;
                     w.readConditionsFromInputs(); return d.getElementById('windNotice'); };

console.log('\n風の補正の表示');
{
  const el=set('4','');
  ok(el.className.includes('warn'), '風速4m・風向き未設定なら警告が出る');
  ok(el.textContent.includes('風向きが未設定'), '何が足りないかを名指ししている');
  ok(el.textContent.includes('矢印'), '自動で取れない理由を書いている');
}
{
  const el=set('4','追い風');
  ok(!el.className.includes('warn'), '風向きを入れれば警告は消える');
  ok(el.textContent.includes('効いています'), '補正が効いていると伝える');
}
{
  const el=set('3','');
  ok(!el.className.includes('warn'), '風速3mなら風向きが無くても警告しない');
  ok(el.textContent.includes('4m未満'), '効かない理由を書いている');
}
{
  const el=set('','');
  ok(el.textContent==='', '風速が無ければ何も言わない');
}

console.log('\n採点への効き方');
{
  /* 風向きが無い間は、風速をいくつにしても採点が動かないこと。
     （動いてしまうなら、風向き無しで補正を当てているということ） */
  function state(){
    const st=w.eval('state'), newBoat=w.eval('newBoat'), setField=w.eval('setField');
    st.boats.forEach((b,i)=>Object.assign(b,newBoat(i+1)));
    [['5282',5.19],['4888',6.03],['5366',1.42],['5190',4.00],['5090',5.16],['4197',3.66]]
      .forEach(([reg,nat],i)=>{ d.getElementById('reg'+(i+1)).value=reg; });
    w.syncRegsFromInputs();
    [5.19,6.03,1.42,4.00,5.16,3.66].forEach((nat,i)=>{
      const b=w.boatOf(i+1);
      setField(b,'name','選手'+(i+1),'official'); setField(b,'grade','B1','official');
      setField(b,'nationalWinRate',nat,'official');
      setField(b,'motor2Rate',30,'official'); setField(b,'boat2Rate',35,'official');
      setField(b,'averageST',0.17,'official'); setField(b,'exhibitionTime',6.8,'official');
      setField(b,'exhibitionST',0.10,'official');
    });
    d.getElementById('venue').value='10';
  }
  const order=()=>[...w.eval('state').boats].map(b=>b.score.toFixed(2)).join(',');
  state(); d.getElementById('windSpeed').value='1'; d.getElementById('windDir').value='';
  w.readConditionsFromInputs(); w.scoreAll(); const calm=order();
  state(); d.getElementById('windSpeed').value='8'; d.getElementById('windDir').value='';
  w.readConditionsFromInputs(); w.scoreAll(); const windy=order();
  ok(calm===windy, '風向きが無ければ、風速を変えても採点は動かない');
  state(); d.getElementById('windSpeed').value='8'; d.getElementById('windDir').value='追い風';
  w.readConditionsFromInputs(); w.scoreAll(); const tail=order();
  ok(calm!==tail, '風向きを入れれば採点が動く');
}

console.log(`\n================ 結果: ${pass} 件成功 / ${fail} 件失敗 ================`);
process.exit(fail?1:0);
