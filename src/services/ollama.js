import ollama from "ollama/browser";
import { tools } from "../utilities/tools";

/**
 * チャットメッセージを送信し、ストリーミングでレスポンスを受信する
 * @param {string} message - 送信するメッセージ
 * @param {string} model - 使用するモデル名
 * @param {Array} messages - チャット履歴
 * @param {Function} onStream - ストリーミング中のコールバック関数
 * @returns {Promise<string>} - 完全なレスポンスメッセージ
 */
export const chat = async (message, model, chatMessages, onStream) => {
  const newChatMessages = [...chatMessages, ...message];
  const options = {
    model,
    messages: newChatMessages,
    stream: true,
  };

  // メッセージに "ollama" が含まれている場合のみ tools オプションを追加
  console.log({message});
  if (message[message.length - 1].content.toLowerCase().includes("ollama")
    && message[message.length - 1].role === "user")
  {
    options.stream = false;
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
  }
  console.log({options});
  const response = await ollama.chat(options);
  // console.log({response});

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
        console.log({part});
        part.message.content = responseMessage; // これがいるのかどうか検証の必要性あり
        finalPart = part;
      }
    }
  } else {
    // 非streamモードの場合：responseオブジェクトを直接使用
    finalPart = response;
  }

  
  if (finalPart.message.hasOwnProperty("tool_calls")) {
    console.log("tool_calls", finalPart);
    const toolCalls = await Promise.all(finalPart.message.tool_calls.map(async (toolCall, index) => {
      const toolResult = await tools[toolCall.function.name]();
      return {
        role: "tool",
        tool_call_id: String(index), // 複数回のツールコールが呼び出されることは考慮していない
        name: toolCall.function.name,
        content: JSON.stringify(toolResult),
      }
    }));
    console.log("tool response", [finalPart.message, ...toolCalls]);
    finalPart = await chat([finalPart.message, ...toolCalls], model, newChatMessages, onStream);
/*
レスポンス

{
  "model": "hhao/qwen2.5-coder-tools:14b",
  "created_at": "2025-03-31T07:01:03.753825Z",
  "message": {
    "role": "assistant",
    "content": "",
    "tool_calls": [
      {
        "function": {
          "name": "ollama_ls",
          "arguments": {}
      }
    },
    {
      "function": {
          "name": "ollama_ps",
          "arguments": {}
        }
      }
    ]
  },
  "done_reason": "stop",
  "done": true,
  "total_duration": 15686981291,
  "load_duration": 30343958,
  "prompt_eval_count": 996,
  "prompt_eval_duration": 982728208,
  "eval_count": 296,
  "eval_duration": 14664614625
}

リクエスト

// ツールの実行結果を含めた新しいメッセージを追加
{
  role: "tool", 
  tool_call_id: "0", // 最初のツールコールの結果
  name: "ollama_ls",
  content: JSON.stringify({ツールの実行結果})
},
{
  role: "tool",
  tool_call_id: "1", // 2番目のツールコールの結果
  name: "ollama_ps",
  content: JSON.stringify({ツールの実行結果})
}
*/
  }


  // if (finalPart) {
  //   // finalPartのmessageが存在するか確認
  //   if (!finalPart.message) {
  //     finalPart.message = { content: responseMessage };
  //   } else if (!finalPart.message.content) {
  //     finalPart.message.content = responseMessage;
  //   }
  // } else {
  //   // finalPartが存在しない場合は、代替オブジェクトを作成
  //   finalPart = {
  //     message: { content: responseMessage },
  //     done: true
  //   };
  // }
  
  console.log("response", finalPart);
  return finalPart;
};

/**
 * 利用可能なモデル一覧を取得する
 * @returns {Promise<Array>} - モデル一覧
 */
export const list = async () => {
  return await ollama.list();
};

/**
 * 実行中のモデル一覧を取得する
 * @returns {Promise<Object>} - 実行中のモデル情報
 */
export const ps = async () => {
  return await ollama.ps();
};
