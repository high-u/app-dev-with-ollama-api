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
    sup,
    textarea,
    pre,
    ul,
    li,
    select,
    option,
    p,
    form,
    label,
    a,
    span,
    del,
    
    h2,
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

  const deploy = (message) => {
    // console.log(message);
  };

  const addMessage = (message, role, files) => {
    // message = message.replace(/[\n]+/, "\n");
    // console.log({ message });
    // console.log({ files });

    const style = ((role) => {
      if (role === "user") {
        return "bg-base-300";
      } else {
        return "bg-base-100";
      }
    })(role);

    function htmlToElement(html) {
      var template = document.createElement("template");
      html = html.trim();
      template.innerHTML = html
        .replace(/[\n\s]+(<p>|<li>|<ul>|<ol>)/g, "$1")
        .replace(/(<\/p>|<\/li>|<\/ul>|<\/ol>)[\n\s]+/g, "$1");
      return template.content;
    }

    const html = markedWithHighlight.parse(message);
    // const htmlMinify = html.replace(/>[\n\s]+/g, ">").replace(/[\n\s]+</, "<");
    // console.log(html);

    // const gitBranch = van.state("");
    // const gitURL = van.state("");
    // const gitCommitMessage = van.state("");
    // const gitRemote = van.state("");

    const example2 = () => {
      const closed = van.state(false);
      const formDom = form(
        div(
          label({ for: "git-branch", class: "block" }, "Branch"),
          input({
            id: "git-branch",
            name: "git-branch",
            type: "text",
            class: "block input w-full",
            placeholder: "main",
            value: "main",
          }),
        ),
        div(
          label({ for: "git-url", class: "block" }, "URL"),
          input({
            id: "git-url",
            name: "git-url",
            type: "text",
            class: "block input w-full",
            placeholder: "https://github.com/org/repo.git",
            value: "",
          }),
        ),
        div(
          label({ for: "git-remote", class: "block" }, "Remote"),
          input({
            id: "git-remote",
            name: "git-remote",
            type: "text",
            class: "block input w-full",
            placeholder: "origin",
            value: "origin",
          }),
        ),
        div(
          label({ for: "git-commitmessage", class: "block" }, "Commit Message"),
          input({
            id: "git-commitmessage",
            name: "git-commitmessage",
            type: "text",
            class: "block input w-full",
            placeholder: "",
            value: "Add application",
          }),
        ),
      );

      const onOk = async () => {
        const gitBranch = formDom.querySelector("#git-branch").value;
        const gitUrl = formDom.querySelector("#git-url").value;
        const gitRemote = formDom.querySelector("#git-remote").value;
        const gitCommitMessage =
          formDom.querySelector("#git-commitmessage").value;
        // console.log(
        //   { gitBranch },
        //   { gitUrl },
        //   { gitRemote },
        //   { gitCommitMessage },
        // );
        closed.val = true;

        if (gitBranch && gitUrl && gitUrl && gitCommitMessage) {
          const res = await fetch("http://localhost:3001/api/push-to-github", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              branch: {
                ref: gitBranch,
              },
              commit: {
                message: gitCommitMessage,
              },
              push: {
                url: gitUrl,
                remote: gitRemote,
              },
              files: files,
            }),
          });
          const resJson = await res.json();
          // console.log({ resJson });

          addMessage(resJson.message, "tool", []);
        }
      };

      van.add(
        document.body,
        Modal(
          { closed, blurBackground: true, clickBackgroundToClose: true },
          p("What's your favorite programming language?"),
          formDom,
          div(
            { class: "flex flex-row-reverse" },
            button(
              {
                onclick: onOk,
                class: "btn btn-secondary inline-block mt-4 ml-4",
              },
              "Push",
            ),
            button(
              {
                onclick: () => (closed.val = true),
                class: "btn btn-outline btn-secondary mt-4",
              },
              "Cancel",
            ),
          ),
        ),
      );
    };

    const hidden = files.length === 0 ? "hidden" : "";
    const h = htmlToElement(html, "text/html");
    const a = div(
      { class: `card w-96 shadow-sm mb-4 w-full ${style}` },
      div(
        { class: "card-body" },
        div(
          { class: `grid justify-items-end ${hidden}` },
          button(
            {
              class: "btn btn-secondary",
              onclick: async () => {
                // console.log(JSON.stringify(files));

                example2();

                //
              },
            },
            "git push",
          ),
        ),
        div({ class: "whitespace-pre-wrap break-words markdown-element" }, h),
      ),
    );
    htmls.val = [a, ...htmls.val];
  };

  const send = async () => {
    const llmName = selectedLlm.val;
    const p = prompt.val;
    addMessage(p, "user", []);
    prompt.val = "";
    chatMessages = [...chatMessages, { role: "user", content: p }];

    const response = await ollama.chat({
      model: llmName,
      messages: chatMessages,
      stream: true,
    });

    for await (const part of response) {
      counter.val += part.message.content;
      // console.log(part.message);
      replyArea.scrollTop = replyArea.scrollHeight;
    }

    const assistantReply = counter.val;
    const hoge = assistantReply.replace(/(```json\n|\n```)/g, "");
    // console.log({ assistantReply });
    // console.log(JSON.stringify(JSON.parse(hoge), null, "  "));

    chatMessages = [
      ...chatMessages,
      { role: "assistant", content: counter.val },
    ];

    // LLM から不完全な JSON が返ることがあるからリペア。
    // それとストリーミングで受け取ったjsonを読み込む場合などに利用できそう。
    // console.log({ hoge });
    const json = JSON.parse(jsonrepair(hoge));
    // console.log(JSON.stringify(json, null, "  "));

    let markdown = "";
    for (const e of json.files) {
      markdown += `## ${e.filename}

\`\`\`${e.language}
${e.content}
\`\`\`

${e.explanation}
`;
    }
    markdown += `\n\n${json.explanation}`;
    addMessage(markdown, "assistant", json.files);

    counter.val = "";
  };

  const counter = van.state("");
  const prompt = van.state(
    "タスク管理Webアプリケーションを HTML、JavaScript、CSS の 3 ファイルで作成してください。",
  );

  const storeLlm = localStorage.getItem("llm");
  const selectedLlm = van.state(storeLlm);

  const llms = await ollama.list();
  // console.log(llms);

  const modelList = div(
    { class: "mb-2" },
    select(
      {
        class: "select",
        oninput: (e) => {
          selectedLlm.val = e.target.value;
          localStorage.setItem("llm", e.target.value);
        },
      },
      llms.models
        .sort((a, b) => (a.model > b.model ? 1 : -1))
        .map((e) => option({ selected: () => storeLlm === e.model }, e.model)),
    ),
  );

  const dom5 = div(
    { class: "mb-2" },
    textarea({
      value: prompt,
      rows: 4,
      cols: 100,
      wrap: "soft",
      class: "textarea w-full",
      oninput: (e) => (prompt.val = e.target.value),
    }),
  );

  const sendBtn = div(
    { class: "mb-4" },
    button({ onclick: send, class: "btn btn-primary w-full" }, "Send"),
  );

  const replyArea = textarea({
    value: counter,
    rows: 8,
    cols: 100,
    wrap: "soft",
    class: "textarea w-full ",
  });
  const dom1 = div({ class: "mb-4" }, replyArea);
  const htmls = van.state([]);
  let m = div({ class: "" }, () => div({ class: "" }, htmls.val));

  const chatForm = div(
    { class: "pt-8 flex items-center justify-center" },
    div({ class: "w-[800px]" }, modelList, dom5, sendBtn, dom1, m),
  );

  document.body.classList.add("bg-base-200", "min-h-screen");


  ////////
  // <div class="card w-96 bg-base-100 card-xs shadow-sm">
  //   <div class="card-body">
  //     <h2 class="card-title">Xsmall Card</h2>
  //     <p>A card component has a figure, a body part, and inside body there are title and actions parts</p>
  //     <div class="justify-end card-actions">
  //       <button class="btn btn-primary">Buy Now</button>
  //     </div>
  //   </div>
  // </div>

  const textareaPrompt = van.state("");

  const gitPush = (data) => {
    // console.log(data);
  }

  const chatOllama = async (message, llm) => {
    // console.log(message, llm);
    
    // const p = message;
    // addMessage(p, "user", []);
    // prompt.val = "";
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

// <button class="btn btn-circle">
//   <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2.5" stroke="currentColor" class="size-[1.2em]"><path stroke-linecap="round" stroke-linejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z" /></svg>
// </button>
// <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
//  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
//  </svg>
  
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
      class: "btn btn-primary",
      onclick: async () => {
        messages.val = [
          TodoItem({explanation: inputDom.value, files: []}, "user"),
          ...messages.val
        ];
        const res = await chatOllama(inputDom.value, selectedLlm.val);
        // const dm = displayMessage(res);
        // console.log(dm);
        messages.val = [
          TodoItem(res, "assistant"),
          ...messages.val
        ];

    }}, "Send");
    const dom = div(
      div(inputDom),
      div(buttonSend),
      div(...messages.val),
    );
    return dom;
  }
  ////////

  van.add(document.body, chatForm, TodoList);

  chatMessages = [{ role: "system", content: systemPrompt }];
})();

/*
<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="1.5" stroke="currentColor" class="size-6">
  <path stroke-linecap="round" stroke-linejoin="round" d="M6 18 18 6M6 6l12 12" />
</svg>
*/