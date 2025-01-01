function* eachSlice<T>(array: T[], size: number) {
  let start = 0;
  const len = array.length;
  const step = size < 1 ? 1 : size;
  while (start < len) {
    yield array.slice(start, start + step);
    start += step;
  }
  return;
}

export { eachSlice };
