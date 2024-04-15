import type { RequestInit } from "node-fetch"; // FIXME:
class Fetch {
  static async native(
    resource: string | URL | Request,
    init?: RequestInit
  ): Promise<Response> {
    return fetch(resource, init);
  }
}

export { Fetch };
