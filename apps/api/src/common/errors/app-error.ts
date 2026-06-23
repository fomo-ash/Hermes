export class AppError extends Error {
  constructor(
    public statusCode: number,
    public errorCode: string,
  ) {
    super(errorCode);
  }
}
