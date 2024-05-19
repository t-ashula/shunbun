import path from "node:path";
import yargs from "yargs";
import { hideBin } from "yargs/helpers";

import { eachSlice } from "../../core/array.mjs";
import { type Channel, type EpisodeTranscript } from "../../core/types.mjs";
import { getLogger } from "../../core/logger.mjs";
import { run as crawl } from "../../crawler/index.mjs";
import { run as record } from "../../recorder/index.mjs";
import { run as transcribe } from "../../transcriber/index.mjs";
import { load as loadChannels } from "../../io/local/channel.mjs";
import {
  save as saveEpisodes,
  load as loadEpisodes,
} from "../../io/local/episode.mjs";
import {
  save as saveTranscript,
  load as loadTranscript,
} from "../../io/local/transcript.mjs";

const PARALLEL = 5;
const TRANSCRIBER_API_ENDPOINT =
  process.env.TRANSCRIBER_API_ENDPOINT ?? "http://localhost:9000/transcribe";
const logger = getLogger();

const crawlToTranscript = async (
  channel: Channel,
  baseDir: string
): Promise<EpisodeTranscript[]> => {
  // crawl and save new episode
  const crawledEpisodes = (await crawl({ channel })).unwrap().episodes;
  await saveEpisodes({
    values: crawledEpisodes,
    config: { baseDir },
  });

  // reload all episodes
  const allEpisodes = (
    await loadEpisodes({
      config: { channelId: channel.id, baseDir },
    })
  ).unwrap().values;

  const results = [];
  for (const episodes of eachSlice(allEpisodes, PARALLEL)) {
    // record
    const recordings = await Promise.all(
      episodes.map(async (episode) => {
        return {
          episodeId: episode.id,
          result: await record({ episode, storeConfig: { baseDir } }),
        };
      })
    );
    const recordedEpisodes = recordings
      .map(({ episodeId, result }) => {
        if (result.isFailure()) {
          logger.warn(
            `recording failed. channelId=${channel.id} episodeId=${episodeId}`
          );
          return [];
        }
        logger.info(
          `recording success. channelId=${channel.id} episodeId=${episodeId}`
        );
        return result.value.storedEpisode;
      })
      .flat();
    // transcribe
    const episodeTranscripts = [];
    for (const recorded of recordedEpisodes) {
      // TODO: skip flag.
      const checking = await loadTranscript({
        config: {
          baseDir,
          channelId: channel.id,
          episodeId: recorded.episodeId,
        },
      });
      if (checking.isSuccess()) {
        logger.info(
          `episode has transcript. channel=${channel.id} episode=${recorded.episodeId}`
        );
        continue;
      }
      const transcribing = await transcribe({
        storedEpisode: recorded,
        config: { apiEndpoint: TRANSCRIBER_API_ENDPOINT },
      });
      if (transcribing.isFailure()) {
        logger.warn(
          `transcribe failed. channel=${channel.id} episode=${recorded.episodeId}`
        );
      } else {
        logger.info(
          `transcribe success. channel=${channel.id} episode=${recorded.episodeId}`
        );
        const episodeTranscript = transcribing.value.episodeTranscript;
        episodeTranscripts.push(episodeTranscript);
      }
    }
    const savedTranscripts = (
      await saveTranscript({
        values: episodeTranscripts,
        config: { baseDir },
      })
    ).unwrap().saved;
    results.push(savedTranscripts);
  }
  return results.flat();
};

(async () => {
  const arg = await yargs(hideBin(process.argv))
    .option("data-dir", {
      alias: "d",
      type: "string",
      description: "episode save dir",
      default: "../data/",
    })
    .help()
    .alias("help", "h")
    .parse();

  const baseDir = path.resolve(arg.dataDir);
  const allChannels = (await loadChannels({ config: { baseDir } })).unwrap()
    .values;
  logger.debug(`load channels done. count=${allChannels.length}`);
  for (const channels of eachSlice(allChannels, PARALLEL)) {
    const results = await Promise.all(
      channels.map(async (channel) => crawlToTranscript(channel, baseDir))
    );
    console.log(results);
  }
})();
