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
import { talkTo, settings } from "./components/icons.js";
import { modelList } from "./components/modelList.js";

(async () => {
  
  const { button, div, textarea, ul, li, select, option, p, h2, span } = van.tags;

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
  
  const llms = await list();
  // localStorage からモデル名を取得、ない場合は最初のモデルを使用
  const defaultModel = llms.models.length > 0 ? llms.models[0].model : '';
  
  // localStorage 関連の処理はmodels.jsに移動したため削除

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
  
  // 初期システムプロンプトはすでにchatHistory初期化時に設定済み

  // modelListコンポーネントを取得
  const { component: modelListComponent, getSelectedModel } = await modelList();

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
    return div(
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
        
        
        
        // チャットリクエストを送信 - getSelectedModelを使用
        await chatOllama(inputMessage.val, getSelectedModel());
      }
    }, 
    talkTo(), 
    "Talk to ...");
    
    const settingsDom = button({
      class: "btn w-full", 
      onclick: () => van.add(document.body, settingsForm())
    }, 
    settings(), 
    "Settings");
    
    // メインのUI構造
    const dom = div({class: "p-8"},
      div({class: "grid grid-cols-4 gap-2"},
        div({class: "col-span-4"}, inputDom),
        div(settingsDom),
        div({class: "col-span-2"}, modelListComponent),
        div(buttonSend),
        // メッセージリスト
        div({class: "col-span-4"}, messageList),
      ),
    );
    
    return dom;
  }
  
  van.add(document.body, TodoList);

})();
