type Brand<K, T> = K & { __brand: T };

type StreamingType = "static" | "stream" | "live";

type ChannelID = Brand<string, "ChannelID">;
type Channel = {
  id: ChannelID;
  name: string;
  crawlURL: string;
  mediaURL: string;
};

const isChannel = (obj: any): obj is Channel => {
  const keys = ["id", "name", "crawlURL", "mediaURL"];

  return keys.every((key) => key in obj);
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
  const keys = ["id", "channelId"]; // ?

  return keys.every((key) => key in obj);
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
export type {
  Channel,
  ChannelID,
  Episode,
  EpisodeID,
  StreamingType,
  StoredEpisode,
  StorageType,
};

export { isChannel, isEpisode };
