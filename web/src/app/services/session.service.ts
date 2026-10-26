import { Injectable } from '@angular/core';
import { AuthenticatedUser } from '../models/auth.models';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly tokenStorageKey = 'workshop_token';
  private readonly userStorageKey = 'workshop_user';

  saveSession(token: string, user: AuthenticatedUser): void {
    sessionStorage.setItem(this.tokenStorageKey, token);
    sessionStorage.setItem(this.userStorageKey, JSON.stringify(user));
  }

  getToken(): string | null {
    return sessionStorage.getItem(this.tokenStorageKey);
  }

  getUser(): AuthenticatedUser {
    const storedUser = sessionStorage.getItem(this.userStorageKey);
    if (!storedUser) {
      return { username: '' };
    }

    try {
      const parsedUser: unknown = JSON.parse(storedUser);
      if (typeof parsedUser === 'object' && parsedUser !== null &&
          'username' in parsedUser && typeof parsedUser.username === 'string') {
        return parsedUser as AuthenticatedUser;
      }
    } catch {
      return { username: '' };
    }

    return { username: '' };
  }

  clearSession(): void {
    sessionStorage.removeItem(this.tokenStorageKey);
    sessionStorage.removeItem(this.userStorageKey);
  }
}