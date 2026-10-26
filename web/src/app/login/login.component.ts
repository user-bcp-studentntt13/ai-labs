import { CommonModule } from '@angular/common';
import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { SessionService } from '../services/session.service';
import { getApiErrorMessage } from '../utils/api-error';
import { LoginRequest, UserPreferences } from '../models/auth.models';

const PREFERENCES_STORAGE_KEY = 'workshop_preferences';
const LOGIN_CLIENT = 'angular-workshop';

interface LoginMessage {
  title: string;
  detail?: string;
}

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css'
})
export class LoginComponent {
  username = '';
  password = '';
  busy = false;
  message: LoginMessage | null = null;
  preferences: UserPreferences = { theme: 'light', showTips: true, compact: false };

  constructor(
    private router: Router,
    private authService: AuthService,
    private sessionService: SessionService
  ) {
    this.preferences = this.loadPreferences();
  }

  async login(): Promise<void> {
    this.message = null;
    if (!this.username.trim()) {
      this.message = { title: 'Ingrese un usuario.' };
      return;
    }

    if (!this.password.trim()) {
      this.message = { title: 'Ingrese una contraseña.' };
      return;
    }

    this.busy = true;
    try {
      const request: LoginRequest = {
        username: this.username,
        password: this.password,
        client: LOGIN_CLIENT
      };
      const response = await this.authService.login(request);
      if (!response.token) {
        this.message = { title: 'El backend respondió sin token.' };
        return;
      }

      this.sessionService.saveSession(response.token, response.user ?? { username: this.username });
      localStorage.setItem(PREFERENCES_STORAGE_KEY, JSON.stringify(this.preferences));
      await this.router.navigate(['/dashboard']);
    } catch (error: unknown) {
      this.message = {
        title: `No se pudo autenticar a ${this.username}.`,
        detail: getApiErrorMessage(error, 'message', 'Error desconocido')
      };
      console.error(error);
    } finally {
      this.busy = false;
    }
  }

  private loadPreferences(): UserPreferences {
    try {
      const saved = JSON.parse(localStorage.getItem(PREFERENCES_STORAGE_KEY) || '{}') as Partial<UserPreferences>;
      this.preferences = { ...this.preferences, ...saved };
    } catch (error: unknown) {
      console.log('Preferences could not be loaded', error);
    }
    return this.preferences;
  }
}
