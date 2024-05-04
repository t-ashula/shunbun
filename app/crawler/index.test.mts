import {
  expect,
  describe,
  it,
  assert,
  beforeAll,
  beforeEach,
  afterEach,
  afterAll,
  vi,
} from "vitest";

import { HttpResponse } from "msw";
import type { Channel, ChannelID } from "../core/types.mts";
import { CrawlerError, run } from "./index.mjs";
import { run as download, DownloaderError } from "../downloader/index.mjs";
import { Failure, Success } from "../core/result.mjs";
import { ExtractorError } from "./extractor/index.mjs";

vi.mock("../downloader/index.mjs", async (importOriginal) => {
  const actual = await importOriginal();
  // @ts-ignore
  return { ...actual, run: vi.fn() };
});

beforeAll(() => {});
beforeEach(() => {});
afterEach(() => {
  vi.resetAllMocks();
});
afterAll(() => {});

const TEST_CHANNEL: Channel = {
  id: "test" as ChannelID,
  name: "test channel",
  crawlURL: "https://channel.test/feed",
  mediaURL: "https://channle.test/media",
};

const TEST_RSS = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:dc="http://purl.org/dc/elements/1.1/"
	xmlns:content="http://purl.org/rss/1.0/modules/content/"
	xmlns:atom="http://www.w3.org/2005/Atom" version="2.0"
	xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
	xmlns:podcast="https://podcastindex.org/namespace/1.0">
	<channel>
		<title><![CDATA[test podcast]]></title>
		<description><![CDATA[test podcast is test]]></description>
		<link>https://channel.test/media</link>
		<image>
			<url>https://channel.test/logo.png</url>
			<title>tet podcast</title>
			<link>https://channel.test/media</link>
		</image>
		<generator>TESTER</generator>
		<lastBuildDate>Sun, 14 Apr 2024 18:00:03 +0000</lastBuildDate>
		<atom:link href="https://channel.test/feed" rel="self" type="application/rss+xml"/>
		<copyright><![CDATA[@t-ashula]]></copyright>
		<language><![CDATA[ja]]></language>
		<itunes:author>@t-ashula</itunes:author>
		<itunes:summary>test podcast is test</itunes:summary>
		<itunes:type>episodic</itunes:type>
		<itunes:owner>
			<itunes:name>@t-ashula</itunes:name>
			<itunes:email>t.ashula+dev@gmail.com</itunes:email>
		</itunes:owner>
		<itunes:explicit>false</itunes:explicit>
		<itunes:category text="Society &amp; Culture">
			<itunes:category text="Personal Journals"/>
		</itunes:category>
		<itunes:image href="https://channle.test/logo.png"/>
		<podcast:locked>no</podcast:locked>
		<podcast:guid>eaf1c3ca-bb15-5541-9bb6-6c039848fdb2</podcast:guid>
		<item>
			<title><![CDATA[episode 2. last episode]]></title>
			<description><![CDATA[<p>EP2: the last episode</p> ]]></description>
			<link>https://channel.test/ep2</link>
			<guid isPermaLink="false">abcd002</guid>
			<dc:creator><![CDATA[@t-ashula]]></dc:creator>
			<pubDate>Fri, 29 Dec 2023 12:39:28 +0000</pubDate>
			<enclosure url="https://channel.test/ep2.mp3" length="11069089" type="audio/mpeg"/>
			<itunes:episodeType>Full</itunes:episodeType>
			<itunes:duration>00:22:15</itunes:duration>
			<itunes:summary>the last episode</itunes:summary>
			<itunes:explicit>false</itunes:explicit>
			<itunes:image href="https://channel.test/logo.png"/>
		</item>
		<item>
			<title><![CDATA[episode 1. first episode]]></title>
			<description><![CDATA[<p>EP1: the last episode</p>]]></description>
			<link>https://channel.test/ep1</link>
			<guid isPermaLink="false">abcd001</guid>
			<dc:creator><![CDATA[@t-ashula]]></dc:creator>
			<pubDate>Fri, 22 Dec 2023 12:39:28 +0000</pubDate>
			<enclosure url="https://channel.test/ep1.mp3" length="11069089" type="audio/mpeg"/>
			<itunes:episodeType>Full</itunes:episodeType>
			<itunes:duration>00:42:15</itunes:duration>
			<itunes:summary>the first episode</itunes:summary>
			<itunes:explicit>false</itunes:explicit>
			<itunes:image href="https://channel.test/logo.png"/>
		</item>
	</channel>
</rss>
`;

describe("run", () => {
  it("return a Failure when download failed.", async () => {
    // @ts-ignore; // FIXME
    download.mockImplementation(async () => {
      return new Failure(new DownloaderError("downloader something wrong."));
    });

    const input = { channel: TEST_CHANNEL };
    const result = await run(input);

    assert(result.isFailure() === true); // FIXME:

    expect(result.error).instanceOf(CrawlerError);
    expect(result.error.message).toEqual("download failed.");
    expect(result.error.cause).instanceOf(DownloaderError);
  });
  it("return a Failure when extractor failed.", async () => {
    // @ts-ignore; // FIXME
    download.mockImplementation(async () => {
      const output = {
        request: {},
        response: HttpResponse.text("<?xml>"),
      };
      return new Success(output);
    });

    const input = { channel: TEST_CHANNEL };
    const result = await run(input);

    assert(result.isFailure() === true); // FIXME:

    expect(result.error).instanceOf(CrawlerError);
    expect(result.error.message).toEqual("extraction failed.");
    expect(result.error.cause).instanceOf(ExtractorError);
  });
  it("return a Success when rss content", async () => {
    // @ts-ignore; // FIXME
    download.mockImplementation(async () => {
      const output = {
        request: {},
        response: HttpResponse.text(TEST_RSS, {
          headers: [["content-type", "application/rss+xml"]],
        }),
      };
      return new Success(output);
    });

    const input = { channel: TEST_CHANNEL };
    const result = await run(input);

    assert(result.isSuccess() === true, JSON.stringify(result)); // FIXME:
    const actual = result.value;
    expect(actual.channel).toStrictEqual(TEST_CHANNEL);
  });
});
