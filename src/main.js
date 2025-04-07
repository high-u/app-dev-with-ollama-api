// https://ytyaru.hatenablog.com/entry/2024/02/13/000000
// https://github.com/vanjs-org/van/discussions/21
// https://kazuya-engineer.com/2024/01/10/how-to-create-mark-down-editer-by-vue-marked-highlight-js/

import { Buffer } from 'buffer';
window.Buffer = Buffer;
import "./style.css";
import van from "vanjs-core";
import { chat, list } from "./services/ollama.js";
import { systemPrompt } from "./domains/llm.js";
import { gitForm } from "./components/gitForm.js";
import { settingsForm } from "./components/settingsForm.js";
import { showSourceCode } from "./components/showSourceCode.js";

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

  // チャット履歴を管理するための状態
  const chatHistory = van.state([
    { role: "system", content: systemPrompt }
  ]);

  // /tmp ディレクトリを作成
  // await ensureDirectory("/tmp");

  // 作業用ディレクトリ名を生成
  const workDirName = `D${Date.now()}`;
  const workDir = `/tmp/${workDirName}`;

  // ページ表示時に既存の作業用ディレクトリを削除
  // const existingDirs = await fs.promises.readdir("/tmp");
  // const workDirs = existingDirs.filter(dir => dir.startsWith("D"));
  // await cleanWorkDirectories(workDirs.map(dir => `/tmp/${dir}`));
  
  // localStorage に値がない場合は保存しておく
  if (!localStorage.getItem("llm") && defaultModel) {
    localStorage.setItem("llm", defaultModel);
  }

  // ストリーミング状態と入力メッセージを管理する状態変数
  const inputMessage = van.state(""); // inputMessage変数をグローバルに移動

  /**
   * ストリーミングメッセージをパースして処理する
   * @param {string} streamMessage - ストリーミングメッセージ
   */
  const handleStreamMessage = (streamMessage) => {

    const arrayMessage = streamMessage.split(/\n|\\n/g);
    const viewMessage = [
      arrayMessage.at(-4),
      arrayMessage.at(-3),
      arrayMessage.at(-2),
      arrayMessage.at(-1),
    ].join("\n");
    
    inputMessage.val = viewMessage;
  };

  const chatOllama = async (message, llm) => {
    
    const response = await chat(
      [{ role: "user", content: message }],
      llm,
      chatHistory.val, // 現在のチャット履歴を渡す
      handleStreamMessage
    );
    console.log({response});

    // ストリーミング終了
    inputMessage.val = ""; // 入力欄をクリア

    // 状態を直接更新
    chatHistory.val = response;
    
    // console.log("chatHistory", chatHistory.val);
  }
  
  const llms = await list();
  // localStorage からモデル名を取得、ない場合は最初のモデルを使用
  const defaultModel = llms.models.length > 0 ? llms.models[0].model : '';
  const storeLlm = localStorage.getItem("llm") || defaultModel;
  const selectedLlm = van.state(storeLlm);
  
  // 初期システムプロンプトはすでにchatHistory初期化時に設定済み

  const modelList = select(
    {
      class: "select w-full",
      oninput: (e) => {
        selectedLlm.val = e.target.value;
        localStorage.setItem("llm", e.target.value);
      },
      onchange: (e) => {
        // globalState.chatState.messages.model = e.target.value;
        // console.log(globalState.chatState.messages);
      },
    },
    llms.models
      .sort((a, b) => (a.model > b.model ? 1 : -1))
      .map((e) => option({ selected: () => storeLlm === e.model }, e.model)),
  );

  // メッセージリストを処理する純粋関数
  const processMessages = (messages) => {
    return messages.filter(e => typeof e === "object" && (e.role === "user" || e.role === "assistant") && e.content !== "").map(message => {
      // JSON形式のメッセージかチェック
      if (message.content && typeof message.content === 'string' && message.content.startsWith(`{`)) {
        try {
          const parsedResponse = JSON.parse(message.content);
          return {
            type: "json",
            data: parsedResponse,
            role: message.role
          };
        } catch (e) {
          // JSONパースに失敗した場合は通常テキストとして扱う
          return {
            type: "text",
            content: message.content,
            role: message.role
          };
        }
      } else {
        return {
          type: "text",
          content: message.content,
          role: message.role
        };
      }
    }).filter(item => item !== null).reverse();
  };

  const messageList = () => {
    // サンプルコードの構成に合わせて実装
    const displayMessages = van.derive(() => processMessages(chatHistory.val));
    // console.log({displayMessages: displayMessages.val});
    
    // サンプルコードと同様にspan()で囲む構造に修正
    return span(
      () => ul({class: ""},
        // map関数の結果をそのまま返す（配列を文字列化させない）
        
        displayMessages.val.map(item => {
          // console.log({item});
          let wrapCard = "card w-full shadow-sm mt-2";
          const styleCard = "card-body whitespace-break-spaces";
          if (item.role === "user") {
            wrapCard += " bg-base-100";
          } else if (item.role === "assistant") {
            wrapCard += " bg-base-200";
          }

          if (item.type === "json") {
            const parsedResponse = item.data;
            return li({class: wrapCard},
              div({class: styleCard},
                
                ...parsedResponse.files.map((e) => div(
                  h2({class: "card-title"}, e.filename),
                  p(e.explanation),
                )),
                div({class: "whitespace-break-spaces"}, parsedResponse.explanation),
                div({class: "justify-end card-actions"},
                  ...parsedResponse.files.map((e) => button({
                    class: "btn",
                    onclick: () => van.add(document.body, showSourceCode(e)),
                  }, e.filename)),
                  parsedResponse.files.length > 0 ? button({class: "btn btn-primary", onclick: () => van.add(document.body, gitForm(parsedResponse, workDir))},
                    "Push"
                  ) : null,
                ),
              )
            );
          } else {
            return li({class: wrapCard},
              div({class: styleCard},
                item.content
              )
            );
          }
        })
      )
    );
  };

  const TodoList = () => {
    // 入力メッセージはグローバルに移動したので、ここでは宣言しない
    
    const inputDom = textarea({
      value: inputMessage,
      oninput: e => inputMessage.val = e.target.value,
      rows: 4,
      cols: 100,
      wrap: "off",
      class: "textarea w-full",
      
    });
    
    const buttonSend = button({
      class: "btn btn-primary w-full",
      onclick: async () => {
        if (!inputMessage.val.trim()) return; // 空のメッセージは送信しない
        
        // メッセージを追加して状態を更新
        chatHistory.val = [...chatHistory.val, { role: "user", content: inputMessage.val }];
        
        
        
        // チャットリクエストを送信
        await chatOllama(inputMessage.val, selectedLlm.val);
      }
    }, 
    svg({ fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "size-6" },
      path({ "stroke-linecap": "round", "stroke-linejoin": "round", "d": "M8.625 9.75a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H8.25m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0H12m4.125 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 0 1 .778-.332 48.294 48.294 0 0 0 5.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z" })
    ), 
    "Talk to ...");
    
    const settingsDom = button({
      class: "btn w-full", 
      onclick: () => van.add(document.body, settingsForm())
    }, 
    svg({ fill: "none", viewBox: "0 0 24 24", "stroke-width": "1.5", stroke: "currentColor", class: "size-6" },
      path({ "stroke-linecap": "round", "stroke-linejoin": "round", "d": "M10.343 3.94c.09-.542.56-.94 1.11-.94h1.093c.55 0 1.02.398 1.11.94l.149.894c.07.424.384.764.78.93.398.164.855.142 1.205-.108l.737-.527a1.125 1.125 0 0 1 1.45.12l.773.774c.39.389.44 1.002.12 1.45l-.527.737c-.25.35-.272.806-.107 1.204.165.397.505.71.93.78l.893.15c.543.09.94.559.94 1.109v1.094c0 .55-.397 1.02-.94 1.11l-.894.149c-.424.07-.764.383-.929.78-.165.398-.143.854.107 1.204l.527.738c.32.447.269 1.06-.12 1.45l-.774.773a1.125 1.125 0 0 1-1.449.12l-.738-.527c-.35-.25-.806-.272-1.203-.107-.398.165-.71.505-.781.929l-.149.894c-.09.542-.56.94-1.11.94h-1.094c-.55 0-1.019-.398-1.11-.94l-.148-.894c-.071-.424-.384-.764-.781-.93-.398-.164-.854-.142-1.204.108l-.738.527c-.447.32-1.06.269-1.45-.12l-.773-.774a1.125 1.125 0 0 1-.12-1.45l.527-.737c.25-.35.272-.806.108-1.204-.165-.397-.506-.71-.93-.78l-.894-.15c-.542-.09-.94-.56-.94-1.109v-1.094c0-.55.398-1.02.94-1.11l.894-.149c.424-.07.765-.383.93-.78.165-.398.143-.854-.108-1.204l-.526-.738a1.125 1.125 0 0 1 .12-1.45l.773-.773a1.125 1.125 0 0 1 1.45-.12l.737.527c.35.25.807.272 1.204.107.397-.165.71-.505.78-.929l.15-.894Z" }),
      path({ "stroke-linecap": "round", "stroke-linejoin": "round", "d": "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" })
    ), 
    "Settings");
    
    // メインのUI構造
    const dom = div({class: "p-8"},
      div({class: "grid grid-cols-4 gap-2"},
        div({class: "col-span-4"}, inputDom),
        div(settingsDom),
        div({class: "col-span-2"}, modelList),
        div(buttonSend),
        // メッセージリスト
        div({class: "col-span-4"}, messageList),
      ),
    );
    
    return dom;
  }
  
  van.add(document.body, TodoList);

})();
