// downloader

import { Failure, Success, type Result } from "../core/result.mjs";
import { getLogger } from "../core/logger.mjs";

type RequestInit = globalThis.RequestInit; // FIXME:

type DownloaderInput = {
  requestUrl: string;

  player?: DownloadPlayers;
  method?: string;
  userAgent?: string;
  headers?: Record<string, string>;
  waitTimeout?: number;
};

type DownloaderOutput = {
  request: Request;
  response: Response;
};

type DownloadPlayers = "fetch";

class DownloaderError extends Error {}
class DownloaderTimeoutError extends DownloaderError {}

const DEFAULT_USER_AGENT = "Shunbun/1.0";
const logger = getLogger();

const stringify = async (content: string | Response): Promise<string> => {
  if (content instanceof Response) {
    return await content.text();
  } else {
    return content;
  }
};

const run = async (
  input: DownloaderInput,
): Promise<Result<DownloaderOutput, DownloaderError>> => {
  logger.debug(`Downloader.run called. input=${JSON.stringify(input)}`);

  const [init, defer] = generateInit(input);
  try {
    const request = new Request(new URL(input.requestUrl), init);
    const response = await fetch(request);
    const output: DownloaderOutput = {
      request,
      response,
    };
    return new Success(output);
  } catch (error) {
    logger.warn(`fetch failed. requestUrl=${input.requestUrl}, error=${error}`);
    return new Failure(new DownloaderError("fetch failed.", { cause: error }));
  } finally {
    defer();
  }
};

const generateInit = (input: DownloaderInput): [RequestInit, () => void] => {
  const DEFAULT_HEADERS = { "user-agent": DEFAULT_USER_AGENT };
  const method = input.method ?? "GET";
  const headers = new Headers(DEFAULT_HEADERS);
  if (input.headers) {
    for (const ky in input.headers) {
      headers.set(ky, input.headers[ky]);
    }
  }
  if (input.userAgent) {
    headers.set("user-agent", `${input.userAgent}`);
  }

  const withAbort = Boolean(input.waitTimeout && input.waitTimeout > 0);
  const [signal, defer] = withAbort
    ? (() => {
        const ac = new AbortController();
        const aborter = setTimeout(() => {
          ac.abort(
            new DownloaderTimeoutError(
              `timeout exceeded. ${input.waitTimeout}`,
            ),
          );
        }, input.waitTimeout);
        const defer = () => {
          clearTimeout(aborter);
        };
        return [ac.signal, defer];
      })()
    : [undefined, () => {}];

  const init = {
    method,
    headers,
    signal,
  };

  return [init, defer];
};

export type { DownloaderInput, DownloaderOutput };
export { run, stringify, DownloaderError, DownloaderTimeoutError };
