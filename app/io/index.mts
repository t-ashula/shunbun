import type { Result } from "../core/result.mjs";

type LoaderInput<ConfigType> = {
  config: ConfigType;
};
type LoaderOutput<ValueType> = {
  values: ValueType[];
};

class LoaderError extends Error {}

type SaverInput<ValueType, ConfigType> = {
  values: ValueType[];
  config: ConfigType;
};
type SaverOutput<ValueType, ImplOutput> = {
  saved: ValueType[];
  results: SaverResult<ImplOutput>[];
};

type SaverResult<ImplOutput> = Result<ImplOutput, SaverError>;

class SaverError extends Error {}

export type { LoaderInput, LoaderOutput };
export type { SaverInput, SaverOutput, SaverResult };
export { LoaderError, SaverError };
