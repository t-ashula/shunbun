import { Hono } from "hono";
import { logger } from "hono/logger";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { ulid } from "ulid";

import { renderer } from "./renderer";
import {
  TopBanner,
  SideChannels,
  AddChannel,
  ChannelBar,
  ChannelCard,
} from "./components/";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

const app = new Hono();
app.use(logger());

app.get("*", renderer);

app.get("/", async (c) => {
  const channels = await db.channel.findMany({ include: { status: true } });
  return c.render(
    <>
      <TopBanner>Shunbun. </TopBanner>
      <SideChannels channels={channels} />
      <AddChannel />
    </>,
  );
});
app.post(
  "/channel",
  zValidator(
    "form",
    z.object({
      name: z.string().min(1),
      crawl_url: z.string().url(),
    }),
  ),
  async (c) => {
    const { name, crawl_url: crawlURL } = c.req.valid("form");
    const channelId = ulid(); // TODO: Crete Channel function
    const ch = await db.channel.create({
      data: { name, crawlURL, channelId, channelStatusId: 0 },
    });
    return c.html(<ChannelBar channel={ch} />);
  },
);
app.get("/channel/:channelId", async (c) => {
  const ch = await db.channel.findFirst({
    where: { channelId: c.req.param("channelId") },
    include: { status: true },
  });
  if (ch === null) {
    return c.html(<h1>404</h1>, 404);
  }
  return c.render(<ChannelCard channel={ch} />);
});
export default app;
