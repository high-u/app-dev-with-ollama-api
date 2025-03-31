import { jsonrepair } from "jsonrepair";

/**
 * Markdownテキストから最初のJSONコードブロックを抽出する
 * @param {string} markdownText - マークダウンテキスト
 * @returns {string} - 抽出されたJSON文字列、または元のテキスト
 */
export const extractJsonCodeBlocks = (markdownText) => {
    // ```json で始まり、``` で終わるブロックを検索
    const regex = /```json\n([\s\S]*?)\n```/;
    const match = markdownText.match(regex);
    
    if (!match) {
        // JSONブロックが見つからない場合は、テキスト全体をjsonrepairで試す
        try {
            return jsonrepair(markdownText);
        } catch (e) {
            console.warn('Input text is not valid JSON:', e);
            return markdownText;
        }
    }
    
    try {
        // コードブロックの中身を取得（最初のキャプチャグループ）
        const jsonContent = match[1];
        // jsonrepairを通して返す
        return jsonrepair(jsonContent);
    } catch (e) {
        console.warn('Invalid JSON found in code block:', e);
        // JSONとして解析できない場合は元のテキストを返す
        return markdownText;
    }
}; 