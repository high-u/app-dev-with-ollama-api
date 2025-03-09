# README

## NOTE

- Google OAuth2 の例
- Claude Desktop でのプロンプト
    - `oidc-client-ts` を使用して、Google の OAuth2 の機能を実装してください。 index.html のみで実装し、ブラウザで動く javascript のウェブアプリケーションとしてください。UI 系のライブラリは使用しないでください。 ライブラリは、別途、 `npm i oidc-client-ts` でインストールします。
    `script` タグは、 `type="module"` として、import できるように実装してください。
- `oidc-client-ts`の最新バージョンは `3.1.0` だけど、生成されたソースコードでは、 `2.2.1` 。ま、これは仕方ない。どこかでバージョンアップする。
- Google Cloud
    - https://console.cloud.google.com/auth/clients?authuser=1&hl=ja&inv=1&invt=AbrjCQ&project=devui-453206&supportedpurview=project
    - 『承認済みの JavaScript 生成元』と『承認済みのリダイレクト URI』に、下記で発行されたドメインを割り当てる。
        - 例
            - 承認済みの JavaScript 生成元
                - https://6a692009199701.lhr.life
            - 承認済みのリダイレクト URI
                - https://6a692009199701.lhr.life/redirect/
- localhost.run でローカルサーバー（ポート）を公開
    - 以前は不要だった気がするが、https://admin.localhost.run でメールアドレスの登録と、公開鍵の登録が必要になっていた。
        - Google のログインもあるがうまくいかず、メールアドレスの登録にした。
        - ~/.ssh/id_rsa.pub の内容を登録。
    - npx serve で http://localhost:3000 でウェブサーバーを立ち上げた後
        - `ssh -R 80:localhost:3000 localhost.run` を実行。
        - `https://6a692009199701.lhr.life` のような URL でローカルのポート 3000 が公開される
    - ちょっと面倒にはなったが、相変わらず便利。セキュアになったのかな？
    - cloudflare tunnel を使えば良いだけなのだが。
        - `brew upgrade cloudflared` or `brew install cloudflared`
        - `cloudflared tunnel --url localhost:3000`
        - 下記のように `https://dining-bunny-regardless-looked.trycloudflare.com` のような URL で localhost:3000 が公開される

```
2025-03-09T08:32:30Z INF +--------------------------------------------------------------------------------------------+
2025-03-09T08:32:30Z INF |  Your quick Tunnel has been created! Visit it at (it may take some time to be reachable):  |
2025-03-09T08:32:30Z INF |  https://dining-bunny-regardless-looked.trycloudflare.com                                  |
2025-03-09T08:32:30Z INF +--------------------------------------------------------------------------------------------+
```
