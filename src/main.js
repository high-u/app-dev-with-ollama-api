// https://ytyaru.hatenablog.com/entry/2024/02/13/000000
// https://github.com/vanjs-org/van/discussions/21
// https://kazuya-engineer.com/2024/01/10/how-to-create-mark-down-editer-by-vue-marked-highlight-js/

import "./style.css";
import van from "vanjs-core";
import ollama from "ollama/browser";
import { Marked } from "marked";
import { markedHighlight } from "marked-highlight";
import hljs from "highlight.js";
import "highlight.js/styles/github-dark.css";

const { button, div, input, sup, textarea, pre, ul, li, select, option, p } =
  van.tags;

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

const addMessage = (message, role) => {
  // message = message.replace(/[\n]+/, "\n");
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
  console.log(html);

  const h = htmlToElement(html, "text/html");
  const a = div(
    { class: `card w-96 shadow-sm mb-4 w-full ${style}` },
    div(
      { class: "card-body" },
      div({ class: "whitespace-pre-wrap break-words markdown-element" }, h),
    ),
  );
  htmls.val = [a, ...htmls.val];
};

const send = async () => {
  const p = prompt.val;
  addMessage(p, "user");
  prompt.val = "";
  chatMessages = [...chatMessages, { role: "user", content: p }];

  const response = await ollama.chat({
    model: "qwen2.5-coder-7b-instruct-q2_k:v1",
    messages: chatMessages,
    stream: true,
  });

  for await (const part of response) {
    counter.val += part.message.content;
    replyArea.scrollTop = replyArea.scrollHeight;
  }
  chatMessages = [...chatMessages, { role: "assistant", content: counter.val }];
  addMessage(counter.val, "assistant");
  counter.val = "";
};

const counter = van.state("");
const prompt = van.state("HTML5 の雛形の作成と、その説明をお願いします。");

const dom5 = div(
  { class: "mb-2" },
  textarea({
    value: prompt,
    rows: 4,
    cols: 100,
    wrap: "soft",
    class: "textarea textarea-primary w-full",
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
  class: "textarea textarea-primary w-full ",
});
const dom1 = div({ class: "mb-4" }, replyArea);
const htmls = van.state([]);
let m = div({ class: "" }, () => div({ class: "" }, htmls.val));
const form = div(
  { class: "pt-8 flex items-center justify-center" },
  div({ class: "w-[800px]" }, dom5, sendBtn, dom1, m),
);

document.body.classList.add("bg-base-200", "min-h-screen");

van.add(document.body, form);
