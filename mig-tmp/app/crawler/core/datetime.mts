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

const tryParseDuration = (hhmmss?: string): number | undefined => {
  if (!hhmmss || !/\d+:\d\d:\d\d/.test(hhmmss)) {
    return;
  }
  const [h, m, s] = hhmmss.split(":", 3);
  try {
    const duration =
      parseInt(h, 10) * 3600 + parseInt(m, 10) * 60 + parseFloat(s);
    if (Number.isNaN(duration)) {
      return;
    }
    return duration;
  } catch (error) {
    return;
  }
};

export { tryParseDate, tryParseDuration };
