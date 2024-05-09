import fs from "node:fs/promises";
import path from "node:path";
import type { Result } from "../core/result.mjs";
import { Success, Failure } from "../core/result.mjs";

const listDirs = async (baseDir: string): Promise<Result<string[], Error>> => {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const dirs = entries
      .filter((ent) => ent.isDirectory())
      .map((ent) => path.join(ent.path, ent.name));
    return new Success(dirs);
  } catch (err) {
    return new Failure(
      new Error(`list dirs failed. dir=${baseDir}`, { cause: err }),
    );
  }
};

export { listDirs };
