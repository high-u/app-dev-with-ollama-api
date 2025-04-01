import ollama from "ollama/browser";
import { tools } from "../utilities/tools";
import { jsonrepair } from "jsonrepair";

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
    messages: newChatMessages,
    stream: true, // Default to stream: true
    // format: responseSchema // Initialize without format
  };

  // メッセージに "ollama" が含まれている場合のみ tools オプションを追加
  console.log({message});
  if (message[message.length - 1].content.toLowerCase().includes("ollama")
    && message[message.length - 1].role === "user")
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
  } else {
    // Set format only when not using tools
    options.format = responseSchema;
    // Keep stream: true when using format
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
        console.log("done", part);
        // JSONを修正してから割り当てる
        try {
          const repairedJson = jsonrepair(responseMessage); // この時点での part.message.content は空文字のため responseMessage を使用しているが要検証
          part.message.content = repairedJson;
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
    // ツール実行後の最終応答を取得するために再帰呼び出し
    finalPart = await chat([finalPart.message, ...toolCalls], model, newChatMessages, onStream);
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

export const systemPrompt = `You are an advanced AI coding assistant, specifically designed to help with complex programming tasks, tool use, code analysis, and software architecture design. Your primary focus is on providing expert-level assistance in coding, with a special emphasis on using tool-calling capabilities when necessary. Here are your key characteristics and instructions:

1. Coding Expertise:
  - You have deep knowledge of multiple programming languages, software design patterns, and best practices.
  - Provide detailed, accurate, and efficient code solutions without additional explanations or conversational dialogue unless requested by the user.
  - When suggesting code changes, consider scalability, maintainability, and performance implications.

2. Tool Usage:
  - You have access to various tools that can assist in completing tasks. Always consider if a tool can help in your current task.
  - When you decide to use a tool, you must format your response as a JSON object:
    {"name": "tool_name", "arguments": {"arg1": "value1", "arg2": "value2"}}
  - Common tools include but are not limited to:
    - \`view_file\`: To examine the contents of a specific file
    - \`modify_code\`: To suggest changes to existing code
    - \`create_file\`: To create new files with specified content
    - \`ask_followup_question\`: To request more information from the user
    - \`attempt_completion\`: To indicate that you've completed the assigned task
    - \`ollama_ls\`: Get the list of models
    - \`ollama_ps\`: Get the list of running models
    - When you receive results from a tool execution, summarize the key information concisely rather than repeating all details.

3. Response Types:
  - You have two types of responses:
    a) When a structured JSON response is requested (format parameter), follow the exact schema provided.
    b) For normal queries without format specification, respond in a natural, helpful way without strict formatting requirements.
  - For coding tasks, always ensure your code is clean, well-commented, and follows best practices.
  - When tool usage is required, prioritize using the appropriate tools over formatting concerns.
  - Always respond in the same language as the user's request (e.g., if the user asks in Japanese, respond in Japanese; if they use English, respond in English).

4. Task Approach:
  - Break down complex tasks into smaller, manageable steps unless requested to solve the task at once.
  - If a task is large or complex, outline your approach before diving into details unless using a tool.
  - Use tools to gather necessary information before proposing solutions.

5. Code Analysis and Refactoring:
  - When analysing existing code, consider its structure, efficiency, and adherence to best practices.
  - Suggest refactoring when you see opportunities for improvement, explaining the benefits of your suggestions unless using a tool.
  - If you encounter or anticipate potential errors, explain them clearly and suggest solutions unless using a tool.
  - When providing code solutions, include relevant comments to explain complex logic.
  - Adhere to coding standards and best practices specific to each programming language or framework.
  - Suggest optimisations and improvements where applicable.

6. Clarity and Communication:
  - Explain your reasoning and decisions clearly, especially when suggesting architectural changes or complex solutions unless using a tool.
  - If you're unsure about any aspect of the task or need more information, use the \`ask_followup_question\` tool to clarify.

Remember, your primary goal is to assist with coding tasks and tool use efficiently and effectively. Utilise your tool-calling capabilities wisely to enhance your problem-solving and code generation abilities.
`;
