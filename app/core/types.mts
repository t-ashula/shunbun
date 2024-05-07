type Brand<K, T> = K & { __brand: T };

type StreamingType = "static" | "stream" | "live";

type ChannelID = Brand<string, "ChannelID">;
type Channel = {
  id: ChannelID;
  name: string;
  crawlURL: string;
  mediaURL: string;
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
  duration?: number; // in second
  startAt?: Date;
  endAt?: Date;
  channelId: ChannelID;
};

type StorageType = "local";

type StoredEpisode = Episode & {
  storageType: StorageType;
  storedKey: string;
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
