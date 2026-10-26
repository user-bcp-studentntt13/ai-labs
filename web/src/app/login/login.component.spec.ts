import '@angular/compiler';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { LoginComponent } from './login.component';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';

vi.mock('axios', () => ({
  default: {
    post: vi.fn(),
    get: vi.fn()
  }
}));

const storedValues = new Map<string, string>();
const storedSessionValues = new Map<string, string>();
const storage = {
  getItem: vi.fn((key: string) => storedValues.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storedValues.set(key, value)),
  removeItem: vi.fn((key: string) => storedValues.delete(key))
};
const sessionStorageMock = {
  getItem: vi.fn((key: string) => storedSessionValues.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storedSessionValues.set(key, value)),
  removeItem: vi.fn((key: string) => storedSessionValues.delete(key))
};

describe('LoginComponent characterization', () => {
  beforeEach(() => {
    storedValues.clear();
    storedSessionValues.clear();
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: storage
    });
    Object.defineProperty(globalThis, 'sessionStorage', {
      configurable: true,
      value: sessionStorageMock
    });
  });

  it('sends the existing login request and stores the session before navigating', async () => {
    storedValues.set('workshop_preferences', JSON.stringify({ theme: 'dark' }));
    vi.mocked(axios.post).mockResolvedValue({
      data: {
        token: 'test-token',
        user: { username: 'student', role: 'STUDENT' }
      }
    } as never);
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    const component = new LoginComponent(router as never, new AuthService(), new SessionService());
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(axios.post).toHaveBeenCalledWith(
      'http://localhost:8080/auth/login',
      { username: 'student', password: 'Workshop123!', client: 'angular-workshop' },
      { timeout: 5000 }
    );
    expect(storedSessionValues.get('workshop_token')).toBe('test-token');
    expect(storedSessionValues.get('workshop_user')).toBe(JSON.stringify({ username: 'student', role: 'STUDENT' }));
    expect(storedValues.get('workshop_preferences')).toBe(JSON.stringify({
      theme: 'dark',
      showTips: true,
      compact: false
    }));
    expect(router.navigate).toHaveBeenCalledWith(['/dashboard']);
  });

  it.each([
    { username: '', password: 'Workshop123!', message: { title: 'Ingrese un usuario.' } },
    { username: 'student', password: '', message: { title: 'Ingrese una contraseña.' } },
    { username: 'student', password: ' ', message: { title: 'Ingrese una contraseña.' } }
  ])('rejects missing credentials before making a request', async ({ username, password, message }) => {
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    const component = new LoginComponent(router as never, new AuthService(), new SessionService());
    component.username = username;
    component.password = password;

    await component.login();

    expect(component.message).toEqual(message);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('shows the existing message when the response has no token', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: { user: { username: 'student' } } } as never);
    const router = { navigate: vi.fn() };
    const component = new LoginComponent(router as never, new AuthService(), new SessionService());
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toEqual({ title: 'El backend respondió sin token.' });
    expect(storedSessionValues.size).toBe(0);
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows an authentication error when the response body is null', async () => {
    vi.mocked(axios.post).mockResolvedValue({ data: null } as never);
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = new LoginComponent({ navigate: vi.fn() } as never, new AuthService(), new SessionService());
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message?.title).toBe('No se pudo autenticar a student.');
    expect(component.message?.detail).toMatch(/token/i);
    expect(component.busy).toBe(false);
    consoleError.mockRestore();
  });

  it('renders the current authentication error content', async () => {
    vi.mocked(axios.post).mockRejectedValue({ response: { data: { message: 'Bad credentials' } } });
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = new LoginComponent({ navigate: vi.fn() } as never, new AuthService(), new SessionService());
    component.username = 'student';
    component.password = 'wrong';

    await component.login();

    expect(component.message).toEqual({
      title: 'No se pudo autenticar a student.',
      detail: 'Bad credentials'
    });
    expect(component.busy).toBe(false);
    consoleError.mockRestore();
  });

  it('shows an unavailable authentication service without creating a session', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('Network Error'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const router = { navigate: vi.fn() };
    const component = new LoginComponent(router as never, new AuthService(), new SessionService());
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toEqual({
      title: 'No se pudo autenticar a student.',
      detail: 'Network Error'
    });
    expect(component.busy).toBe(false);
    expect(storedSessionValues.size).toBe(0);
    expect(router.navigate).not.toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('shows the timeout message and always resets the busy state', async () => {
    vi.mocked(axios.post).mockRejectedValue(new Error('timeout of 5000ms exceeded'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const component = new LoginComponent({ navigate: vi.fn() } as never, new AuthService(), new SessionService());
    component.username = 'student';
    component.password = 'Workshop123!';

    await component.login();

    expect(component.message).toEqual({
      title: 'No se pudo autenticar a student.',
      detail: 'timeout of 5000ms exceeded'
    });
    expect(component.busy).toBe(false);
    consoleError.mockRestore();
  });
});