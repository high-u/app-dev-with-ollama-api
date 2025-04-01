// https://ytyaru.hatenablog.com/entry/2024/02/13/000000
// https://github.com/vanjs-org/van/discussions/21
// https://kazuya-engineer.com/2024/01/10/how-to-create-mark-down-editer-by-vue-marked-highlight-js/

import { Buffer } from 'buffer';
window.Buffer = Buffer;

import "./style.css";
import van from "vanjs-core";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { chat, list, systemPrompt } from "./services/ollama.js";
import { cleanWorkDirectories, createFiles, fs, ensureDirectory } from "./services/git.js";

(async () => {
  const {
    button,
    div,
    input,
    textarea,
    pre,
    ul,
    li,
    select,
    option,
    p,
    form,
    label,
    h2,
    span,
  } = van.tags;
  const {svg, path} = van.tags("http://www.w3.org/2000/svg");

  // /tmp ディレクトリを作成
  await ensureDirectory("/tmp");

  // 作業用ディレクトリ名を生成
  const workDirName = `D${Date.now()}`;
  const workDir = `/tmp/${workDirName}`;

  // ページ表示時に既存の作業用ディレクトリを削除
  const existingDirs = await fs.promises.readdir("/tmp");
  const workDirs = existingDirs.filter(dir => dir.startsWith("D"));
  await cleanWorkDirectories(workDirs.map(dir => `/tmp/${dir}`));

  let chatMessages = [];
  // const toolchain = new Toolchain();

  const markedWithHighlight = new Marked(
    markedHighlight({
      langPrefix: "hljs language-",
      highlight(code, lang) {
        const language = hljs.getLanguage(lang) ? lang : "plaintext";
        return hljs.highlight(code, { language }).value;
      },
    }),
  );

  const storeLlm = localStorage.getItem("llm");
  const selectedLlm = van.state(storeLlm);

  const llms = await list();

  const modelList = 
    select(
      {
        class: "select w-full",
        oninput: (e) => {
          selectedLlm.val = e.target.value;
          localStorage.setItem("llm", e.target.value);
        },
      },
      llms.models
        .sort((a, b) => (a.model > b.model ? 1 : -1))
        .map((e) => option({ selected: () => storeLlm === e.model }, e.model)),
    );

  // Magic number replaced with constant
  const MIN_VALID_JSON_LENGTH = 4; // JSON minimum length "{}" + additional characters

  const textareaPrompt = van.state("");

  /**
   * ストリーミングメッセージをUIに表示する
   * @param {string} message - 表示するメッセージ
   */
  const updateStreamingMessage = (message) => {
    const arrayMessage = message.split(/\n|\\n/g);
    const viewMessage = [
      arrayMessage.at(-4),
      arrayMessage.at(-3),
      arrayMessage.at(-2),
      arrayMessage.at(-1),
    ].join("\n");
    
    textareaPrompt.val = viewMessage;
  };

  /**
   * ストリーミングメッセージをパースして処理する
   * @param {string} streamMessage - ストリーミングメッセージ
   */
  const handleStreamMessage = (streamMessage) => {
    // console.log({streamMessage});
    // 空のメッセージや極端に短いメッセージはスキップ
    // if (!streamMessage || streamMessage.length < MIN_VALID_JSON_LENGTH) {
    //   console.log("Skipping empty or too short message:", streamMessage);
    //   return;
    // }
    
    // updateStreamingMessage(streamMessage);
    const arrayMessage = streamMessage.split(/\n|\\n/g);
    const viewMessage = [
      arrayMessage.at(-4),
      arrayMessage.at(-3),
      arrayMessage.at(-2),
      arrayMessage.at(-1),
    ].join("\n");
    
    textareaPrompt.val = viewMessage;
  };

  const gitPush = async (data) => {
    try {
      // ファイルを作成
      await createFiles(data.files, workDir);
      
      // ファイルとディレクトリの構成を出力
      console.log("Directory structure after file creation:");
      await printDirectoryStructure(workDir); 
      
      // 変更をステージング
      await toolchain.git_add_all(workDir);
      
      // コミット
      await toolchain.git_commit(workDir, "Initial commit", {
        name: "AI Assistant",
        email: "ai@example.com"
      });
      
      // プッシュ
      await toolchain.git_push(workDir, {
        url: "https://github.com/yourusername/yourrepo.git",
        username: "yourusername",
        password: "yourpassword"
      }, {
        name: "AI Assistant",
        email: "ai@example.com"
      });

      // git status の内容を出力
      const status = await toolchain.git_diff(workDir);
      console.log("Git status after operations:", status);
    } catch (error) {
      console.error("Git operations failed:", error);
    }
  }

  /**
   * ディレクトリ構造を再帰的に出力する
   * @param {string} dir - 出力するディレクトリのパス
   * @param {string} prefix - 出力のプレフィックス（インデント用）
   * @returns {string} ディレクトリ構造の文字列
   */
  async function printDirectoryStructure(dir, prefix = "") {
    let output = "";
    const items = await fs.promises.readdir(dir);
    
    for (const item of items) {
      // .git ディレクトリを除外
      if (item === ".git") continue;
      
      const itemPath = `${dir}/${item}`;
      const stats = await fs.promises.stat(itemPath);
      
      output += `${prefix}${stats.isDirectory() ? "📁" : "📄"} ${item}\n`;
      
      if (stats.isDirectory()) {
        output += await printDirectoryStructure(itemPath, prefix + "  ");
      }
    }
    return output;
  }

  const chatOllama = async (message, llm) => {
    
    console.log({chatMessages});

    const response = await chat(
      [{ role: "user", content: message }],
      llm,
      chatMessages,
      handleStreamMessage
    );
    console.log({response});

    textareaPrompt.val = "";

    try {
      console.log("JSON.parse", response.message.content);
      const parsedResponse = JSON.parse(response.message.content);

      // ファイルが返ってきた場合、ファイルを作成
      if (parsedResponse.files && parsedResponse.files.length > 0) {
        try {
          // ファイルを作成
          await createFiles(parsedResponse.files, workDir);
          
          // ファイルとディレクトリの構成を出力
          const structure = await printDirectoryStructure(workDir);
          console.log("Directory structure after file creation:\n" + structure);
        } catch (error) {
          console.error("File creation failed:", error);
          throw error;
        }
      }

      // // tool の使用が含まれているか確認
      // if (parsedResponse.tool) {
      //   try {
      //     // tool の実行
      //     const toolResult = await toolchain.executeTool(parsedResponse.tool, workDir);

      //     // tool の実行結果をチャット履歴に追加
      //     chatMessages = [
      //       ...chatMessages,
      //       { role: "assistant", content: jsonString },
      //       { role: "tool", content: JSON.stringify(toolResult) }
      //     ];

      //     // tool の実行結果を Ollama に送信
      //     const toolResponse = await chat(
      //       `Tool execution result: ${JSON.stringify(toolResult.result)}`,
      //       llm,
      //       chatMessages,
      //       handleStreamMessage
      //     );

      //     const toolJsonString = jsonrepair(toolResponse.message.content);
      //     chatMessages = [...chatMessages, { role: "assistant", content: toolJsonString }];
      //     return JSON.parse(toolJsonString);
      //   } catch (error) {
      //     console.error("Tool execution failed:", error);
      //     // エラーをチャット履歴に追加
      //     chatMessages = [
      //       ...chatMessages,
      //       { role: "assistant", content: jsonString },
      //       { role: "tool", content: JSON.stringify({ error: error.message }) }
      //     ];
      //     throw error;
      //   }
      // }

      chatMessages = [...chatMessages, { role: "assistant", content: response.message.content }];
      return parsedResponse;
    } catch (error) {
      console.error("Chat operation failed:", error);
      throw error;
    }
  }
  
  const showSourceCode = (data) => {
    console.log({data});

    const deleted = van.state(false)
    return () => deleted.val ? null : div(
      {class: "fixed top-0 left-0 w-screen h-screen bg-base-200 overflow-y-auto"},
      div({class: "whitespace-pre-wrap source-code p-4"},
        data.content,
      ),
      button(
        {
          class: "btn btn-circle fixed top-4 right-4",
          onclick: () => deleted.val = true
        },
        svg(
          {
            viewBox: "0 0 24 24",
            "stroke-width": "1.5",
            class: "size-6 stroke-stone-500"
          },
          path({
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
            "d": "M6 18 18 6M6 6l12 12"
          })
        ),
      )
    )
  }

  const messages = van.state([]); // messages.val = [a, ...messages.val];

  const TodoItem = (data, role) => {
    console.log({data});

    const contentsDom = ((role) => {
      if (role === "user") {
        return [
          p(data.explanation),
        ];
      } else if (role === "assistant" && data.files.length > 0) {
        return [
          div({class: "justify-end card-actions"},
            ...data.files.map((e) => button({
              class: "btn",
              onclick: () => van.add(document.body, showSourceCode(e)),
            }, e.filename,)),
            button({class: "btn btn-primary", onclick: () => gitPush(data)},
              "Push"
            ),
          ),
            ...data.files.map((e) => div(
              h2({class: "card-title"}, e.filename),
              p(e.explanation),
            )),
          div({class: "whitespace-pre-wrap"}, data.explanation),
        ];
      } else if (role === "assistant" && data.files.length === 0) {
        return [
          p(data.explanation),
        ];
      } else {
        return div("");
      }
    })(role);

    const bgColor = role === "user" ? "bg-base-300" : "bg-base-100";

    return () => div({ class: `mt-4 card w-full card-sm shadow-sm ${bgColor}`},
      div({class: "card-body"},
        ...contentsDom
      ),
    )
  }
  
  const TodoList = () => {
    const inputDom = textarea({
      value: textareaPrompt,
      rows: 4,
      cols: 100,
      wrap: "off",
      class: "textarea w-full",
    });
    const buttonSend = button({
      class: "btn btn-primary w-full",
      onclick: async () => {
        messages.val = [
          TodoItem({explanation: inputDom.value, files: []}, "user"),
          ...messages.val
        ];
        console.log(selectedLlm.val);
        const res = await chatOllama(inputDom.value, selectedLlm.val);
        messages.val = [
          TodoItem(res, "assistant"),
          ...messages.val
        ];
    }}, "Send");
    const dom = div({class: "p-8"},
      div({class: "grid grid-cols-2 gap-2"},
        div({class: "col-span-2"}, inputDom),
        div(modelList),
        div(buttonSend),
        div({class: "col-span-2"}, ...messages.val),
      ),
    );
    return dom;
  }

  van.add(document.body, TodoList);

  chatMessages = [{ role: "system", content: systemPrompt }];
})();
