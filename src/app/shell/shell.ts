import { Component, inject, PLATFORM_ID, OnInit, OnDestroy, HostListener } from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd, RouterLink, RouterLinkActive } from '@angular/router';
import { filter } from 'rxjs/operators';

import { BreadcrumbModule } from '@openng/optimus-ui/breadcrumb';
import { MenuItem } from '@openng/optimus-ui/api';

import { AuthService } from '../core/services/auth';
import { NotificationService } from '../core/services/notification';
import { NotificationBellComponent } from '../core/components/notification-bell/notification-bell';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    BreadcrumbModule,
    NotificationBellComponent,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private notifService = inject(NotificationService);

  // Variables para los menús
  activeDropdown: string | null = null;

  // Variables para el Breadcrumb
  items: MenuItem[] = [];
  home: MenuItem = { icon: 'pi pi-home', routerLink: '/home' };

  private timeoutId: any;
  private readonly TIMEOUT_MS = 15 * 60 * 1000;

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      this.activeDropdown = null; // Cierra menús al navegar
      this.updateBreadcrumbs(e.urlAfterRedirects);
    });
  }

  ngOnInit() {
    this.notifService.startPolling();
    this.startInactivityTimer();
  }

  ngOnDestroy() {
    this.notifService.stopPolling();
    this.clearInactivityTimer();
  }

  // ════════════════════════════════════════════════════════════
  // LÓGICA DE LOS MENÚS DESPLEGABLES
  // ════════════════════════════════════════════════════════════
  toggleDropdown(menu: string, event: Event) {
    event.stopPropagation(); // Evita que se cierre inmediatamente
    this.activeDropdown = this.activeDropdown === menu ? null : menu;
  }

  @HostListener('document:click', ['$event'])
  onClickOutside(event: Event) {
    const target = event.target as HTMLElement;
    // Si el clic NO fue dentro de un dropdown, lo cerramos
    if (!target.closest('.dropdown-wrapper')) {
      this.activeDropdown = null;
    }
  }

  // ════════════════════════════════════════════════════════════
  // LÓGICA DE MIGAS DE PAN (BREADCRUMBS)
  // ════════════════════════════════════════════════════════════
  updateBreadcrumbs(url: string) {
    this.items = [];
    if (url.includes('/tickets/')) {
      this.items = [
        { label: 'Gestión', routerLink: '/tickets' },
        { label: 'Tickets', routerLink: '/tickets' },
        { label: 'Detalle' },
      ];
    } else if (url.includes('/tickets')) {
      this.items = [{ label: 'Gestión' }, { label: 'Tickets' }];
    } else if (url.includes('/agents')) {
      this.items = [{ label: 'Gestión' }, { label: 'Agentes' }];
    } else if (url.includes('/kanban-board')) {
      this.items = [{ label: 'Operaciones' }, { label: 'Tablero Kanban' }];
    }
  }

  // ────────────────────────────────────────────────────────
  // INACTIVIDAD Y USUARIO
  // ────────────────────────────────────────────────────────
  @HostListener('window:mousemove')
  @HostListener('window:keydown')
  @HostListener('window:click')
  @HostListener('window:scroll')
  @HostListener('window:touchstart')
  onUserActivity() {
    if (this.timeoutId) {
      this.clearInactivityTimer();
      this.startInactivityTimer();
    }
  }

  private startInactivityTimer() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.timeoutId = setTimeout(() => this.logoutDueToInactivity(), this.TIMEOUT_MS);
  }

  private clearInactivityTimer() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
  }

  private logoutDueToInactivity() {
    this.notifService.pushManualNotification(
      'Sesión finalizada',
      'Tu sesión ha expirado por inactividad.',
      'warning',
    );
    this.logout();
  }

  get userName(): string {
    return this.authService.getUser()?.full_name || 'Usuario';
  }
  get userRole(): string {
    return this.authService.getUser()?.role || 'Agente';
  }
  get userInitial(): string {
    return this.userName.charAt(0).toUpperCase();
  }

  logout() {
    this.clearInactivityTimer();
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}
