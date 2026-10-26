import '@angular/compiler';
import axios from 'axios';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DashboardComponent } from './dashboard.component';
import { LoginComponent } from '../login/login.component';
import { AuthService } from '../services/auth.service';
import { TasksService } from '../services/tasks.service';
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

describe('DashboardComponent characterization', () => {
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

  it('logs in successfully and then loads tasks with the new session', async () => {
    vi.mocked(axios.post).mockResolvedValue({
      data: { token: 'test-token', user: { username: 'student' } }
    } as never);
    vi.mocked(axios.get).mockResolvedValue({
      data: [{ title: 'First task', status: 'TODO', priority: 'HIGH', owner: 'student' }]
    } as never);
    const loginRouter = { navigate: vi.fn().mockResolvedValue(true) };
    const login = new LoginComponent(loginRouter as never, new AuthService(), new SessionService());
    login.username = 'student';
    login.password = 'Workshop123!';

    await login.login();

    const dashboardRouter = { navigate: vi.fn().mockResolvedValue(true) };
    const dashboard = new DashboardComponent(
      dashboardRouter as never,
      { detectChanges: vi.fn() } as never,
      { run: (callback: () => void) => callback() } as never,
      new SessionService(),
      new TasksService()
    );
    await dashboard.ngOnInit();

    expect(loginRouter.navigate).toHaveBeenCalledWith(['/dashboard']);
    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(dashboard.visibleTasks.map((task: { title: string }) => task.title)).toEqual(['First task']);
    expect(dashboard.error).toBe('');
    expect(dashboard.loading).toBe(false);
  });

  it('requests tasks with the stored owner and bearer token, then filters and sorts them', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    storedSessionValues.set('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { title: 'Low', status: 'TODO', priority: 'LOW', owner: 'student' },
        { title: 'Archived', status: 'ARCHIVED', priority: 'HIGH', owner: 'student' },
        { title: 'High', status: 'IN_PROGRESS', priority: 'HIGH', owner: 'student' }
      ]
    } as never);
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    const changeDetector = { detectChanges: vi.fn() };
    const zone = { run: (callback: () => void) => callback() };
    const component = new DashboardComponent(
      router as never,
      changeDetector as never,
      zone as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=student', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(component.tasks).toHaveLength(3);
    expect(component.visibleTasks.map((task: { title: string }) => task.title)).toEqual(['Low', 'High']);
    expect(component.visibleTasks[0].label).toBe('LOW · STUDENT');
    expect(component.statusLabel('TODO')).toBe('Por hacer');
    expect(component.statusLabel('UNKNOWN')).toBe('UNKNOWN');
    expect(component.statusLabel(undefined)).toBe('');
    expect(component.loading).toBe(false);
    expect(changeDetector.detectChanges).toHaveBeenCalledOnce();
  });

  it('redirects to login and skips the tasks request when there is no token', async () => {
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    const component = new DashboardComponent(
      router as never,
      { detectChanges: vi.fn() } as never,
      { run: vi.fn() } as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(router.navigate).toHaveBeenCalledWith(['/login']);
    expect(axios.get).not.toHaveBeenCalled();
  });

  it('uses an empty owner and default labels when stored user and task fields are missing', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    vi.mocked(axios.get).mockResolvedValue({
      data: [
        { title: 'First' },
        { title: 'Second' }
      ]
    } as never);
    const zone = { run: (callback: () => void) => callback() };
    const component = new DashboardComponent(
      { navigate: vi.fn() } as never,
      { detectChanges: vi.fn() } as never,
      zone as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(axios.get).toHaveBeenCalledWith('http://localhost:8000/api/tasks?owner=', {
      headers: { Authorization: 'Bearer test-token' }
    });
    expect(component.visibleTasks.map((task: { label?: string }) => task.label))
      .toEqual(['NORMAL · SIN-ASIGNAR', 'NORMAL · SIN-ASIGNAR']);
  });

  it('shows the backend error and ends loading when the tasks request fails', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    storedSessionValues.set('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockRejectedValue({ response: { data: { detail: 'Tasks unavailable' } } });
    const changeDetector = { detectChanges: vi.fn() };
    const zone = { run: (callback: () => void) => callback() };
    const component = new DashboardComponent(
      { navigate: vi.fn() } as never,
      changeDetector as never,
      zone as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(component.error).toBe('Tasks unavailable');
    expect(component.loading).toBe(false);
    expect(changeDetector.detectChanges).toHaveBeenCalledOnce();
  });

  it('uses a network error message when the backend has no detail', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    vi.mocked(axios.get).mockRejectedValue(new Error('Network unavailable'));
    const zone = { run: (callback: () => void) => callback() };
    const component = new DashboardComponent(
      { navigate: vi.fn() } as never,
      { detectChanges: vi.fn() } as never,
      zone as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(component.error).toBe('Network unavailable');
  });

  it('shows an invalid-token response without clearing the session or redirecting', async () => {
    storedSessionValues.set('workshop_token', 'invalid-token');
    storedSessionValues.set('workshop_user', JSON.stringify({ username: 'student' }));
    vi.mocked(axios.get).mockRejectedValue({
      response: { status: 401, data: { detail: 'Invalid token' } }
    });
    const router = { navigate: vi.fn() };
    const component = new DashboardComponent(
      router as never,
      { detectChanges: vi.fn() } as never,
      { run: (callback: () => void) => callback() } as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(component.error).toBe('Invalid token');
    expect(component.loading).toBe(false);
    expect(storedSessionValues.get('workshop_token')).toBe('invalid-token');
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('shows a tasks request timeout and ends loading', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    vi.mocked(axios.get).mockRejectedValue(new Error('timeout exceeded'));
    const component = new DashboardComponent(
      { navigate: vi.fn() } as never,
      { detectChanges: vi.fn() } as never,
      { run: (callback: () => void) => callback() } as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(component.error).toBe('timeout exceeded');
    expect(component.loading).toBe(false);
  });

  it('shows an error and ends loading when the tasks body is not iterable', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    vi.mocked(axios.get).mockResolvedValue({ data: { unexpected: true } } as never);
    const component = new DashboardComponent(
      { navigate: vi.fn() } as never,
      { detectChanges: vi.fn() } as never,
      { run: (callback: () => void) => callback() } as never,
      new SessionService(),
      new TasksService()
    );

    await component.ngOnInit();

    expect(component.error).toMatch(/iterable/i);
    expect(component.loading).toBe(false);
  });

  it('clears the session and returns to login on logout', async () => {
    storedSessionValues.set('workshop_token', 'test-token');
    storedSessionValues.set('workshop_user', JSON.stringify({ username: 'student' }));
    storedValues.set('workshop_preferences', JSON.stringify({ theme: 'dark' }));
    const router = { navigate: vi.fn().mockResolvedValue(true) };
    const component = new DashboardComponent(
      router as never,
      { detectChanges: vi.fn() } as never,
      { run: vi.fn() } as never,
      new SessionService(),
      new TasksService()
    );

    await component.logout();

    expect(storedSessionValues.has('workshop_token')).toBe(false);
    expect(storedSessionValues.has('workshop_user')).toBe(false);
    expect(storedValues.has('workshop_preferences')).toBe(true);
    expect(router.navigate).toHaveBeenCalledWith(['/login']);
  });
});