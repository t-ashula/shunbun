import fs from "node:fs/promises";
import type { Result } from "../core/result.mjs";
import { Success, Failure } from "../core/result.mjs";
import type { Dirent } from "node:fs";
import { getLogger } from "./logger.mjs";

const logger = getLogger();
const listEntries = async <T,>(
  baseDir: string,
  filter: (_ent: Dirent) => boolean,
  mapper: (_ent: Dirent) => T,
): Promise<Result<T[], Error>> => {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    const dirs = entries.filter(filter).map(mapper);
    return new Success(dirs);
  } catch (err) {
    logger.error(`list dir entries failed. dir=${baseDir} err=${err}`);
    return new Failure(new Error(`list dirs entries failed`, { cause: err }));
  }
};

const listDirs = async (baseDir: string): Promise<Result<string[], Error>> => {
  return listEntries(
    baseDir,
    (ent) => ent.isDirectory(),
    (ent) => ent.name,
  );
};

const listFiles = async (baseDir: string): Promise<Result<string[], Error>> => {
  return listEntries(
    baseDir,
    (ent) => ent.isFile(),
    (ent) => ent.name,
  );
};

export { listDirs, listFiles };
