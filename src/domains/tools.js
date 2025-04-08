import { list, ps } from "../services/ollama.js";
import { jsonToMarkdownTable, formatBytes, formatDate } from "../utilities/array2MarkdownTable.js";
import { jsonToMarkdownList } from "../utilities/array2MarkdownList.js";

/**
 * 利用可能なモデル一覧を取得する
 * @returns {Promise<Array>} - モデル一覧
 */
const ollamaLs = async () => {
  let result = await list();
  
  // モデル一覧をマークダウンリストに変換
  if (result.models && result.models.length > 0) {
    const listOptions = {
      title: "Available Models",
      includeFields: ['name', 'size', 'modified_at', 'details'],
      fieldTitles: {
        name: 'Model Name',
        size: 'Model Size',
        modified_at: 'Date Updated',
        details: 'Details'
      },
      formatters: {
        size: formatBytes,
        modified_at: (date) => formatDate(date, 'long')
      }
    };
    
    result = jsonToMarkdownList(result.models, listOptions);
  }
  
  return result;
};

/**
 * 実行中のモデル一覧を取得する
 * @returns {Promise<Object>} - 実行中のモデル情報
 */
const ollamaPs = async () => {
  let result = await ps();
  
  // 実行中のモデル一覧をマークダウンリストに変換
  if (result.models && result.models.length > 0) {
    const listOptions = {
      title: "Running Models",
      fieldTitles: {
        name: 'Model Name',
        id: 'ID',
        size: 'Model Size',
        created_at: 'Date Created',
        details: 'Details'
      },
      formatters: {
        size: formatBytes,
        size_vram: formatBytes,
        created_at: (date) => formatDate(date, 'long')
      },
      excludeFields: ['digest']
    };
    
    result = jsonToMarkdownList(result.models, listOptions);
  } else {
    // モデルが実行されていない場合でも空のリストを表示
    result = "## Running Models\n\nNo models currently running.";
  }
  
  return result;
};

export const tools = {
  ollama_ls: ollamaLs,
  ollama_ps: ollamaPs,
};
