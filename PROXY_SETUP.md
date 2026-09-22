# 自分専用の取り出し口を作る（所要10分・無料）

GitHub Pagesの静的ページからBOAT RACE公式を直接読むことはブラウザの制限
（CORS）でできないため、あいだに中継役が必要です。

無料の共有中継サービスは停止・有料化が頻繁に起こります。
実際に v16 で試した8本のうち、corsproxy.io は「HTTP 401（APIキーが必要）」、
他は接続失敗でした。

自分専用の中継を1つ作ると、この問題が根本的に解消します。
Cloudflare Workers の無料枠（1日10万リクエスト）で十分です。

## 手順

1. https://dash.cloudflare.com/sign-up でアカウントを作る（無料・カード不要）
2. 左メニューの **Workers & Pages** → **Create** → **Start with Hello World!**
3. 名前を `boat-proxy` などにして **Deploy**
4. **Edit code** を押し、エディタの中身をすべて消して、下のコードを貼り付ける
5. **Deploy** を押す
6. `https://boat-proxy.＜あなたの名前＞.workers.dev` というURLが表示される
7. アプリの **STEP3 → 通信テスト → 自分専用の取り出し口** に、
   そのURLの末尾に `/?url={url}` を付けて入力する

   例: `https://boat-proxy.taro.workers.dev/?url={url}`

8. 「通信テストを実行」で **専用** の行が成功すれば完了

## 貼り付けるコード

```js
export default {
  async fetch(request) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,OPTIONS",
      "Access-Control-Allow-Headers": "*"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: cors });
    }

    const target = new URL(request.url).searchParams.get("url");
    if (!target) {
      return new Response("url parameter required", { status: 400, headers: cors });
    }

    // 取得先をBOAT RACE公式とBR-RACERSだけに限定する
    const allowed = ["www.boatrace.jp", "boatrace.jp", "br-racers.jp", "www.br-racers.jp"];
    let host;
    try {
      host = new URL(target).hostname;
    } catch {
      return new Response("invalid url", { status: 400, headers: cors });
    }
    if (!allowed.includes(host)) {
      return new Response("host not allowed", { status: 403, headers: cors });
    }

    const res = await fetch(target, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept-Language": "ja" },
      cf: { cacheTtl: 60 }
    });
    const body = await res.arrayBuffer();
    return new Response(body, {
      status: res.status,
      headers: {
        ...cors,
        "Content-Type": res.headers.get("Content-Type") || "text/html; charset=utf-8"
      }
    });
  }
};
```

## 安全性について

- 取得先を公式サイトとBR-RACERSだけに限定しているため、他のサイトの
  踏み台には使えません
- 認証情報やパスワードは一切扱いません
- 読み取り専用です（GETのみ）
- 課金は発生しません（無料枠の範囲内）

## 設定しない場合

専用の取り出し口を作らなくても、**STEP3の「公式ページをコピーして貼り付け」**
で同じことができます。通信を使わないため確実に動きます。
