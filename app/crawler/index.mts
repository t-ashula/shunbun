// crawler

import { Failure, Success, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";
import {
  run as download,
  type DownloaderInput,
  type DownloaderOutput,
} from "../downloader/index.mjs";
import { NotImplementedError } from "../core/errors.mjs";

type CrawlerInput = {
  url: string;
};
type CrawlerOutput = {
  url: string;
};
class CrawlerError extends Error {}

const logger = getLogger();

const run = async (
  input: CrawlerInput
): Promise<Result<CrawlerOutput, CrawlerError>> => {
  logger.debug(`crawler.run called. input=${JSON.stringify(input)}`);

  const di: DownloaderInput = {
    requestUrl: input.url,
  };

  const downloaded = await download(di);
  if (downloaded.isFailure()) {
    return new Failure(
      new CrawlerError("download failed.", { cause: downloaded.error })
    );
  }
  const content = downloaded.value;
  const tasks = (await extractRecordingInfo(content)).map((ri) =>
    convertTask(ri)
  );
  const output = {
    url: input.url, //
    tasks: tasks,
  };
  return new Success(output);
};

const extractRecordingInfo = async (
  content: DownloaderOutput
): Promise<RecordingInfo[]> => {
  const extractor = await selectExtractor(content);
  const infos = await extractor(content);
  return infos;
};

type ExtractFunction = (_: DownloaderOutput) => Promise<RecordingInfo[]>;

const selectExtractor = async (
  _content: DownloaderOutput
): Promise<ExtractFunction> => {
  throw new NotImplementedError("htmlExtractor");
};

type RecordingInfo = {
  url: string;
};
type RecordingTask = {
  url: string;
};
const convertTask = async (info: RecordingInfo): Promise<RecordingTask> => {
  const task: RecordingTask = { url: info.url };
  return task;
};

export type { CrawlerInput, CrawlerOutput };
export { run, CrawlerError };
