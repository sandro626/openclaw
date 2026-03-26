export class SuperBrowerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SuperBrowerError";
  }
}
