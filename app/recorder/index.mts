import fs from "node:fs/promises";
import path from "node:path";
import { match } from "ts-pattern";
import { fileTypeFromBuffer } from "file-type";
import mime from "mime";
import type { Result } from "../core/result.mjs";
import { Failure, Success } from "../core/result.mjs";
import type { Episode, StoredEpisode } from "../core/types.mjs";
import { getLogger } from "../core/logger.mjs";
import type { DownloaderInput } from "../downloader/index.mjs";
import { run as download } from "../downloader/index.mjs";
import { NotImplementedError } from "../core/errors.mjs";

type StoreConfig = {
  baseDir: string;
};

type RecorderInput = {
  episode: Episode;
  storeConfig: StoreConfig;
};

type RecorderOutput = {
  storedEpisode: StoredEpisode;
};
class RecorderError extends Error {}

const MEDIA_DIR = "media";

const logger = getLogger();

const guessMediaType = async (
  contentType: string,
  buffer: ArrayBuffer,
): Promise<{ ext: string; contentType: string }> => {
  const guess = await fileTypeFromBuffer(buffer);
  if (guess) {
    return { ext: guess.ext, contentType: guess.mime };
  }
  if (contentType) {
    const ext = mime.getExtension(contentType);
    if (ext) {
      return { ext, contentType };
    }
  }
  return { ext: "bin", contentType: "application/octet-stream" }; // TODO: default content type, ext
};

const staticRecording = async (
  input: RecorderInput,
): Promise<Result<RecorderOutput, RecorderError>> => {
  const { episode, storeConfig } = input;

  const di: DownloaderInput = {
    requestUrl: episode.streamURL,
  };
  const downloading = await download(di);
  if (downloading.isFailure()) {
    return new Failure(
      new RecorderError("download failed.", { cause: downloading.error }),
    );
  }

  const { response } = downloading.value;

  if (!response.ok) {
    return new Failure(
      new RecorderError(`response ng. status=${response.status}`),
    );
  }
  const contentType = response.headers.get("content-type") || "";
  // TODO: use Read/Write stream
  const buffer = await response.arrayBuffer();
  const mediaType = await guessMediaType(contentType, buffer);
  try {
    const mediaDir = path.join(
      storeConfig.baseDir,
      episode.channelId,
      episode.id,
      MEDIA_DIR,
    );
    await fs.mkdir(mediaDir, { recursive: true });

    const mediaFilePath = path.join(
      mediaDir,
      `${String(0).padStart(5, "0")}.${mediaType.ext}`, // TODO: fileId ?
    );
    await fs.writeFile(mediaFilePath, Buffer.from(buffer));

    const storedEpisode: StoredEpisode = {
      episode,
      stored: [
        {
          storageType: "local", // TODO: いる？
          storedAt: new Date(),
          storedKey: mediaFilePath,
        },
      ],
    };

    const output: RecorderOutput = { storedEpisode };
    return new Success(output);
  } catch (err) {
    // TODO: rollback media files
    return new Failure(new RecorderError("record failed.", { cause: err }));
  }
};

const run = async (
  input: RecorderInput,
): Promise<Result<RecorderOutput, RecorderError>> => {
  logger.debug(`recorder start input=${JSON.stringify(input)}`);

  const { episode } = input;
  const streamingType = episode.streaming;
  const result = match(streamingType)
    .with("static", async () => {
      return await staticRecording(input);
    })
    .otherwise(
      () =>
        // FIXME: type
        new Failure<RecorderOutput, RecorderError>(
          new RecorderError("unsupported streaming type", {
            cause: new NotImplementedError(`${streamingType}`),
          }),
        ),
    );
  return result;
};

export type { RecorderInput, RecorderOutput };
export { run, RecorderError };
