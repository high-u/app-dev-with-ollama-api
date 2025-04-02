import van from "vanjs-core";

export const globalState = {
  // messages: van.state({
  //   model: null,
  //   messages: [],
  //   stream: false,
  //   tools: null,
  //   format: null,
  // })
  messages: van.state([]),
}
