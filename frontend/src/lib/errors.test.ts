import { describe, expect, it } from 'vitest';

import { extractErrorDetail, isRetryableError, shouldRetryRequest } from './errors';

describe('extractErrorDetail', () => {
  it('returns a string detail from API errors', () => {
    expect(
      extractErrorDetail({
        isAxiosError: true,
        response: {
          data: {
            detail: 'Workspace not found',
          },
        },
      }),
    ).toBe('Workspace not found');
  });

  it('formats validation issue arrays into a readable message', () => {
    expect(
      extractErrorDetail({
        isAxiosError: true,
        response: {
          data: {
            detail: [
              {
                loc: ['body', 'email'],
                msg: 'value is not a valid email address',
              },
            ],
          },
        },
      }),
    ).toBe('body.email: value is not a valid email address');
  });
});

describe('retry helpers', () => {
  it('retries transient server errors', () => {
    const error = {
      isAxiosError: true,
      response: { status: 503 },
    };

    expect(isRetryableError(error)).toBe(true);
    expect(shouldRetryRequest(1, error, 2)).toBe(true);
    expect(shouldRetryRequest(2, error, 2)).toBe(false);
  });

  it('does not retry client validation errors', () => {
    const error = {
      isAxiosError: true,
      response: { status: 422 },
    };

    expect(isRetryableError(error)).toBe(false);
  });
});
