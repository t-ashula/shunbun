import { serve } from "@hono/node-server";

import app from "./index";

serve({
  fetch: app.fetch,
  port: 5173,
});
