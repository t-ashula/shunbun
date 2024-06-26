import { expect, describe, it, assert } from "vitest";

import type { Channel, ChannelSlug } from "../../core/types.mjs";
import type { ExtractorInput } from "./index.mjs";

import { ExtractorError, run } from "./index.mjs";

const TEST_CHANNEL: Channel = {
  slug: "test" as ChannelSlug,
  name: "test channel",
  crawlURL: "https://channel.test/feed",
  mediaURL: "https://channle.test/media",
  channelStatusId: 1,
};

describe("run", () => {
  it("return Failure when unsupported content", async () => {
    const input: ExtractorInput = {
      channel: TEST_CHANNEL,
      content: "",
    };

    const result = await run(input);
    assert(result.isFailure() === true); // FIXME: type
    expect(result.error).instanceOf(ExtractorError);
    expect(result.error.message).toEqual("unsupported content"); //
  });
});
