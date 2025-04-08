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

export const showSourceCode = (data) => {
  // console.log({data});

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
