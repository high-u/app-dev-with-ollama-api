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
import { jsonrepair } from "jsonrepair";
import { systemPrompt } from "./const.js";

(async () => {
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
    const llmName = selectedLlm.val;
    const p = prompt.val;
    addMessage(p, "user");
    prompt.val = "";
    chatMessages = [...chatMessages, { role: "user", content: p }];

    const response = await ollama.chat({
      model: llmName,
      messages: chatMessages,
      stream: true,
    });

    for await (const part of response) {
      counter.val += part.message.content;
      console.log(part.message);
      replyArea.scrollTop = replyArea.scrollHeight;
    }

    const assistantReply = counter.val;
    const hoge = assistantReply.replace(/(```json\n|\n```)/g, "");
    console.log({ assistantReply });
    console.log(JSON.stringify(hoge, null, "  "));

    chatMessages = [
      ...chatMessages,
      { role: "assistant", content: counter.val },
    ];

    // LLM から不完全な JSON が返ることがあるからリペア。
    // それとストリーミングで受け取ったjsonを読み込む場合などに利用できそう。
    const json = JSON.parse(jsonrepair(hoge));
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

    addMessage(markdown, "assistant");
    counter.val = "";
  };

  const counter = van.state("");
  const prompt = van.state(
    "タスク管理Webアプリケーションを HTML、JavaScript、CSS の 3 ファイルで作成してください。",
  );

  const storeLlm = localStorage.getItem("llm");
  const selectedLlm = van.state(storeLlm);

  const llms = await ollama.list();
  console.log(llms);

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
  const form = div(
    { class: "pt-8 flex items-center justify-center" },
    div({ class: "w-[800px]" }, modelList, dom5, sendBtn, dom1, m),
  );

  document.body.classList.add("bg-base-200", "min-h-screen");

  van.add(document.body, form);

  chatMessages = [{ role: "system", content: systemPrompt }];
})();

// https://regex101.com/

/*
=== FILE: ([^ =]+) ===[\n\s]*```(?:\w+)?\n([\s\S]*?)\n```
*/

/*
=== FILE: index.html ===

```html
<html>
    <body>
        あいうえお
    </body>
</html>
```

=== FILE: main.js ===

```js
const hoge = "hoge";
if (hoge === "hoge") {
  console.log("hoge");
}
```

=== FILE: style.css ===

```css
body {
    background-color: white;
    padding: 8rem;
}
```
*/
