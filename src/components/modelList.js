import van from "vanjs-core";
import { list } from "../services/ollama.js";

export const modelList = async () => {
  const { select, option } = van.tags;
  
  const llms = await list();
  // localStorage からモデル名を取得、ない場合は最初のモデルを使用
  const defaultModel = llms.models.length > 0 ? llms.models[0].model : '';
  const storeLlm = localStorage.getItem("llm") || defaultModel;
  const selectedLlm = van.state(storeLlm);
  
  // アプリ初期化時にデフォルトモデルをlocalStorageに保存
  if (!localStorage.getItem("llm") && defaultModel) {
    localStorage.setItem("llm", defaultModel);
  }
  
  return {
    component: select(
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
    ),
    selectedLlm,
    getSelectedModel: () => selectedLlm.val
  };
}; 