type ResponseMessageField = 'message' | 'detail';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getApiErrorMessage(
  error: unknown,
  responseField: ResponseMessageField,
  fallback: string
): string {
  if (isRecord(error) && isRecord(error.response) && isRecord(error.response.data)) {
    const responseMessage = error.response.data[responseField];
    if (typeof responseMessage === 'string') {
      return responseMessage;
    }
  }

  if (isRecord(error) && typeof error.message === 'string') {
    return error.message;
  }

  return fallback;
}