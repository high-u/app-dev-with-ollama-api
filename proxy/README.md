# README

## 実行

1. `destination/README.md` に従い json-server を起動する。
1. この README のディレクトリで、 `npm run dev` を実行する。
    - `npm i` を実行済みの前提

## 試す

```bash
curl http://localhost:3002/localhost:8443/posts/1
```

## このプロキシサーバーの機能

- `https://hoge.com/fuga.net/posts/1` を受信したら、 `https://fuga.net/posts/1` にリクエストする。
- 開発時（環境変数 NODE_ENV が `development` の場合）
    - `http://localhost:3002/localhost:8443/posts/1` （http プロトコル）を受信したら、 `https://localhost:8443/posts/1` （https プロトコル）にリクエストする。

## ノート

この中継サーバーの前に、SSL 対応のリバースプロキシサーバーを置いて、このサーバーは、docker network 内で http で呼び出されるようにするか？
いや、いまは単独で SSL にも対応するサーバーにする方針とする。
