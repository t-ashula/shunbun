import fs from "node:fs/promises";
import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import type { Result } from "../../core/result.mjs";
import { Failure, Success } from "../../core/result.mjs";
import type { StoredEpisode } from "../../core/types.mjs";
import { isStoredEpisode } from "../../core/types.mjs";
import type { TranscriberInput } from "../../transcriber/index.mjs";
import { run as transcribe } from "../../transcriber/index.mjs";
import { save as saveTranscript } from "../../io/local/transcript.mjs";
import { getLogger } from "../../core/logger.mjs";

const logger = getLogger();

const TRANSCRIBER_API_ENDPOINT =
  process.env.TRANSCRIBER_API_ENDPOINT ?? "http://localhost:9000/transcribe";

const isTranscriberInput = (obj: any): obj is TranscriberInput => {
  return "episode" in obj && "config" in obj;
};

const loadInput = async (
  filePath: string,
): Promise<Result<StoredEpisode | TranscriberInput, Error>> => {
  try {
    const text = await fs.readFile(filePath, "utf-8");
    const data = JSON.parse(text);
    // TODO: model check
    if (isTranscriberInput(data)) {
      return new Success(data);
    }
    if (isStoredEpisode(data)) {
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
    .option("stored", {
      alias: "s",
      type: "string",
      description: "stored episode json file path",
    })
    .option("input", {
      alias: "i",
      type: "string",
      description: "transcriber input json file path",
    })
    .option("data-dir", {
      alias: "d",
      type: "string",
      description: "record save dir",
      default: "../data/",
    })
    .check((argv) => {
      if (!argv.stored && !argv.input) {
        throw new Error("Either --input or --stored must be provided");
      }
      return true;
    })
    .help()
    .alias("help", "h")
    .parse();

  const baseDir = path.resolve(arg.dataDir);
  const input = await (async (arg) => {
    if (arg.stored) {
      const stored = (await loadInput(arg.stored)).unwrap() as StoredEpisode;
      const ti: TranscriberInput = {
        storedEpisode: stored,
        config: { apiEndpoint: TRANSCRIBER_API_ENDPOINT },
      };
      return ti;
    }
    if (arg.input) {
      return (await loadInput(arg.input)).unwrap() as TranscriberInput;
    }
    throw new Error("no input found.");
  })(arg);

  const output = (await transcribe(input)).unwrap();
  logger.info(
    `transcribe done. text=${output.episodeTranscript.transcripts[0].text}`,
  );
  const saved = (
    await saveTranscript({
      values: [output.episodeTranscript],
      config: { baseDir },
    })
  ).unwrap();

  console.log(JSON.stringify(saved.saved));
})();
