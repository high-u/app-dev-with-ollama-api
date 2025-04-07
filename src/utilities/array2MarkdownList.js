/**
 * JSONデータをマークダウンリストに変換する関数
 * @param {Array} data - 変換する配列データ
 * @param {Object} options - 変換オプション
 * @param {Array} options.includeFields - 表示するフィールド (省略時は全フィールド)
 * @param {Array} options.excludeFields - 除外するフィールド
 * @param {Object} options.fieldTitles - フィールド名の表示名マッピング
 * @param {boolean} options.flattenNested - ネストされたオブジェクトをフラット化するか
 * @param {number} options.maxNestedDepth - ネストされたオブジェクトの最大表示深さ
 * @param {Function} options.formatters - 特定フィールドのフォーマット関数 {fieldName: formatterFunction}
 * @param {string} options.title - リストのタイトル (省略可)
 * @returns {string} マークダウンリスト形式の文字列
 */
const jsonToMarkdownList = (data, options = {}) => {
  // パラメータの初期化
  const {
    includeFields = null,
    excludeFields = [],
    fieldTitles = {},
    flattenNested = false,
    maxNestedDepth = 3,
    formatters = {},
    title = ''
  } = options;

  // データが配列でない場合は配列に変換
  const arrayData = Array.isArray(data) ? data : [data];
  if (arrayData.length === 0) return "データがありません";

  // フィールドの取得 (指定されたフィールドまたは最初の要素から全フィールド)
  let fields = includeFields;
  if (!fields) {
    // 最初の要素からフィールドを取得
    fields = Object.keys(arrayData[0] || {});
    
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

  // マークダウンリストの生成開始
  let markdownList = title ? `## ${title}\n\n` : '';

  // 各アイテムをリスト項目として処理
  arrayData.forEach((item, index) => {
    markdownList += '- ';
    
    // インデックスまたは名前を持つアイテムの場合、それをリスト項目のタイトルとして使用
    if (item.name) {
      markdownList += `**${item.name}**\n`;
    } else if (item.title) {
      markdownList += `**${item.title}**\n`;
    } else if (item.id) {
      markdownList += `**ID: ${item.id}**\n`;
    } else {
      markdownList += `**項目 ${index + 1}**\n`;
    }

    // 各フィールドを処理
    fields.forEach(field => {
      // 名前、タイトル、IDフィールドが既にリストのタイトルとして使用されている場合はスキップ
      if ((field === 'name' && item.name) || 
          (field === 'title' && item.title) || 
          (field === 'id' && item.id && !item.name && !item.title)) {
        return;
      }
      
      const value = item[field];
      
      // 値が存在しない場合
      if (value === undefined || value === null) {
        markdownList += `  - **${fieldTitles[field] || field}**: -\n`;
        return;
      }
      
      // フォーマット済みの値を取得
      let formattedValue;
      
      // カスタムフォーマッタがある場合は適用
      if (formatters[field]) {
        formattedValue = formatters[field](value);
        markdownList += `  - **${fieldTitles[field] || field}**: ${formattedValue}\n`;
        return;
      }
      
      // オブジェクトや配列の処理
      if (typeof value === 'object' && value !== null) {
        markdownList += `  - **${fieldTitles[field] || field}**: \n`;
        
        if (Array.isArray(value)) {
          // 配列の場合
          if (flattenNested) {
            markdownList += `    - ${value.join(', ')}\n`;
          } else {
            // 配列内の各要素を処理
            value.forEach((item, i) => {
              if (typeof item === 'object' && item !== null) {
                markdownList += formatNestedObjectAsListItems(item, 3, maxNestedDepth, 1, flattenNested);
              } else {
                markdownList += `    - ${item}\n`;
              }
            });
          }
        } else {
          // オブジェクトの場合
          markdownList += formatNestedObjectAsListItems(value, 3, maxNestedDepth, 1, flattenNested);
        }
      } else {
        // 基本型の場合はそのまま文字列化
        markdownList += `  - **${fieldTitles[field] || field}**: ${value}\n`;
      }
    });
    
    markdownList += '\n';
  });

  return markdownList.trim();
};

/**
 * ネストされたオブジェクトをマークダウンリスト項目としてフォーマットする
 * @param {Object} obj - フォーマットするオブジェクト
 * @param {number} indentLevel - インデントレベル（スペースの数）
 * @param {number} maxDepth - 最大深さ
 * @param {number} currentDepth - 現在の深さ
 * @param {boolean} flattenNested - ネストされたオブジェクトをフラット化するか
 * @returns {string} マークダウンリスト項目としてフォーマットされた文字列
 */
const formatNestedObjectAsListItems = (obj, indentLevel, maxDepth, currentDepth, flattenNested) => {
  if (currentDepth > maxDepth) {
    return `${' '.repeat(indentLevel)}- ${JSON.stringify(obj)}\n`;
  }
  
  let result = '';
  const indent = ' '.repeat(indentLevel);
  
  // オブジェクトを配列とそれ以外で処理を分ける
  if (Array.isArray(obj)) {
    if (flattenNested) {
      // フラット化: 配列の要素をカンマ区切りで結合
      result += `${indent}- ${obj.join(', ')}\n`;
    } else {
      // 各要素を個別のリスト項目として処理
      obj.forEach((item, index) => {
        if (typeof item === 'object' && item !== null) {
          // ネストされたオブジェクトや配列
          result += formatNestedObjectAsListItems(item, indentLevel + 2, maxDepth, currentDepth + 1, flattenNested);
        } else {
          // プリミティブ値
          result += `${indent}- ${item}\n`;
        }
      });
    }
  } else if (typeof obj === 'object' && obj !== null) {
    // オブジェクトの各プロパティを処理
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'object' && value !== null && !flattenNested) {
        // ネストされたオブジェクトや配列（フラット化しない場合）
        result += `${indent}- ${key}: \n`;
        result += formatNestedObjectAsListItems(value, indentLevel + 2, maxDepth, currentDepth + 1, flattenNested);
      } else if (Array.isArray(value) && !flattenNested) {
        // 配列（フラット化しない場合）
        result += `${indent}- ${key}: \n`;
        value.forEach(item => {
          if (typeof item === 'object' && item !== null) {
            result += formatNestedObjectAsListItems(item, indentLevel + 2, maxDepth, currentDepth + 1, flattenNested);
          } else {
            result += `${indent}  - ${item}\n`;
          }
        });
      } else {
        // プリミティブ値またはフラット化する場合
        let displayValue;
        if (typeof value === 'object' && value !== null) {
          if (Array.isArray(value)) {
            displayValue = value.join(', ');
          } else {
            // オブジェクトをフラット化
            displayValue = Object.entries(value)
              .map(([k, v]) => `${k}: ${formatSimpleValue(v)}`)
              .join(', ');
          }
        } else {
          displayValue = formatSimpleValue(value);
        }
        result += `${indent}- ${key}: ${displayValue}\n`;
      }
    }
  }
  
  return result;
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
      return `[${value.join(', ')}]`;
    } else {
      return JSON.stringify(value);
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
  console.log(jsonToMarkdownList(data, { title: "モデル一覧" }));

  // 特定のフィールドのみ表示
  console.log(jsonToMarkdownList(data, {
    title: "モデル一覧 (一部のフィールドのみ)",
    includeFields: ['name', 'size', 'details'],
    formatters: {
      size: formatBytes
    }
  }));

  // ネストされたオブジェクトをフラット化
  console.log(jsonToMarkdownList(data, {
    title: "モデル一覧 (フラット化)",
    includeFields: ['name', 'size', 'details'],
    flattenNested: true,
    formatters: {
      size: formatBytes,
      expires_at: (date) => formatDate(date, 'long')
    }
  }));

  // カスタムタイトル
  console.log(jsonToMarkdownList(data, {
    title: "マークダウンリスト出力例",
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

// ES Modulesのエクスポート形式
export {
  jsonToMarkdownList,
  formatBytes,
  formatDate,
  exampleUsage
};

// デフォルトエクスポートも提供
export default jsonToMarkdownList;
