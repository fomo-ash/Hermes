export const successResponse = <T>(data: T) => ({
  success: true,
  data,
  error: null,
});

export const errorResponse = (error: string) => ({
  success: false,
  data: null,
  error,
});
