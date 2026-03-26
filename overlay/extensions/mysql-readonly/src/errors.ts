export class MysqlReadonlyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MysqlReadonlyError";
  }
}
