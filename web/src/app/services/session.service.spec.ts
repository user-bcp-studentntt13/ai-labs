import '@angular/compiler';
import { beforeEach, describe, expect, it } from 'vitest';
import { SessionService } from './session.service';

const storedSessionValues = new Map<string, string>();
const sessionStorageMock = {
  getItem: (key: string) => storedSessionValues.get(key) ?? null,
  setItem: (key: string, value: string) => storedSessionValues.set(key, value),
  removeItem: (key: string) => storedSessionValues.delete(key)
};

describe('SessionService', () => {
  beforeEach(() => {
    storedSessionValues.clear();
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock
    });
  });

  it('stores and reads a tab-scoped session', () => {
    const service = new SessionService();
    const user = { username: 'student', role: 'STUDENT' };

    service.saveSession('test-token', user);

    expect(service.getToken()).toBe('test-token');
    expect(service.getUser()).toEqual(user);
  });

  it('clears both session values', () => {
    const service = new SessionService();
    service.saveSession('test-token', { username: 'student' });

    service.clearSession();

    expect(service.getToken()).toBeNull();
    expect(service.getUser()).toEqual({ username: '' });
  });

  it('returns an empty user when stored user data is malformed', () => {
    storedSessionValues.set('workshop_user', '{invalid');

    expect(new SessionService().getUser()).toEqual({ username: '' });
  });
});