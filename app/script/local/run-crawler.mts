import { run as crawler, CrawlerInput } from "../../crawler/index.mjs";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import { readFile } from "node:fs/promises";
import { Failure, Success, type Result } from "../../core/result.mjs";

const loadCrawlerInput = async (
  path: string
): Promise<Result<CrawlerInput, Error>> => {
  try {
    const d = await readFile(path, "utf-8");
    const input: CrawlerInput = JSON.parse(d);
    return new Success(input);
  } catch (e) {
    return new Failure(new Error(`load data error ${e}`));
  }
};

(async () => {
  const arg = await yargs(hideBin(process.argv))
    .option("url", {
      alias: "u",
      type: "string",
      description: "crawl target url",
    })
    .option("input", {
      alias: "i",
      type: "string",
      description: "crawler input json file path",
    })
    .check((argv) => {
      if (!argv.input && !argv.url) {
        throw new Error("Either --input or --url must be provided");
      }
      return true; // tell yargs that the arguments passed the check
    })
    .help()
    .alias("help", "h")
    .parse();

  const input: CrawlerInput = await (async (arg) => {
    if (arg.input) {
      return (await loadCrawlerInput(arg.input)).unwrap();
    }
    if (arg.url) {
      return { url: arg.url };
    }
    throw new Error("no url found");
  })(arg);

  const output = (await crawler(input)).unwrap();

  console.log(output);
})();
