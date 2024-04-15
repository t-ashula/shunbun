import { run as crawler } from "../../crawler/index.mjs";

(async () => {
  const input = {};
  const output = (await crawler(input)).unwrap();

  console.log(output);
})();
