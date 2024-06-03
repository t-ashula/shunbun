import { Hono } from "hono";
import { logger } from "hono/logger";
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";

import { renderer, AddTodo, Item } from "./components";

type Todo = {
  title: string;
  id: string;
};

let todos: Array<Todo> = [{ id: "1", title: "first todo" }];

const app = new Hono<{}>();
app.use(logger());

app.get("*", renderer);

app.get("/", async (c) => {
  return c.render(
    <div>
      <AddTodo />
      {todos.map((todo) => {
        return <Item title={todo.title} id={todo.id} />;
      })}
      <div id="todo"></div>
    </div>,
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
    return c.html(<Item title={title} id={id} />);
  },
);

app.delete("/todo/:id", async (c) => {
  const id = c.req.param("id");
  todos = todos.filter((t) => t.id !== id);
  c.status(200);
  return c.body(null);
});

export default app;
