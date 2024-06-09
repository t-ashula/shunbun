type Brand<K, T> = K & { __brand: T };

type StreamingType = "static" | "stream" | "live";

const ChannelStatuses = {
  Registered: 0,
  Operating: 1,
  Retired: 2,
} as const;

type ChannelStatusID = (typeof ChannelStatuses)[keyof typeof ChannelStatuses];

type ChannelSlug = Brand<string, "ChannelSlug">;
type Channel = {
  slug: ChannelSlug;
  name: string;
  crawlURL: string;
  mediaURL: string;
  channelStatusId: ChannelStatusID;
};

const hasKeys = (obj: any, keys: string[]): boolean => {
  if (obj) {
    return keys.every((key) => key in obj);
  }
  return false;
};
const isChannel = (obj: any): obj is Channel => {
  return hasKeys(obj, ["slug", "name", "crawlURL", "mediaURL"]);
};

type EpisodeSlug = Brand<string, "EpisodeSlug">;
type Episode = {
  slug: EpisodeSlug; // we generated
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
  channelSlug: ChannelSlug;
};
const isEpisode = (obj: any): obj is Episode => {
  return hasKeys(obj, ["slug", "channelSlug"]);
};

type StorageType = "local";

type StoredEpisodeMeta = {
  storageType: StorageType;
  storedKey: string;
  storedAt: Date;
};

type StoredEpisode = {
  episodeSlug: EpisodeSlug;
  stored: StoredEpisodeMeta[];
};

const isStoredEpisode = (obj: any): obj is StoredEpisode => {
  // at least 1 stored info
  return (
    hasKeys(obj, ["episodeSlug", "stored"]) &&
    Array.isArray(obj["stored"]) &&
    hasKeys(obj["stored"][0], ["storageType", "storedKey", "storedAt"])
  );
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
type TranscriptSlug = Brand<string, "TranscriptSlug">;

type EpisodeTranscript = {
  slug: TranscriptSlug;
  episodeSlug: EpisodeSlug;
  transcripts: Transcript[];
  transcribedAt: Date;
};

const isTranscript = (obj: any): obj is Transcript => {
  return hasKeys(obj, ["text", "lang", "segments"]);
};
const isEpisodeTranscript = (obj: any): obj is EpisodeTranscript => {
  return hasKeys(obj, ["episodeSlug", "transcripts"]);
};

export type {
  Channel,
  ChannelSlug,
  Episode,
  EpisodeSlug,
  StreamingType,
  StoredEpisode,
  StorageType,
  TranscriptSlug,
  TranscriberAPIResponse,
  TranscriptSegment,
  Transcript,
  EpisodeTranscript,
};

export {
  isChannel,
  isEpisode,
  isStoredEpisode,
  isTranscriberAPIResponse,
  isTranscript,
  isEpisodeTranscript,
};
