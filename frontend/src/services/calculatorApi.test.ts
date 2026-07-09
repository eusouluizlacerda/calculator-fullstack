import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError, NetworkError, calculate } from './calculatorApi';
import type { CalculateResponse } from '../types';

const fetchMock = vi.fn<typeof fetch>();
vi.stubGlobal('fetch', fetchMock);

afterEach(() => {
  fetchMock.mockReset();
});

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('calculate', () => {
  it('returns the parsed result on success', async () => {
    const payload: CalculateResponse = { result: 5, operation: 'add', operands: [2, 3] };
    fetchMock.mockResolvedValueOnce(jsonResponse(200, payload));

    const response = await calculate({ operation: 'add', operands: [2, 3] });

    expect(response).toEqual(payload);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/v1/calculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operation: 'add', operands: [2, 3] }),
    });
  });

  it('throws ApiError carrying detail on a 400 domain error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(400, { error: 'division_by_zero', detail: 'Cannot divide by zero' }),
    );

    const promise = calculate({ operation: 'divide', operands: [1, 0] });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    const error = (await promise.catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(400);
    expect(error.error).toBe('division_by_zero');
    expect(error.detail).toBe('Cannot divide by zero');
    expect(error.message).toBe('Cannot divide by zero');
  });

  it('throws ApiError carrying detail on a 422 validation error', async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse(422, { error: 'validation_error', detail: 'sqrt takes exactly 1 operand' }),
    );

    const promise = calculate({ operation: 'sqrt', operands: [4, 2] });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    const error = (await promise.catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(422);
    expect(error.detail).toBe('sqrt takes exactly 1 operand');
  });

  it('throws ApiError with a fallback body when the error response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('gateway timeout', { status: 502 }));

    const promise = calculate({ operation: 'add', operands: [1, 1] });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    const error = (await promise.catch((e: unknown) => e)) as ApiError;
    expect(error.status).toBe(502);
    expect(error.detail).toBe('Request failed with status 502');
  });

  it('throws ApiError when the success response has an unexpected shape', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, { total: 5, operation: 'add' }));

    const promise = calculate({ operation: 'add', operands: [2, 3] });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    const error = (await promise.catch((e: unknown) => e)) as ApiError;
    expect(error.error).toBe('invalid_response');
    expect(error.status).toBe(200);
  });

  it('throws ApiError when the success response is not JSON', async () => {
    fetchMock.mockResolvedValueOnce(new Response('ok', { status: 200 }));

    const promise = calculate({ operation: 'add', operands: [2, 3] });

    await expect(promise).rejects.toBeInstanceOf(ApiError);
    const error = (await promise.catch((e: unknown) => e)) as ApiError;
    expect(error.error).toBe('invalid_response');
  });

  it('surfaces a NetworkError distinct from ApiError when fetch rejects', async () => {
    const cause = new TypeError('Failed to fetch');
    fetchMock.mockRejectedValueOnce(cause);

    const promise = calculate({ operation: 'add', operands: [1, 2] });

    await expect(promise).rejects.toBeInstanceOf(NetworkError);
    const error = (await promise.catch((e: unknown) => e)) as NetworkError;
    expect(error).not.toBeInstanceOf(ApiError);
    expect(error.cause).toBe(cause);
  });
});
