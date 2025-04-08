/**
 * JSONデータをマークダウンテーブルに変換する関数
 * @param {Array} data - 変換する配列データ
 * @param {Object} options - 変換オプション
 * @param {Array} options.includeFields - 表示するフィールド (省略時は全フィールド)
 * @param {Array} options.excludeFields - 除外するフィールド
 * @param {Object} options.fieldTitles - フィールド名の表示名マッピング
 * @param {boolean} options.flattenNested - ネストされたオブジェクトをフラット化するか
 * @param {number} options.maxNestedDepth - ネストされたオブジェクトの最大表示深さ
 * @param {Function} options.formatters - 特定フィールドのフォーマット関数 {fieldName: formatterFunction}
 * @returns {string} マークダウンテーブル形式の文字列
 */
const jsonToMarkdownTable = (data, options = {}) => {
  // パラメータの初期化
  const {
    includeFields = null,
    excludeFields = [],
    fieldTitles = {},
    flattenNested = false,
    maxNestedDepth = 1,
    formatters = {}
  } = options;

  // データが配列でない場合は配列に変換
  const arrayData = Array.isArray(data) ? data : [data];
  if (arrayData.length === 0) return "データがありません";

  // フィールドの取得 (指定されたフィールドまたは最初の要素から全フィールド)
  let fields = includeFields;
  if (!fields) {
    // 最初の要素からフィールドを取得
    fields = Object.keys(arrayData[0]);
    
    // 全要素からフィールドを収集（一部の要素にしか存在しないフィールドも含める）
    arrayData.forEach(item => {
      Object.keys(item).forEach(key => {
        if (!fields.includes(key)) {
          fields.push(key);
        }
      });
    });
  }

  // 除外フィールドの適用
  fields = fields.filter(field => !excludeFields.includes(field));

  // ヘッダー行の生成
  const headers = fields.map(field => fieldTitles[field] || field);
  let markdownTable = `| ${headers.join(' | ')} |\n| ${headers.map(() => '---').join(' | ')} |\n`;

  // 各行のデータ処理
  arrayData.forEach(item => {
    const rowData = fields.map(field => {
      let value = item[field];
      
      // 値が存在しない場合
      if (value === undefined || value === null) {
        return '-';
      }
      
      // カスタムフォーマッタがある場合は適用
      if (formatters[field]) {
        return formatters[field](value);
      }
      
      // オブジェクトや配列の処理
      if (typeof value === 'object') {
        if (Array.isArray(value)) {
          // 配列の場合
          if (flattenNested) {
            return value.join(', ');
          } else {
            // 配列内の各要素を処理
            return formatNestedValue(value, maxNestedDepth);
          }
        } else {
          // オブジェクトの場合
          if (flattenNested) {
            // フラット化: キーと値をカンマで区切る
            return Object.entries(value)
              .map(([k, v]) => `${k}: ${formatSimpleValue(v)}`)
              .join(', ');
          } else {
            // ネスト表示
            return formatNestedValue(value, maxNestedDepth);
          }
        }
      }
      
      // 基本型の場合はそのまま文字列化
      return formatSimpleValue(value);
    });
    
    // 行データに | を含む場合はエスケープ
    const escapedRowData = rowData.map(cell => {
      if (typeof cell === 'string') {
        return cell.replace(/\|/g, '\\|');
      }
      return cell;
    });
    
    markdownTable += `| ${escapedRowData.join(' | ')} |\n`;
  });

  return markdownTable;
};

/**
 * ネストされた値を指定された深さまでフォーマットする
 * @param {any} value - フォーマットする値
 * @param {number} maxDepth - 最大深さ
 * @param {number} currentDepth - 現在の深さ
 * @returns {string} フォーマットされた文字列
 */
const formatNestedValue = (value, maxDepth, currentDepth = 0) => {
  if (currentDepth >= maxDepth) {
    if (Array.isArray(value)) {
      return `[${value.length}項目]`;
    } else if (typeof value === 'object' && value !== null) {
      return `{${Object.keys(value).length}項目}`;
    }
    return formatSimpleValue(value);
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    
    const formattedItems = value.map(item => 
      formatNestedValue(item, maxDepth, currentDepth + 1)
    );
    return `[${formattedItems.join(', ')}]`;
  } else if (typeof value === 'object' && value !== null) {
    if (Object.keys(value).length === 0) return '{}';
    
    const formattedEntries = Object.entries(value).map(([k, v]) => 
      `${k}: ${formatNestedValue(v, maxDepth, currentDepth + 1)}`
    );
    return `{${formattedEntries.join(', ')}}`;
  }
  
  return formatSimpleValue(value);
};

/**
 * 基本的な値を文字列にフォーマット
 * @param {any} value - フォーマットする値
 * @returns {string} フォーマットされた文字列
 */
const formatSimpleValue = (value) => {
  if (value === undefined || value === null) return '-';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (typeof value === 'object') {
    if (Array.isArray(value)) {
      return `[${value.length}項目]`;
    } else {
      return `{${Object.keys(value).length}項目}`;
    }
  }
  return String(value);
};

/**
 * バイト数を人間が読みやすい形式に変換するフォーマッタ
 * @param {number} bytes - バイト数
 * @returns {string} 読みやすい形式（例: 1.23 MB）
 */
const formatBytes = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};

/**
 * 日付文字列を指定された形式にフォーマットするフォーマッタ
 * @param {string} dateStr - 日付文字列
 * @param {string} format - 出力形式 ('short', 'medium', 'long')
 * @returns {string} フォーマットされた日付文字列
 */
const formatDate = (dateStr, format = 'medium') => {
  if (!dateStr) return '-';
  
  try {
    const date = new Date(dateStr);
    
    if (isNaN(date.getTime())) return dateStr;
    
    switch(format) {
      case 'short':
        return date.toLocaleDateString();
      case 'long':
        return date.toLocaleString();
      case 'medium':
      default:
        return date.toLocaleString(undefined, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
    }
  } catch (e) {
    return dateStr;
  }
};

// 使用例
const exampleUsage = () => {
  const data = [
    {
      "name": "hhao/qwen2.5-coder-tools:7b",
      "model": "hhao/qwen2.5-coder-tools:7b",
      "size": 12855853056,
      "digest": "1fbf62f22cd4362eee14095f5cd8419e4600a7e14b3592ca43a3c47a17d6487d",
      "details": {
        "parent_model": "",
        "format": "gguf",
        "family": "qwen2",
        "families": ["qwen2"],
        "parameter_size": "7.6B",
        "quantization_level": "Q4_K_M"
      },
      "expires_at": "2025-04-06T17:03:02.503237+09:00"
    }
  ];

  // 基本的な使用法
  console.log(jsonToMarkdownTable(data));

  // 特定のフィールドのみ表示
  console.log(jsonToMarkdownTable(data, {
    includeFields: ['name', 'size', 'details'],
    formatters: {
      size: formatBytes
    }
  }));

  // ネストされたオブジェクトをフラット化
  console.log(jsonToMarkdownTable(data, {
    includeFields: ['name', 'size', 'details'],
    flattenNested: true,
    formatters: {
      size: formatBytes,
      expires_at: (date) => formatDate(date, 'long')
    }
  }));

  // カスタムタイトル
  console.log(jsonToMarkdownTable(data, {
    fieldTitles: {
      name: 'モデル名',
      size: 'サイズ',
      details: '詳細情報'
    },
    formatters: {
      size: formatBytes
    }
  }));
};

// ES Modulesのエクスポート形式に変更
export {
  jsonToMarkdownTable,
  formatBytes,
  formatDate,
  exampleUsage
};
