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
import { cleanWorkDirectories, createFiles, fs, ensureDirectory, addAll, commit, setupRemote, push } from "./services/git.js";

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

  const gitForm = (data) => {
    // state variables for form inputs
    const username = van.state("");
    const password = van.state("");
    const email = van.state("");
    const repoUrl = van.state("");
    const status = van.state("");
    const deleted = van.state(false);
    
    
    
    return () => deleted.val ? null : div(
      {class: "fixed top-0 left-0 w-screen h-screen bg-base-200 overflow-y-auto p-8"},
      
      h2({class: "text-xl font-bold mb-4"}, "Git Repository Settings"),
    
      div({class: "form-control"},
        label({class: "label", for: "email"}, "Email:"),
        input({
          id: "email",
          type: "email", 
          class: "input input-bordered w-full",
          value: email,
          oninput: (e) => email.val = e.target.value,
          required: true,
          autocomplete: "email",
        })
      ),
      div({class: "form-control"},
        label({class: "label", for: "username"}, "Username:"),
        input({
          id: "username",
          type: "text", 
          class: "input input-bordered w-full",
          value: username,
          oninput: (e) => username.val = e.target.value,
          required: true,
          autocomplete: "username",
        })
      ),
      div({class: "form-control"},
        label({class: "label", for: "password"}, "Password:"),
        input({
          id: "password",
          type: "password", 
          class: "input input-bordered w-full",
          value: password,
          oninput: (e) => password.val = e.target.value,
          required: true
        })
      ),
      div({class: "form-control"},
        label({class: "label", for: "repoUrl"}, "Repository URL:"),
        input({
          id: "repoUrl",
          type: "url", 
          class: "input input-bordered w-full",
          value: repoUrl,
          oninput: (e) => repoUrl.val = e.target.value,
          required: true,
          placeholder: "https://proxy.example.com/github.com/username/repo.git",
          autocomplete: "repository",
        })
      ),
      div({class: "flex gap-4 mt-6"},
        button({type: "button", class: "btn flex-1", onclick: () => deleted.val = true}, "Cancel"),
        button({type: "submit", class: "btn btn-primary flex-1"}, "Push to Repository"),
      ),
    );
  };

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
            button({class: "btn btn-primary", onclick: () => van.add(document.body, gitForm(data))},
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
    }}, svg({ fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "size-6" },
      path({ "stroke-linecap": "round", "stroke-linejoin": "round", "d": "M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" }),
    ), "Send");
    const settingsDom = button({
      class: "btn w-full", 
      onclick: () => van.add(document.body, gitForm(data))
    }, svg({ fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "size-6" },
      path({ "stroke-linecap": "round", "stroke-linejoin": "round", "d": "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" }),
      path({ "stroke-linecap": "round", "stroke-linejoin": "round", "d": "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" }),
    ), "Settings");
    const dom = div({class: "p-8"},
      div({class: "grid grid-cols-4 gap-2"},
        div({class: "col-span-4"}, inputDom),
        div(settingsDom),
        div({class: "col-span-2"}, modelList),
        div(buttonSend),
        div({class: "col-span-4"}, ...messages.val),
      ),
    );
    return dom;
  }

  van.add(document.body, TodoList);

  chatMessages = [{ role: "system", content: systemPrompt }];
})();
