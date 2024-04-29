const tryParseDate = (raw: string | undefined): Date | undefined => {
  if (raw) {
    try {
      const d = new Date(raw);
      return d;
    } catch (err) {
      return undefined;
    }
  }
  return undefined;
};

export { tryParseDate };
