// server.js
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');
const cors = require('cors');
// url モジュールの代わりに Node.js 組み込みの URL クラスを使用
// const url = require('url'); を削除
const { Buffer } = require('buffer');

// 環境設定
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';
const ALLOWED_ORIGINS = process.env.ALLOWED_ORIGINS || '*';
const NODE_ENV = process.env.NODE_ENV || 'production';
const DEBUG = process.env.DEBUG === 'true' || false;

// CORS設定の構築
const corsOptions = (() => {
  if (ALLOWED_ORIGINS === '*') {
    return {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['WWW-Authenticate', 'Authorization'], // 認証関連ヘッダーを公開
      credentials: true
    };
  } else {
    const allowList = ALLOWED_ORIGINS.split(',').map(origin => origin.trim());
    return {
      origin: function (origin, callback) {
        if (!origin || allowList.indexOf(origin) !== -1) {
          callback(null, true);
        } else {
          callback(new Error('CORS policy violation: オリジン ' + origin + ' は許可されていません'));
        }
      },
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
      exposedHeaders: ['WWW-Authenticate', 'Authorization'], // 認証関連ヘッダーを公開
      credentials: true
    };
  }
})();

// アプリケーションの初期化
const app = express();

// ミドルウェアの設定
app.use(cors(corsOptions));

// JSONとURLエンコードされたボディの解析
// 但し、バイナリデータの場合は解析しないように設定
app.use(express.json({ 
  verify: (req, res, buf, encoding) => {
    // Content-Typeが示すように明示的なJSONの場合のみ解析
    if (req.headers['content-type'] && 
        req.headers['content-type'].includes('application/json')) {
      // 標準的なJSON解析
      return true;
    } else {
      // JSONではないデータは解析しない
      // 例えばバイナリデータやGitのパック形式などは
      // req.bodyを設定せず、生のデータのままにする
      req.rawBody = buf;
      return false;
    }
  }
}));

app.use(express.urlencoded({ 
  extended: true,
  verify: (req, res, buf, encoding) => {
    // 明示的なフォームデータの場合のみ解析
    if (req.headers['content-type'] && 
        req.headers['content-type'].includes('application/x-www-form-urlencoded')) {
      return true;
    } else {
      // それ以外のデータは解析しない
      req.rawBody = buf;
      return false;
    }
  }
}));

// CORS用のpreflight OPTIONSリクエスト処理
app.options('*', cors(corsOptions));

// ログミドルウェア
app.use((req, res, next) => {
  console.log(`[受信] ${req.method} ${req.url}`);
  console.log(`[オリジン] ${req.headers.origin || 'なし'}`);
  
  if (DEBUG) {
    console.log(`[ヘッダー] ${JSON.stringify(req.headers)}`);
    console.log(`[クエリパラメータ] ${JSON.stringify(req.query)}`);
    
    // Content-Typeとサイズを表示
    if (req.headers['content-type']) {
      console.log(`[コンテンツタイプ] ${req.headers['content-type']}`);
    }
    
    if (req.headers['content-length']) {
      console.log(`[コンテンツサイズ] ${req.headers['content-length']} バイト`);
    }
  }
  
  next();
});

// メインのプロキシルート
app.use('/:url(*)', async (req, res, next) => {
  const targetPath = req.params.url;
  
  if (!targetPath) {
    return res.status(400).send('転送先URLが指定されていません。');
  }
  
  try {
    // プロトコルを設定
    const protocol = NODE_ENV === 'development' ? 'https' : req.protocol;
    
    // クエリパラメータを含むターゲットURLを構築
    let targetUrl = `${protocol}://${targetPath}`;
    
    // 元のクエリ文字列を取得 - url.parse(req.url).query の代わりに WHATWG URL API を使用
    const reqUrl = new URL(req.url, 'http://dummy-base');
    const originalQueryString = reqUrl.search.substring(1); // '?'を除去
    
    // クエリ文字列がある場合は追加
    if (originalQueryString) {
      targetUrl = `${targetUrl}?${originalQueryString}`;
    }
    
    console.log(`[転送] ${req.method} ${req.url} -> ${targetUrl}`);
    
    // プロキシミドルウェアを作成
    const proxy = createProxyMiddleware({
      target: targetUrl,
      changeOrigin: true,
      secure: NODE_ENV !== 'development',
      
      // パスの書き換え
      pathRewrite: (path) => {
        if (DEBUG) console.log("[パス書き換え前]", path);
        // クエリパラメータを含むパス全体をログとして記録
        // url.parse(path) の代わりに WHATWG URL API を使用
        const parsedUrl = new URL(path, 'http://dummy-base');
        if (DEBUG) {
          console.log("[パス部分]", parsedUrl.pathname);
          console.log("[クエリ部分]", parsedUrl.search || '');
        }
        // パスをそのまま維持（クエリパラメータを含む）
        return '';
      },
      
      // v3ではon オブジェクトとしてイベントハンドラを定義
      on: {
        // リクエスト処理
        proxyReq: (proxyReq, req, res) => {
          // ボディがある場合、適切に転送
          if (req.body && Object.keys(req.body).length > 0) {
            // JSONやフォームデータはすでに解析されているので、それを使用
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
            proxyReq.end();
          } else if (req.rawBody) {
            // 解析されていないデータはrawBodyから直接書き込み
            proxyReq.setHeader('Content-Length', Buffer.byteLength(req.rawBody));
            proxyReq.write(req.rawBody);
            proxyReq.end();
          }
          
          // 元の送信先URLからターゲットURLを解析
          const parsedUrl = new URL(targetUrl);
          
          // ホストヘッダーを設定
          proxyReq.setHeader('host', parsedUrl.host);
          
          if (DEBUG) {
            console.log(`[プロキシリクエスト詳細]`);
            console.log(` - メソッド: ${proxyReq.method}`);
            console.log(` - ターゲットURL: ${targetUrl}`);
            console.log(` - ホスト: ${parsedUrl.host}`);
            
            if (typeof proxyReq.getHeaders === 'function') {
              console.log(` - 送信ヘッダー: ${JSON.stringify(proxyReq.getHeaders())}`);
            }
            
            if (proxyReq.path) {
              console.log(` - プロキシパス: ${proxyReq.path}`);
            }
          }
        },
        
        // レスポンス処理
        proxyRes: (proxyRes, req, res) => {
          // WWW-Authenticate ヘッダーがある場合は確実に露出させる
          if (proxyRes.headers['www-authenticate']) {
            res.setHeader('Access-Control-Expose-Headers', 'WWW-Authenticate');
          }
          
          console.log(`[プロキシレスポンス] ${proxyRes.statusCode} ${proxyRes.statusMessage}`);
          if (DEBUG) {
            console.log(` - レスポンスヘッダー: ${JSON.stringify(proxyRes.headers)}`);
          }
        },
        
        // エラー処理
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
    res.status(400).send(`無効なURL: ${targetPath} - ${err.message}`);
  }
});

// 404ハンドラー
app.use((req, res) => {
  res.status(404).send('リソースが見つかりません。');
});

// サーバー起動
app.listen(PORT, HOST, () => {
  console.log(`プロキシサーバーが起動しました: http://${HOST}:${PORT}`);
  console.log(`例: http://${HOST}:${PORT}/example.com/api/resource`);
  console.log(`CORS設定: ${ALLOWED_ORIGINS === '*' ? 'すべてのオリジンを許可' : '許可されたオリジン: ' + ALLOWED_ORIGINS}`);
  console.log(`環境: ${NODE_ENV} ${NODE_ENV === 'development' ? '(中継先サーバーへの通信は https を使用、証明書検証はスキップ)' : ''}`);
  console.log(`デバッグモード: ${DEBUG ? 'オン' : 'オフ'}`);
});
