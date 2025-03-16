# README

## 備考

`oidc-client-ts` などライブラリを使っての実装をはじめは行ったが、動くものの、指定しないと古いバージョンを使ったり、存在しないオプションなどを使うなど、制御が面倒だった。
なので、ゼロからの実装を Claude 3.7 Sonnet に依頼した。

## 動作確認

### index.html をホスティング

```bash
npx http-server-spa . index.html 12345
```

`http-server-spa` を使う理由は、URL で `/` 以外が入って来てもすべて `/` にルーティングするため。

### グローバルに公開

```bash
cloudflared tunnel --url localhost:12345
```

や

```bash
ssh -R 80:localhost:3000 localhost.run
```

- localhost.run でローカルサーバー（ポート）を公開
    - 以前は不要だった気がするが、https://admin.localhost.run でメールアドレスの登録と、公開鍵の登録が必要になっていた。
        - Google のログインもあるがうまくいかず、メールアドレスの登録にした。
        - ~/.ssh/id_rsa.pub の内容を登録。

### [Google Cloud コンソール](https://console.developers.google.com/?hl=ja)

- ウェブアプリケーションのクライアントのクライアント ID とクライアントシークレットをフロントエンドアプリケーションに反映
