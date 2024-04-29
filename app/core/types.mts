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
  published_at: string; // ISO String format
  streamURL: string;
  streaming: StreamingType;
  duration?: number; // in second
  start_at?: string;
  end_at?: string;
  channelId?: ChannelID;
};

export type { Channel, ChannelID, Episode, EpisodeID };
