import { describe, expect, it } from 'vitest';
import { getApiErrorMessage } from './api-error';

describe('getApiErrorMessage', () => {
  it('prefers the selected backend response field', () => {
    const error = { response: { data: { message: 'Invalid credentials', detail: 'Other detail' } } };

    expect(getApiErrorMessage(error, 'message', 'Fallback')).toBe('Invalid credentials');
  });

  it('falls back to an Error message when the response field is absent', () => {
    expect(getApiErrorMessage(new Error('Network unavailable'), 'detail', 'Fallback'))
      .toBe('Network unavailable');
  });

  it('uses the generic fallback for unknown errors', () => {
    expect(getApiErrorMessage(null, 'message', 'Fallback')).toBe('Fallback');
  });
});