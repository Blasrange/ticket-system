import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Observable, tap, map } from 'rxjs';
import { environment } from '../../environments/environments';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);
  private apiUrl = `${environment.apiUrl}/auth-login`;

  login(credentials: { email: string, password: string }): Observable<any> {
    return this.http.post<any>(this.apiUrl, credentials).pipe(
      map((res: any) => {
        let data = res;
        
        // 1. Si n8n envía un arreglo [{...}], sacamos el primer elemento
        if (Array.isArray(data) && data.length > 0) {
          data = data[0];
        }
        
        // 2. Si n8n envía { json: {...} }, lo extraemos
        if (data && typeof data === 'object' && 'json' in data) {
          data = data.json;
        }

        if (!data) {
          throw new Error('No se recibieron datos del servidor.');
        }

        // 3. Extraemos el usuario o creamos uno por defecto
        const user = data.user || {
          name: credentials.email.split('@')[0],
          email: credentials.email,
          role: 'Agente'
        };

        return {
          ...user,
          name: user.name || credentials.email.split('@')[0],
          email: user.email || credentials.email,
          token: data.token || 'token-local'
        };
      }),
      tap(userData => {
        if (isPlatformBrowser(this.platformId)) {
          localStorage.setItem('ccl_token', userData.token);
          localStorage.setItem('ccl_user', JSON.stringify(userData));
        }
      })
    );
  }

  logout() {
    if (isPlatformBrowser(this.platformId)) {
      localStorage.removeItem('ccl_token');
      localStorage.removeItem('ccl_user');
    }
  }

  isLoggedIn(): boolean {
    if (!isPlatformBrowser(this.platformId)) return false;
    return !!localStorage.getItem('ccl_token');
  }

  getUser() {
    if (!isPlatformBrowser(this.platformId)) return null;
    const raw = localStorage.getItem('ccl_user');
    if (!raw) return null;
    const user = JSON.parse(raw);
    return { ...user, name: user.name || user.full_name || 'Usuario' };
  }
}