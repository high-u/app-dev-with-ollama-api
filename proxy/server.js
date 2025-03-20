// server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');

// Express 5では多くの非推奨APIが削除されたため、process.noDeprecationは使用しない
// 代わりに必要に応じて個別にハンドリングする

// 環境設定
// .env を使う代わりに process.env から直接読み込む
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*'; // '*' または 'domain1.com,domain2.com' のようなカンマ区切りの文字列
const NODE_ENV = process.env.NODE_ENV || 'production';

// CORS設定の構築
const corsOptions = (() => {
  if (ALLOWED_ORIGINS === '*') {
    // すべてのオリジンを許可
    return {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true
    };
  } else {
    // 特定のオリジンのみを許可
    const allowList = ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    return {
      origin: function (origin, callback) {
        // オリジンがない場合（サーバー間リクエストなど）も許可
        if (!origin || allowList.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy violation: オリジン ' + origin + ' は許可されていません'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      credentials: true
    };
  }
})();

// アプリケーションの初期化
const app = express();

// ミドルウェアの設定
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS用のpreflight OPTIONSリクエスト処理
app.options('*', cors(corsOptions));

// ログミドルウェア
app.use((req, res, next) => {
  console.log(`[受信] ${req.method} ${req.url}`);
  console.log(`[オリジン] ${req.headers.origin || 'なし'}`);
  next();
});

// メインのプロキシルート
app.use('/:url(*)', async (req, res, next) => {
  const url = req.params.url;
  
  if (!url) {
    return res.status(400).send('転送先URLが指定されていません。');
  }
  
  try {
    // プロトコルを設定
    // NODE_ENV が development の場合は、常に https を使用
    const protocol = NODE_ENV === 'development' ? 'https' : req.protocol;
    const targetUrl = `${protocol}://${url}`;
    
    console.log(`[転送] ${req.method} ${req.url} -> ${targetUrl}`);
    
    // プロキシルートごとにプロキシミドルウェアを動的に作成
    const proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      secure: NODE_ENV !== 'development', // 開発環境の場合は証明書検証をスキップ
      // http-proxy-middleware v3では、pathRewrite関数は同じAPIだが、オブジェクト形式のpathRewriteは削除された
      pathRewrite: (path) => {
        // パスを書き換えない（すでにURLに含まれているため）
        return '';
      },
      // v3ではイベントリスナー形式をサポート
      on: {
        proxyReq: (proxyReq, req, res) => {
          // 必要に応じてヘッダーを変更
          const parsedUrl = new URL(targetUrl);
          proxyReq.setHeader('host', parsedUrl.host);
          
          console.log(`[プロキシリクエスト] ${req.method} ${targetUrl} (ホスト: ${parsedUrl.host})`);
        },
        proxyRes: (proxyRes, req, res) => {
          console.log(`[プロキシレスポンス] ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
        },
        error: (err, req, res) => {
          console.error(`[エラー] ${err.message}`);
          if (!res.headersSent) {
            res.status(500).send(`プロキシエラー: ${err.message}`);
          }
        }
      }
    });
    
    // このリクエストに対してプロキシを適用
    return proxy(req, res, next);
    
  } catch (err) {
    console.error(`[エラー] URL解析エラー: ${err.message}`);
    res.status(400).send(`無効なURL: ${url} - ${err.message}`);
  }
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).send('リソースが見つかりません。');
});

// サーバー起動
app.listen(PORT, HOST, () => {
  console.log(`プロキシサーバーが起動しました: http://${HOST}:${PORT}`);
  console.log(`例: http://${HOST}:${PORT}/localhost:3003/api/resource`);
  console.log(`CORS設定: ${ALLOWED_ORIGINS === '*' ? 'すべてのオリジンを許可' : '許可されたオリジン: ' + ALLOWED_ORIGINS}`);
  console.log(`環境: ${NODE_ENV} ${NODE_ENV === 'development' ? '(中継先サーバーへの通信は https を使用、証明書検証はスキップ)' : ''}`);
});
