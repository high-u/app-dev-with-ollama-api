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
import { messagesList } from "./components/messagesList.js";

(async () => {
  
  const { button, div, textarea, ul, li, select, option, p, h2, span } = van.tags;

  // チャット履歴を管理するための状態
  const chatHistory = van.state([
    { role: "system", content: systemPrompt }
  ]);

  // 作業用ディレクトリ名を生成
  const workDirName = `D${Date.now()}`;
  const workDir = `/tmp/${workDirName}`;
  
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
    
    inputMessage.val = ""; // 入力欄をクリア
    
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
  }
  
  // modelListコンポーネントを取得
  const { component: modelListComponent, getSelectedModel } = await modelList();

  const TodoList = () => {
    
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
        // メッセージリスト - 外部コンポーネントを使用
        div({class: "col-span-4"}, messagesList({ messages: chatHistory, workDir })),
      ),
    );
    
    return dom;
  }
  
  van.add(document.body, TodoList);

})();
