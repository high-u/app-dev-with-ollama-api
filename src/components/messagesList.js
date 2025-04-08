import van from "vanjs-core";
import { showSourceCode } from "./showSourceCode.js";
import { gitForm } from "./gitForm.js";

/**
 * メッセージリストを処理する純粋関数
 */
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

/**
 * メッセージリストコンポーネント
 * @param {object} props - プロパティオブジェクト
 * @param {Array} props.messages - メッセージの配列（入力されたチャット履歴）
 * @param {string} props.workDir - 作業ディレクトリパス
 */
export const messagesList = (props) => {
  const { button, div, h2, li, p, ul } = van.tags;
  const { messages, workDir } = props;
  
  // メッセージの変更を監視して処理する
  const displayMessages = van.derive(() => processMessages(messages.val));
  
  return div(
    () => ul({class: ""},
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