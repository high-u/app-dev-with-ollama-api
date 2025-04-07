import ollama from "ollama/browser";
import { tools } from "../utilities/tools";
import { jsonrepair } from "jsonrepair";

/**
 * チャットメッセージを送信し、ストリーミングでレスポンスを受信する
 * @param {string} message - 送信するメッセージ
 * @param {string} model - 使用するモデル名
 * @param {Object} chatMessages - globalState.messages オブジェクト
 * @param {Function} onStream - ストリーミング中のコールバック関数
 * @returns {Promise<string>} - 完全なレスポンスメッセージ
 */
export const chat = async (userMessage, model, chatMessages, onStream) => {

  // const message = [{ role: "user", content: userMessage }];
  // chatMessagesはもう使用しない
  // let history = [...chatMessages, ...message]; // この関数の引数で受け遠たメッセージ、Ollama から受け取ったメッセージ、この関数内で生成したメッセージを時系列に保存して return する

  // グローバルステートからメッセージ配列を取得
  // const existingMessages = chatMessages.val.messages || [];
  // const newChatMessages = [...existingMessages, ...message];

  // Define the expected JSON schema based on the system prompt
  const responseSchema = {
    type: "object",
    properties: {
      explanation: { type: "string" },
      files: {
        type: "array",
        items: {
          type: "object",
          properties: {
            filename: { type: "string" },
            content: { type: "string" },
            explanation: { type: "string" }
          },
          required: ["filename", "content", "explanation"]
        }
      }
    },
    required: ["explanation", "files"]
  };

  const options = {
    model,
    messages: chatMessages,
    stream: true, // Default to stream: true
    // format: responseSchema // Initialize without format
  };

  // メッセージに "ollama" が含まれている場合のみ tools オプションを追加
  // console.log({message});
  if (chatMessages[chatMessages.length - 1] && 
      chatMessages[chatMessages.length - 1].role === "user" &&
      typeof chatMessages[chatMessages.length - 1].content === "string" &&
      chatMessages[chatMessages.length - 1].content.toLowerCase().includes("ollama"))
  {
    options.stream = false; // Disable stream when using tools
    options.tools = [
      {
        type: "function",
        function: {
          name: "ollama_ls",
          description: "Get the list of models",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
      {
        type: "function",
        function: {
          name: "ollama_ps",
          description: "Get the list of running models",
          parameters: {
            type: "object",
            properties: {},
            required: []
          }
        }
      },
    ];
    // Do not set options.format when using tools
  } else if (chatMessages[chatMessages.length - 1] && chatMessages[chatMessages.length - 1].role === "user") {
    // Set format only when not using tools
    options.format = responseSchema;
    // Keep stream: true when using format
  }

  // console.log({options});
  const response = await ollama.chat(options);
  

  let responseMessage = "";
  let finalPart = null;

  // responseがiterableかどうかを確認
  if (response[Symbol.asyncIterator]) {
    // streamモードの場合：iterableなのでfor awaitループで処理
    for await (const part of response) {
      // console.log({part});
      if (part.message?.content) {
        // 有効なコンテンツの場合のみ追加
        responseMessage += part.message.content;
        // 空でない場合のみコールバックを呼び出す
        if (responseMessage.trim()) {
          onStream(responseMessage);
        }
      }
      if (part.done) {
        // console.log("done", part);
        // JSONを修正してから割り当てる
        try {
          // JSONのような形式かどうかを簡易的にチェック
          if (responseMessage.trim() && 
              (responseMessage.trim().startsWith('{') && responseMessage.trim().endsWith('}')) || 
              (responseMessage.trim().startsWith('[') && responseMessage.trim().endsWith(']'))) {
            const repairedJson = jsonrepair(responseMessage);
            part.message.content = repairedJson;
          } else {
            // JSONのような形式でない場合は元のメッセージをそのまま使用
            part.message.content = responseMessage;
          }
        } catch (error) {
          console.error("JSONの修正に失敗しました:", error);
          // エラーを適切に処理する。元のメッセージを割り当てるか、エラーをスローするなど
          part.message.content = responseMessage; // 修正に失敗した場合は元のメッセージにフォールバック
        }
        finalPart = part;
      }
    }
  } else {
    // 非streamモードの場合：responseオブジェクトを直接使用
    // console.log("ollama response: ", response);
    finalPart = response;
  }

  
  let toolChatMessages = [...chatMessages, finalPart.message];
  if (finalPart.message.hasOwnProperty("tool_calls")) {

    
    // console.log("tool_calls", finalPart);
    
    // チャット履歴内の既存のツール呼び出し数をカウント
    const existingToolCallCount = chatMessages.filter(
      msg => msg.role === "tool"
    ).length;
    
    const toolCalls = await Promise.all(finalPart.message.tool_calls.map(async (toolCall, index) => {
      const toolResult = await tools[toolCall.function.name]();
      console.log("toolResult", toolResult);
      return {
        role: "tool",
        tool_call_id: String(existingToolCallCount + index), // 連番で一意な ID を設定
        name: toolCall.function.name,
        content: JSON.stringify(toolResult),
      }
    }));
    // console.log("tool response", [finalPart.message, ...toolCalls]);

    toolChatMessages = [...toolChatMessages, ...toolCalls];
    // ツール実行後の最終応答を取得するために再帰呼び出し
    toolChatMessages = await chat(null, model, toolChatMessages, onStream);

    // toolChatMessages = [...toolChatMessages, finalPart.message];
    // console.log("finalResponseAfterToolCall", finalResponseAfterToolCall);
    // // 最終応答を main.js が期待する JSON 形式の文字列に整形
    // const finalExplanation = finalResponseAfterToolCall.message.content || "ツールは実行されましたが、最終的な説明は生成されませんでした。";
    // const formattedResult = {
    //     explanation: finalExplanation,
    //     files: [] // ツール実行でファイルが生成されるケースは現状ないので空配列
    // };
    // // finalPart の message.content を整形後の JSON 文字列で上書き
    // finalPart.message.content = JSON.stringify(formattedResult);

  // } else if (!options.format && finalPart.message.content && typeof finalPart.message.content === 'string') {
  //   // format も tool_calls もない場合 (プレーンテキスト応答) は、期待する形式に整形
  //   // ただし、jsonrepairが適用されている可能性もあるので、まずはパースを試みる
  //   let parsedContent = null;
  //   try {
  //       parsedContent = JSON.parse(finalPart.message.content);
  //   } catch (e) {
  //       // パース失敗＝プレーンテキストとみなす
  //   }

  //   // パースできなかった場合、またはパースできても期待する形式でない場合
  //   if (!parsedContent || typeof parsedContent.explanation !== 'string' || !Array.isArray(parsedContent.files)) {
  //       const plainExplanation = finalPart.message.content;
  //       const formattedResult = {
  //           explanation: plainExplanation,
  //           files: []
  //       };
  //       finalPart.message.content = JSON.stringify(formattedResult);
  //   }
    // 既に期待する形式のJSON文字列（jsonrepair後など）であれば何もしない
  }
  // format を使用した場合は、既に期待する JSON 文字列になっているはずなので何もしない
  
  // グローバルステートのメッセージを更新
  // const updatedMessages = [...newChatMessages, { role: "assistant", content: finalPart.message.content }];
  // chatMessages.val = {
  //   ...chatMessages.val,
  //   messages: updatedMessages
  // };
  
  // console.log("response", finalPart);
  return toolChatMessages;
};

/**
 * 利用可能なモデル一覧を取得する
 * @returns {Promise<Array>} - モデル一覧
 */
export const list = async () => {
  const list = await ollama.list();
  console.log("ollama list: ", list);
  return list;
};

/**
 * 実行中のモデル一覧を取得する
 * @returns {Promise<Object>} - 実行中のモデル情報
 */
export const ps = async () => {
  const ps = await ollama.ps();
  console.log("ollama ps: ", ps);
  return ps;
};
