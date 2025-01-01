import { html } from "hono/html";
import { jsxRenderer } from "hono/jsx-renderer";

const renderer = jsxRenderer(({ children }) => {
  return html`
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
        ${children}
      </body>
    </html>
  `;
});

export { renderer };
