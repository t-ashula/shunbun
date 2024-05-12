type Brand<K, T> = K & { __brand: T };

type StreamingType = "static" | "stream" | "live";

type ChannelID = Brand<string, "ChannelID">;
type Channel = {
  id: ChannelID;
  name: string;
  crawlURL: string;
  mediaURL: string;
};

const hasKeys = (obj: any, keys: string[]): boolean => {
  if (obj) {
    return keys.every((key) => key in obj);
  }
  return false;
};
const isChannel = (obj: any): obj is Channel => {
  return hasKeys(obj, ["id", "name", "crawlURL", "mediaURL"]);
};

type EpisodeID = Brand<string, "EpisodeID">;
type Episode = {
  id: EpisodeID; // we generated
  theirId: string; // guid
  title: string;
  description: string;
  publishedAt: Date;
  streamURL: string;
  streaming: StreamingType;
  expectedContentType?: string;
  duration?: number; // in second
  startAt?: Date;
  endAt?: Date;
  channelId: ChannelID;
};
const isEpisode = (obj: any): obj is Episode => {
  return hasKeys(obj, ["id", "channelId"]);
};

type StorageType = "local";

type StoredEpisodeMeta = {
  storageType: StorageType;
  storedKey: string;
  storedAt: Date;
};

type StoredEpisode = {
  episode: Episode;
  stored: StoredEpisodeMeta[];
};

const isStoredEpisode = (obj: any): obj is StoredEpisode => {
  return hasKeys(obj, ["episode", "stored"]) && isEpisode(obj["episode"]);
};

type TranscriberAPIResponse = {
  text: string;
  lang: string;
  segments: {
    start: number;
    end: number;
    text: string;
  }[];
  stats?: Record<string, any>;
};

const isTranscriberAPIResponse = (obj: any): obj is TranscriberAPIResponse => {
  return hasKeys(obj, ["text", "lang", "segments"]);
};

type TranscriptSegment = {
  text: string;
  start: number;
  end: number;
};
type Transcript = {
  text: string;
  lang: string;
  segments: TranscriptSegment[];
};

export type {
  Channel,
  ChannelID,
  Episode,
  EpisodeID,
  StreamingType,
  StoredEpisode,
  StorageType,
  TranscriberAPIResponse,
  TranscriptSegment,
  Transcript,
};

export { isChannel, isEpisode, isStoredEpisode, isTranscriberAPIResponse };
