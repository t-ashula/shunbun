type Result<T, E> = Success<T, E> | Failure<T, E>;

class Success<T, E> {
  constructor(readonly value: T) {
    this.value = value;
  }

  unwrap(): T {
    return this.value;
  }

  isSuccess(): this is Success<T, E> {
    return true;
  }
  isFailure(): this is Failure<T, E> {
    return false;
  }
}

class Failure<T, E> {
  constructor(readonly error: E) {
    this.error = error;
  }

  unwrap(): void {
    throw this.error;
  }

  isSuccess(): this is Success<T, E> {
    return false;
  }
  isFailure(): this is Failure<T, E> {
    return true;
  }
}

export type { Result };
export { Success, Failure };
