import van from "vanjs-core";

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

export const settingsForm = (data) => {
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
      button({
        class: "btn btn-primary flex-1",
        onclick: () => {
          // gitPush関数を呼び出す
          // gitPush(data, workDir, repoUrl.val, email.val, username.val, password.val);
          // フォームを閉じる
          deleted.val = true;
        }
      }, "Push to Repository"),
    ),
  );
};