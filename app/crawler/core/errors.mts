class NotImplementedError extends Error {
  static {
    this.prototype.name = "NotImplementedError";
  }
  constructor(message: string) {
    super(message);
  }
}
export { NotImplementedError };
