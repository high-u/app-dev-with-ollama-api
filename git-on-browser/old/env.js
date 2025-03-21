/**
 * 指定された相対パスから.envファイルを取得し、オブジェクトにパースします
 * @param {string} relativePath - .envファイルへの相対パス
 * @returns {Promise<Object>} - 環境変数を含むオブジェクトを解決するPromise
 */
export const loadEnvFile = async (relativePath) => {
  try {
    // .envファイルをフェッチ
    const response = await fetch(relativePath);
    
    // フェッチが成功したかチェック
    if (!response.ok) {
      throw new Error(`.envファイルの読み込みに失敗しました: ${response.status} ${response.statusText}`);
    }
    
    // ファイルのテキスト内容を取得
    const text = await response.text();
    
    // .envファイルの内容をオブジェクトにパース
    const envObject = {};
    
    // テキストを改行で分割し、各行を処理
    text.split('\n').forEach(line => {
      // 空行やコメントをスキップ
      if (!line || line.startsWith('#')) return;
      
      // 各行を最初の等号で分割
      const separatorIndex = line.indexOf('=');
      if (separatorIndex !== -1) {
        const key = line.substring(0, separatorIndex).trim();
        let value = line.substring(separatorIndex + 1).trim();
        
        // 引用符がある場合は削除
        if ((value.startsWith('"') && value.endsWith('"')) || 
            (value.startsWith("'") && value.endsWith("'"))) {
          value = value.substring(1, value.length - 1);
        }
        
        envObject[key] = value;
      }
    });
    
    return envObject;
  } catch (error) {
    console.error('.envファイルの読み込み中にエラーが発生しました:', error);
    throw error;
  }
};

// 使用例:
// loadEnvFile('./path/to/.env').then(env => console.log(env));
