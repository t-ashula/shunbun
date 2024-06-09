import type { Channel, ChannelStatus } from "@prisma/client";
import type { FC } from "hono/jsx";

const ChannelBar = ({ channel }: { channel: Channel }) => (
  <div>
    <div>
      <a href={`/channel/${channel.slug}`}>{channel.name}</a>
    </div>
  </div>
);

const SideChannels = ({ channels }: { channels: Channel[] }) => (
  <div>
    <h1>Channels</h1>
    <div id="channels">
      {channels.map((ch) => (
        <ChannelBar channel={ch} />
      ))}
    </div>
  </div>
);

const AddChannel = () => (
  <form
    hx-post="/channel"
    hx-target="#channels"
    hx-swap="beforebegin"
    _="on htmx:afterRequest reset() me"
    class="mb-4"
  >
    <div class="mb-2">
      Name:
      <input
        name="name"
        type="text"
        class="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2.5"
      />
    </div>
    <div class="mb-2">
      URL(crawl)
      <input
        name="crawl_url"
        type="text"
        class="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg p-2.5"
      />
    </div>
    <button
      class="text-white bg-blue-700 hover:bg-blue-800 rounded-lg px-5 py-2 text-center"
      type="submit"
    >
      Submit
    </button>
  </form>
);

const ChannelCard: FC<{ channel: Channel & { status: ChannelStatus } }> = ({
  channel,
}) => (
  <div>
    <h2>{channel.name}</h2>
    <p>
      <a href={channel.crawlURL}>{channel.name}</a>
    </p>
    <p>Status: {channel.status.name}</p>
    <p>Created: {channel.createdAt}</p>
    <p>Updated: {channel.updatedAt}</p>
  </div>
);

export { SideChannels, AddChannel, ChannelBar, ChannelCard };
