import fs from "node:fs/promises";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { Episode } from "../../core/types.mjs";
import { isEpisode } from "../../core/types.mjs";
import type { RecorderInput } from "../../recorder/index.mjs";
import { run as record } from "../../recorder/index.mjs";
import { save as saveStored } from "../../io/local/stored.mjs";
import path from "node:path";

const isRecorder = (obj: any): obj is RecorderInput => {
  return "episode" in obj;
};

const loadInput = async (
  filePath: string,
): Promise<Result<Episode | RecorderInput, Error>> => {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    // TODO: model check
    if (isRecorder(data)) {
      return new Success(data);
    }
    if (isEpisode(data)) {
      return new Success(data);
    }
    return new Failure(
      new Error(`unknown input file found. path=${filePath} `),
    );
  } catch (err) {
    return new Failure(
      new Error(`load input failed. path=${filePath}`, { cause: err }),
    );
  }
};

(async () => {
  const arg = await yargs(hideBin(process.argv))
    .option("episode", {
      alias: "e",
      type: "string",
      description: "episode json file path",
    })
    .option("input", {
      alias: "i",
      type: "string",
      description: "recorder input json file path",
    })
    .option("data-dir", {
      alias: "d",
      type: "string",
      description: "record save dir",
      default: "../data/",
    })
    .check((argv) => {
      if (!argv.episode && !argv.input) {
        throw new Error("Either --input or --episode must be provided");
      }
      return true;
    })
    .help()
    .alias("help", "h")
    .parse();

  const baseDir = path.resolve(arg.dataDir);
  const input = await (async (arg) => {
    if (arg.episode) {
      const episode = (await loadInput(arg.episode)).unwrap() as Episode;
      const ri: RecorderInput = {
        episode,
        storeConfig: { baseDir },
      };
      return ri;
    }
    if (arg.input) {
      return (await loadInput(arg.input)).unwrap() as RecorderInput;
    }
    throw new Error("no input found.");
  })(arg);

  const output = (await record(input)).unwrap();
  console.log(
    `record done. media path=${output.storedEpisode.stored[0].storedKey}`,
  );
  const saved = (
    await saveStored({
      values: [output.storedEpisode],
      config: { baseDir },
    })
  ).unwrap();

  console.log(JSON.stringify(saved.saved));
})();
