import { Hono } from "hono";
import { html } from "hono/html";
import { logger } from "hono/logger";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

type Todo = {
  id: string;
  title: string;
};
let todos: Array<Todo> = [{ id: "1", title: "first todo" }];

const app = new Hono<{}>();
app.use(logger());

app.get("*", async (c, next) => {
  c.setRenderer((children) => {
    return c.html(`
      <!doctype html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://unpkg.com/htmx.org@1.9.3"></script>
          <script src="https://unpkg.com/hyperscript.org@0.9.9"></script>
          <script src="https://cdn.tailwindcss.com"></script>
          <title>shunbun.</title>
        </head>
        <body>
          <div class="p-4">
            <h1 class="text-4xl font-bold mb-4"><a href="/">Shunbun</a></h1>
            ${children}
          </div>
        </body>
      </html>
    `);
  });
  await next();
});

app.get("/", async (c) => {
  return c.render(
    html` <div>
      <form
        action="/todo"
        method="POST"
        hx-post="/todo"
        hx-target="#todo"
        hx-swap="beforebegin"
        _="on htmx:afterRequest reset() me"
        class="mb-4"
      >
        <div class="mb-2">
          <input
            name="title"
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

      ${todos.map((todo) => {
        return html` <p
          hx-delete="/todo/${todo.id}"
          hx-swap="outerHTML"
          class="flex row items-center justify-between py-1 px-4 my-1 rounded-lg text-lg border bg-gray-100 text-gray-600 mb-2"
        >
          ${todo.title}
          <button class="font-medium">Delete</button>
        </p>`;
      })}
      <div id="todo"></div>
    </div>`,
  );
});
app.post(
  "/todo",
  zValidator(
    "form",
    z.object({
      title: z.string().min(1),
    }),
  ),
  async (c) => {
    const { title } = c.req.valid("form");
    const id = crypto.randomUUID();
    todos.push({ id, title });
    return c.html(` <p
      hx-delete="/todo/${id}"
      hx-swap="outerHTML"
      class="flex row items-center justify-between py-1 px-4 my-1 rounded-lg text-lg border bg-gray-100 text-gray-600 mb-2"
    >
      ${title}
      <button class="font-medium">Delete</button>
    </p>`);
  },
);

export default app;
