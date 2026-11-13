import {
  Component,
  inject,
  signal,
  PLATFORM_ID,
  ViewChild,
  OnInit,
  OnDestroy,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth';
import { NotificationService, AppNotification } from '../core/services/notification';
import { filter } from 'rxjs/operators';

import { PopoverModule, Popover } from '@openng/optimus-ui/popover';

@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, PopoverModule],
  templateUrl: './shell.html',
  styleUrl: './shell.css',
})
export class Shell implements OnInit, OnDestroy {
  private authService = inject(AuthService);
  private router = inject(Router);
  private platformId = inject(PLATFORM_ID);
  private notifService = inject(NotificationService);

  @ViewChild('notifPanel') notifPanel!: Popover;

  collapsed = signal<boolean>(this.loadCollapsed());
  pageTitle = signal<string>('Dashboard');

  notifications = this.notifService.notifications;
  unreadCount = this.notifService.unreadCount;
  dangerCount = this.notifService.dangerCount;
  warningCount = this.notifService.warningCount;

  private readonly PAGE_LABELS: Record<string, string> = {
    '/home': 'Dashboard',
    '/tickets': 'Tickets',
    '/agents': 'Agentes',
    '/kanban-board': 'Tablero Kanban',
    // '/settings': 'Configuración',
  };

  constructor() {
    this.router.events.pipe(filter((e) => e instanceof NavigationEnd)).subscribe((e: any) => {
      const url = e.urlAfterRedirects as string;
      if (url.match(/^\/tickets\/.+/)) {
        this.pageTitle.set('Detalle del Ticket');
      } else {
        this.pageTitle.set(this.PAGE_LABELS[url] ?? 'Dashboard');
      }
    });
  }

  ngOnInit() {
    this.notifService.startPolling();
  }

  ngOnDestroy() {
    this.notifService.stopPolling();
  }

  // ── GETTERS DE USUARIO ──
  get userName(): string {
    return this.authService.getUser()?.full_name || 'Usuario';
  }

  get userRole(): string {
    return this.authService.getUser()?.role || 'Agente';
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

  // ── NOTIFICACIONES ──
  toggleNotifications(event: any) {
    this.notifService.refresh();
    this.notifPanel.toggle(event);
  }

  onNotifClick(n: AppNotification) {
    this.notifService.markAsRead(n.id);
    this.notifPanel.hide();
    this.router.navigate(['/tickets'], { queryParams: { open: n.ticketId } });
  }

  markAllAsRead() {
    this.notifService.markAllAsRead();
  }

  goToTickets() {
    this.notifPanel.hide();
    this.router.navigate(['/tickets']);
  }

  trackById = (_: number, n: AppNotification) => n.id;

  getNotifIcon(type: string): string {
    switch (type) {
      case 'danger':
        return 'pi-exclamation-circle';
      case 'warning':
        return 'pi-exclamation-triangle';
      default:
        return 'pi-info-circle';
    }
  }

  private loadCollapsed(): boolean {
    try {
      return localStorage.getItem('ccl_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  }
}
