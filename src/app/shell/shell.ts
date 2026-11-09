import { Component, inject, signal, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth';
import { filter } from 'rxjs/operators';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
  styleUrl: './shell.css'
})
export class Shell {
  private authService = inject(AuthService);
  private router       = inject(Router);
  private platformId   = inject(PLATFORM_ID);

  // ── Sidebar collapsed state persisted in localStorage ──
  collapsed = signal<boolean>(this.loadCollapsed());

  // ── Current page title for topbar breadcrumb ──
  pageTitle = signal<string>('Dashboard');

  private readonly PAGE_LABELS: Record<string, string> = {
    '/home':     'Dashboard',
    '/tickets':  'Tickets',
    '/agents':   'Agentes',
    '/reports':  'Reportes',
    '/settings': 'Configuración',
  };

  constructor() {
    // Actualiza el breadcrumb al cambiar de ruta
    this.router.events
      .pipe(filter(e => e instanceof NavigationEnd))
      .subscribe((e: any) => {
        const url = e.urlAfterRedirects as string;
        // Detecta rutas de detalle como /tickets/TK-xxx
        if (url.match(/^\/tickets\/.+/)) {
          this.pageTitle.set('Detalle del Tique');
        } else {
          const label = this.PAGE_LABELS[url] ?? 'Dashboard';
          this.pageTitle.set(label);
        }
      });
  }

  // 👇 AHORA ES SÚPER LIMPIO (El auth.ts ya hace la magia)
  get userName(): string {
    const user = this.authService.getUser();
    return user?.name || 'Usuario';
  }

  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase();
  }

  toggleSidebar() {
    const next = !this.collapsed();
    this.collapsed.set(next);
    if (isPlatformBrowser(this.platformId)) {
      localStorage.setItem('ccl_sidebar_collapsed', String(next));
    }
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  private loadCollapsed(): boolean {
    try {
      return localStorage.getItem('ccl_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  }
}