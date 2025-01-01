import { expect, describe, it, vi, assert, afterEach } from "vitest";

import { listDirs, listFiles } from "./file.mjs";

// TODO: more pragmatic
vi.mock("node:fs/promises", async (_importOriginal) => {
  return {
    default: {
      // ...(await importOriginal<typeof import("node:fs/promises")>()),
      readdir: async (dir: string, options?: { withFileTypes?: boolean }) => {
        console.log(dir);
        if (dir.endsWith("/success")) {
          assert(options);
          return [
            {
              isDirectory: () => false,
              isFile: () => true,
              name: "f1",
            },
            {
              isDirectory: () => true,
              isFile: () => false,
              name: "d1",
            },
          ];
        }
        if (dir.endsWith("/failure")) {
          throw new Error("mocked error");
        }
      },
    },
  };
});

describe("listDirs", () => {
  afterEach(async () => {
    vi.resetAllMocks();
  });
  it("return Success(string[]) with directories", async () => {
    const baseDir = "/list/dirs/success";
    const actual = await listDirs(baseDir);
    assert(actual.isSuccess() === true); // FIXME: type
    const dirs = actual.value;
    expect(dirs).toStrictEqual(["d1"]);
  });
  it("return Failure()", async () => {
    const baseDir = "/list/dirs/failure";
    const actual = await listDirs(baseDir);
    assert(actual.isFailure() === true); // FIXME: type
    expect(actual.error).instanceOf(Error);
    expect(actual.error.cause).instanceOf(Error); // FIXME:
  });
});
describe("listFiles", () => {
  afterEach(async () => {
    vi.resetAllMocks();
  });
  it("return Success(string[]) with files", async () => {
    const baseDir = "/list/files/success";
    const actual = await listFiles(baseDir);
    assert(actual.isSuccess() === true); // FIXME: type
    const dirs = actual.value;
    expect(dirs).toStrictEqual(["f1"]);
  });
  it("return Failure() when fs error", async () => {
    const baseDir = "/list/files/failure";
    const actual = await listFiles(baseDir);
    assert(actual.isFailure() === true); // FIXME: type
    expect(actual.error).instanceOf(Error);
    expect(actual.error.cause).instanceOf(Error); // FIXME:
  });
});
