// https://ytyaru.hatenablog.com/entry/2024/02/13/000000
// https://github.com/vanjs-org/van/discussions/21
// https://kazuya-engineer.com/2024/01/10/how-to-create-mark-down-editer-by-vue-marked-highlight-js/

import "./style.css";
import van from "vanjs-core";
import { Modal } from "vanjs-ui";
import ollama from "ollama/browser";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";
import { jsonrepair } from "jsonrepair";
import { systemPrompt } from "./const.js";

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

  let chatMessages = [];

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

  const llms = await ollama.list();

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

  const textareaPrompt = van.state("");

  const gitPush = (data) => {
    // console.log(data);
  }

  const chatOllama = async (message, llm) => {
    chatMessages = [...chatMessages, { role: "user", content: message }];
    console.log({chatMessages});

    const response = await ollama.chat({
      model: llm,
      messages: chatMessages,
      stream: true,
    });

    let responseMessage = "";
    for await (const part of response) {
      responseMessage += part.message.content;
      
      const arrayMessage = responseMessage.split(/\n|\\n/g);
      const viewMessage = [
        arrayMessage.at(-4),
        arrayMessage.at(-3),
        arrayMessage.at(-2),
        arrayMessage.at(-1),
      ].join("\n");
      
      textareaPrompt.val = viewMessage;
    }

    textareaPrompt.val = "";

    const jsonString = jsonrepair(responseMessage);
    chatMessages = [...chatMessages, { role: "assistant", content: jsonString }];

    return JSON.parse(jsonString);
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

    return () => div({ class: `mt-4 card w-96 card-sm shadow-sm ${bgColor}`},
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
