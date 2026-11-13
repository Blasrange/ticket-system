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
        
        if (Array.isArray(data) && data.length > 0) {
          data = data[0];
        }
        
        if (data && typeof data === 'object' && 'json' in data) {
          data = data.json;
        }

        if (!data) {
          throw new Error('No se recibieron datos del servidor.');
        }

        const user = data.user || data; 

        // 👇 VALIDACIÓN ROBUSTA DE ESTADO ACTIVO (Soporta true, "true", 1, "1")
        const activeString = String(user.is_active).toLowerCase();
        const isActive = ['true', '1', 'activo'].includes(activeString);

        // Si el campo existe y no es activo, bloqueamos
        if (user.is_active !== undefined && user.is_active !== null && !isActive) {
          throw new Error('Tu cuenta está inactiva. Por favor, contacta al administrador.');
        }

        return {
          agent_id: user.agent_id,
          name: user.full_name || user.name || credentials.email.split('@')[0],
          full_name: user.full_name || user.name || credentials.email.split('@')[0],
          email: user.email || credentials.email,
          role: user.role || 'Agente',
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
      localStorage.removeItem('currentUser');
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
    return { 
      ...user, 
      name: user.full_name || user.name || 'Usuario',
      role: user.role || 'Agente'
    };
  }
}