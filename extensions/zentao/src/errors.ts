export class ZentaoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ZentaoError";
  }
}

export class ZentaoAuthError extends ZentaoError {
  constructor(message: string) {
    super(message);
    this.name = "ZentaoAuthError";
  }
}

export class ZentaoRequestError extends ZentaoError {
  readonly status: number;
  readonly path: string;

  constructor(message: string, status: number, path: string) {
    super(message);
    this.name = "ZentaoRequestError";
    this.status = status;
    this.path = path;
  }
}
