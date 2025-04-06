import { list, ps } from "../services/ollama";
/**
 * 利用可能なモデル一覧を取得する
 * @returns {Promise<Array>} - モデル一覧
 */
const ollamaLs = async () => {
  return await list();
};

/**
 * 実行中のモデル一覧を取得する
 * @returns {Promise<Object>} - 実行中のモデル情報
 */
const ollamaPs = async () => {
  return await ps();
};

export const tools = {
  ollama_ls: ollamaLs,
  ollama_ps: ollamaPs,
};
