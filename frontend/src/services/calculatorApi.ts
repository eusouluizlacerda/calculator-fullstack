import { isOperation } from '../types';
import type { ApiErrorBody, CalculateRequest, CalculateResponse } from '../types';

const API_BASE = import.meta.env.VITE_API_URL ?? '';

export class ApiError extends Error {
  readonly status: number;
  readonly error: string;
  readonly detail: string;

  constructor(status: number, body: ApiErrorBody) {
    super(body.detail ?? body.error);
    this.name = 'ApiError';
    this.status = status;
    this.error = body.error;
    this.detail = body.detail;
  }
}

export class NetworkError extends Error {
  constructor(cause: unknown) {
    super('Could not reach the calculator service. Check your connection and try again.');
    this.name = 'NetworkError';
    this.cause = cause;
  }
}

function isApiErrorBody(value: unknown): value is ApiErrorBody {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return typeof record.error === 'string' && typeof record.detail === 'string';
}

function isCalculateResponse(value: unknown): value is CalculateResponse {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.result === 'number' &&
    typeof record.operation === 'string' &&
    isOperation(record.operation) &&
    Array.isArray(record.operands) &&
    record.operands.every((operand) => typeof operand === 'number')
  );
}

export async function calculate(request: CalculateRequest): Promise<CalculateResponse> {
  let response: Response;
  try {
    response = await fetch(API_BASE + '/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request),
    });
  } catch (cause) {
    throw new NetworkError(cause);
  }

  if (!response.ok) {
    let body: unknown = null;
    try {
      body = await response.json();
    } catch {
      body = null;
    }
    if (isApiErrorBody(body)) {
      throw new ApiError(response.status, body);
    }
    throw new ApiError(response.status, {
      error: 'unexpected_error',
      detail: `Request failed with status ${response.status}`,
    });
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!isCalculateResponse(body)) {
    throw new ApiError(response.status, {
      error: 'invalid_response',
      detail: 'The calculator service returned an unexpected response.',
    });
  }
  return body;
}
