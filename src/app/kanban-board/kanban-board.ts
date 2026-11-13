import { Component, inject, OnInit, ChangeDetectorRef, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DragDropModule,
  CdkDragDrop,
  moveItemInArray,
  transferArrayItem,
} from '@angular/cdk/drag-drop';
import { TicketService } from '../core/services/ticket';
import { AuthService } from '../core/services/auth';
import { NotificationService } from '../core/services/notification'; // 👈 IMPORTAMOS
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { TicketDetail } from '../tickets/ticket-detail/ticket-detail';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-kanban-board',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    forwardRef(() => DragDropModule),
    TagModule,
    ButtonModule,
    SelectModule,
    forwardRef(() => TicketDetail),
  ],
  templateUrl: './kanban-board.html',
  styleUrl: './kanban-board.css',
})
export class KanbanBoard implements OnInit {
  private ticketService = inject(TicketService);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);
  private notifService = inject(NotificationService); // 👈 INYECTAMOS

  loading = true;

  currentUser: any = { email: '', name: '', role: 'Agente' };

  areaOptions = [
    { label: 'Todas las áreas', value: '' },
    { label: 'Implementación', value: 'Implementación' },
    { label: 'Infraestructura', value: 'Infraestructura' },
  ];
  selectedArea = '';

  allTicketsRaw: any[] = [];

  columns = [
    { id: 'Open', title: 'Abierto', icon: 'pi-folder-open', tickets: [] as any[] },
    { id: 'Assigned', title: 'Asignado', icon: 'pi-user-plus', tickets: [] as any[] },
    { id: 'In progress', title: 'En Proceso', icon: 'pi-spinner', tickets: [] as any[] },
    { id: 'Closed', title: 'Cerrado', icon: 'pi-check-circle', tickets: [] as any[] },
  ];

  drawerVisible = false;
  selectedTicketId: string | number | null = null;

  ngOnInit() {
    this.loadCurrentUser();
    this.loadTickets();
  }

  loadCurrentUser() {
    const user = this.authService.getUser();
    if (user) {
      this.currentUser = {
        email: user.email,
        name: user.name,
        role: user.role,
      };
    }
  }

  loadTickets() {
    this.loading = true;
    this.ticketService.getTickets().subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : res ? [res] : [];
        this.allTicketsRaw = arr
          .map((i: any) => i.json ?? i)
          .sort((a, b) => {
            return b.ticket_id.localeCompare(a.ticket_id, undefined, { numeric: true });
          });

        this.applyFiltersAndRoles();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: () => {
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  applyFiltersAndRoles() {
    this.columns.forEach((c) => (c.tickets = []));

    let filtered = [...this.allTicketsRaw];

    if (this.selectedArea) {
      filtered = filtered.filter((t) => t.assigned_area === this.selectedArea);
    }

    const userRole = this.currentUser.role;
    const userEmail = (this.currentUser.email || '').toLowerCase();
    const userName = (this.currentUser.name || '').toLowerCase();

    if (userRole === 'Admin') {
      // Admin ve todo
    } else if (userRole === 'Jefe') {
      filtered = filtered.filter(
        (t) =>
          t.status === 'Open' ||
          (t.assigned_agent || '').toLowerCase() === userEmail ||
          (t.agent_name || '').toLowerCase() === userName,
      );
    } else {
      filtered = filtered.filter(
        (t) =>
          (t.assigned_agent || '').toLowerCase() === userEmail ||
          (t.agent_name || '').toLowerCase() === userName,
      );
    }

    filtered.forEach((t) => {
      const col = this.columns.find((c) => c.id === t.status);
      if (col) {
        col.tickets.push(t);
      } else {
        this.columns[0].tickets.push(t);
      }
    });
  }

  onFilterChange() {
    this.applyFiltersAndRoles();
  }

  drop(event: CdkDragDrop<any[]>, newStatus: string) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    } else {
      transferArrayItem(
        event.previousContainer.data,
        event.container.data,
        event.previousIndex,
        event.currentIndex,
      );

      const ticket = event.container.data[event.currentIndex];

      this.ticketService.updateTicketStatus(ticket.ticket_id, newStatus).subscribe({
        next: () => {
          ticket.status = newStatus;
          if (newStatus === 'Closed') {
            ticket.closed_at = new Date().toISOString();
          }
        },
        error: () => {
          // 👇 REEMPLAZO DEL ALERT
          this.notifService.pushManualNotification(
            'Error al mover ticket',
            'No se pudo actualizar el estado en el servidor. Verifica la conexión o el envío de correo.',
            'danger',
          );
          this.loadTickets(); // Recargamos para restaurar la tarjeta a su columna original
        },
      });
    }
  }

  openTicket(ticket: any) {
    this.selectedTicketId = ticket.ticket_id;
    this.drawerVisible = true;
  }

  closeDrawer() {
    this.drawerVisible = false;
    this.selectedTicketId = null;
    this.loadTickets();
  }

  // ════════════════════════════════════════════════════════════
  // REGLAS SLA
  // ════════════════════════════════════════════════════════════
  getSlaHours(priority: string): number {
    const p = (priority || '').toUpperCase();
    if (p.includes('P1') || p.includes('CRÍTICA')) return 4;
    if (p.includes('P2') || p.includes('ALTA')) return 24;
    if (p.includes('P3') || p.includes('MEDIA')) return 72;
    if (p.includes('P4') || p.includes('BAJA')) return 120;
    return 168;
  }

  getDueDate(ticket: any): Date | null {
    if (!ticket?.created_at) return null;
    return new Date(
      new Date(ticket.created_at).getTime() + this.getSlaHours(ticket.priority) * 60 * 60 * 1000,
    );
  }

  getSlaPercentage(ticket: any): number {
    if (!ticket?.created_at) return 100;
    const totalMs = this.getSlaHours(ticket.priority) * 60 * 60 * 1000;
    const now = ticket.closed_at ? new Date(ticket.closed_at).getTime() : Date.now();
    const elapsed = now - new Date(ticket.created_at).getTime();
    const percent = 100 - (elapsed / totalMs) * 100;
    return Math.max(0, Math.min(100, Math.round(percent)));
  }

  getSlaStatus(ticket: any): 'green' | 'yellow' | 'red' {
    const pct = this.getSlaPercentage(ticket);
    if (pct <= 0) return 'red';
    if (pct < 25) return 'yellow';
    return 'green';
  }

  getRemainingTimeText(ticket: any): string {
    const dueDate = this.getDueDate(ticket);
    if (!dueDate) return '';

    const now = ticket.closed_at ? new Date(ticket.closed_at).getTime() : Date.now();
    const diffMs = dueDate.getTime() - now;
    const isOverdue = diffMs <= 0;
    const absDiff = Math.abs(diffMs);

    const days = Math.floor(absDiff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((absDiff / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((absDiff / (1000 * 60)) % 60);

    let timeStr = '';
    if (days > 0) timeStr += `${days}d `;
    if (hours > 0 || days > 0) timeStr += `${hours}h `;
    timeStr += `${minutes}m`;

    return isOverdue ? `Vencido hace ${timeStr}` : `Quedan ${timeStr}`;
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS DE DISPLAY
  // ════════════════════════════════════════════════════════════
  displaySender(ticket: any): string {
    return ticket?.user_name?.trim() || ticket?.email || '—';
  }
  displayAgent(ticket: any): string {
    return ticket?.agent_name?.trim() || ticket?.assigned_agent || '';
  }
  senderInitial(ticket: any): string {
    return this.displaySender(ticket).charAt(0).toUpperCase() || '?';
  }
  agentInitial(ticket: any): string {
    const n = this.displayAgent(ticket);
    return n ? n.charAt(0).toUpperCase() : '?';
  }

  getOperationClass(op: string): string {
    const s = (op || '').toLowerCase();
    return s.includes('funza')
      ? 'op-funza'
      : s.includes('montevideo')
        ? 'op-montevideo'
        : s.includes('barranquilla')
          ? 'op-barranquilla'
          : s.includes('medell')
            ? 'op-medellin'
            : s.includes('acopi')
              ? 'op-cali-acopi'
              : s.includes('cortijo')
                ? 'op-cali-cortijo'
                : s.includes('múltiple')
                  ? 'op-cali-multiple'
                  : 'op-unknown';
  }
  getAreaClass(area: string): string {
    const s = (area || '').toLowerCase();
    return s.includes('implement')
      ? 'area-impl'
      : s.includes('infra')
        ? 'area-infra'
        : 'area-unknown';
  }
  getApplicationClass(app: string): string {
    const s = (app || '').toLowerCase();
    return s.includes('tms')
      ? 'app-tms'
      : s.includes('batch')
        ? 'app-batchflow'
        : s.includes('forms')
          ? 'app-ccl-forms'
          : s.includes('twin')
            ? 'app-digital-twin'
            : s.includes('control')
              ? 'app-control-tower'
              : s.includes('signage')
                ? 'app-digital-signage'
                : s.includes('supplier')
                  ? 'app-supplier-wms'
                  : s.includes('certificador')
                    ? 'app-certificador'
                    : s.includes('catalog')
                      ? 'app-catalogs'
                      : s.includes('morph')
                        ? 'app-morph'
                        : 'app-unknown';
  }
  getRequestTypeClass(rt: string): string {
    const s = (rt || '').toLowerCase();
    return s.includes('incidente')
      ? 'rt-incidente'
      : s.includes('soporte')
        ? 'rt-soporte'
        : s.includes('requerimiento')
          ? 'rt-requerimiento'
          : s.includes('acceso')
            ? 'rt-accesos'
            : s.includes('consulta')
              ? 'rt-consulta'
              : s.includes('datos')
                ? 'rt-datos'
                : s.includes('cambio')
                  ? 'rt-cambio'
                  : s.includes('mejora')
                    ? 'rt-mejora'
                    : 'rt-unknown';
  }
  getPriorityClass(p: string): string {
    const s = (p || '').toLowerCase();
    return s.startsWith('p1')
      ? 'prio-p1'
      : s.startsWith('p2')
        ? 'prio-p2'
        : s.startsWith('p3')
          ? 'prio-p3'
          : s.startsWith('p4')
            ? 'prio-p4'
            : 'prio-sr';
  }
  getPriorityLabel(p: string): string {
    return (
      {
        'prio-p1': 'Crítica',
        'prio-p2': 'Alta',
        'prio-p3': 'Media',
        'prio-p4': 'Baja',
        'prio-sr': 'Servicio',
      }[this.getPriorityClass(p)] || 'Media'
    );
  }
  getPriorityTooltip(p: string): string {
    return (
      {
        'prio-p1': 'P1 – Crítica',
        'prio-p2': 'P2 – Alta',
        'prio-p3': 'P3 – Media',
        'prio-p4': 'P4 – Baja',
        'prio-sr': 'Solicitud de servicio',
      }[this.getPriorityClass(p)] || p
    );
  }
}
