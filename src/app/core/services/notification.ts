import { Injectable, inject, signal, computed } from '@angular/core';
import { TicketService } from './ticket';
import { AuthService } from './auth';

export interface AppNotification {
  id: string;
  ticketId: string;
  title: string;
  message: string;
  time: string;
  slaPercent: number;
  read: boolean;
  type: 'danger' | 'warning' | 'info';
}

const STORAGE_KEY = 'ccl_notif_read';

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private ticketService = inject(TicketService);
  private authService = inject(AuthService);

  private _notifications = signal<AppNotification[]>([]);
  notifications = this._notifications.asReadonly();

  unreadCount = computed(() => this._notifications().filter((n) => !n.read).length);
  dangerCount = computed(
    () => this._notifications().filter((n) => !n.read && n.type === 'danger').length,
  );
  warningCount = computed(
    () => this._notifications().filter((n) => !n.read && n.type === 'warning').length,
  );

  private pollTimer?: ReturnType<typeof setInterval>;

  startPolling(intervalMs = 90_000) {
    this.refresh();
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = setInterval(() => this.refresh(), intervalMs);
  }

  stopPolling() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.pollTimer = undefined;
  }

  // 👇 NUEVO MÉTODO: Para errores del sistema (como fallo de correo)
  pushManualNotification(
    title: string,
    message: string,
    type: 'danger' | 'warning' | 'info' = 'danger',
  ) {
    const newNotif: AppNotification = {
      id: `manual-${Date.now()}`,
      ticketId: '',
      title: title,
      message: message,
      time: 'Ahora',
      slaPercent: 0,
      read: false,
      type: type,
    };
    // Lo ponemos de primero en la lista
    this._notifications.update((n) => [newNotif, ...n]);
  }

  refresh() {
    this.ticketService.getTickets().subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : res ? [res] : [];
        const tickets = arr.map((i: any) => i.json ?? i);
        const user = this.authService.getUser();
        const role = user?.role || 'Agente';
        const email = user?.email || '';

        let mine = tickets;
        if (role === 'Admin') {
          mine = tickets;
        } else if (role === 'Jefe') {
          mine = tickets.filter((t: any) => t.status === 'Open' || t.assigned_agent === email);
        } else {
          mine = tickets.filter((t: any) => t.assigned_agent === email);
        }

        const readIds = new Set(this.loadReadState());
        const list: AppNotification[] = [];

        mine
          .filter((t: any) => t.status !== 'Closed')
          .forEach((t: any) => {
            const slaPct = this.getSlaPercentage(t);
            const id = String(t.ticket_id);
            const subject = (t.subject || 'Sin asunto').trim();

            if (slaPct <= 0) {
              const nid = `sla-vencido-${id}`;
              list.push({
                id: nid,
                ticketId: id,
                title: 'SLA vencido',
                message: `#${id} · ${subject}`,
                time: this.getSlaTimeText(t),
                slaPercent: 0,
                read: readIds.has(nid),
                type: 'danger',
              });
            } else if (slaPct < 25) {
              const nid = `sla-porvencer-${id}`;
              list.push({
                id: nid,
                ticketId: id,
                title: 'SLA por vencer',
                message: `#${id} · ${subject}`,
                time: this.getSlaTimeText(t),
                slaPercent: slaPct,
                read: readIds.has(nid),
                type: 'warning',
              });
            }
          });

        list.sort((a, b) => {
          if (a.read !== b.read) return a.read ? 1 : -1;
          const order = { danger: 0, warning: 1, info: 2 };
          return order[a.type] - order[b.type];
        });

        // 👇 MAGIA: Conservar los errores manuales (los que empiezan con 'manual-') y mezclarlos
        const manualNotifs = this._notifications().filter((n) => n.id.startsWith('manual-'));
        this._notifications.set([...manualNotifs, ...list.slice(0, 12)]);
      },
      error: () => {},
    });
  }

  markAsRead(id: string) {
    this._notifications.update((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
    this.persistReadState();
  }

  markAllAsRead() {
    this._notifications.update((l) => l.map((n) => ({ ...n, read: true })));
    this.persistReadState();
  }

  private persistReadState() {
    try {
      const ids = this._notifications()
        .filter((n) => n.read)
        .map((n) => n.id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
    } catch {}
  }

  private loadReadState(): string[] {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  private getSlaHours(priority: string): number {
    const p = (priority || '').toUpperCase();
    if (p.includes('P1')) return 4;
    if (p.includes('P2')) return 24;
    if (p.includes('P3')) return 72;
    if (p.includes('P4')) return 120;
    return 168;
  }

  private getDueDate(t: any): Date | null {
    if (!t?.created_at) return null;
    return new Date(new Date(t.created_at).getTime() + this.getSlaHours(t.priority) * 3_600_000);
  }

  private getSlaPercentage(t: any): number {
    if (!t?.created_at) return 100;
    const total = this.getSlaHours(t.priority) * 3_600_000;
    const elapsed = Date.now() - new Date(t.created_at).getTime();
    return Math.max(0, Math.min(100, Math.round(100 - (elapsed / total) * 100)));
  }

  private getSlaTimeText(t: any): string {
    const due = this.getDueDate(t);
    if (!due) return '';
    const diff = due.getTime() - Date.now();
    const abs = Math.abs(diff);
    const mins = Math.floor(abs / 60_000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    const txt = days > 0 ? `${days}d` : hrs > 0 ? `${hrs}h` : `${mins}m`;
    return diff <= 0 ? `Vencido hace ${txt}` : `Vence en ${txt}`;
  }
}
