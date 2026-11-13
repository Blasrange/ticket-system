import { Component, inject, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TicketService } from '../core/services/ticket';

import { TableModule, Table } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { SelectModule } from '@openng/optimus-ui/select';

import { TicketDetail } from './ticket-detail/ticket-detail';
import { ExportModalComponent } from './export-modal/export-modal';
import * as XLSX from 'xlsx';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-tickets',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TableModule,
    TagModule,
    ButtonModule,
    InputTextModule,
    IconFieldModule,
    InputIconModule,
    SelectModule,
    TicketDetail,
    ExportModalComponent,
  ],
  templateUrl: './tickets.html',
  styleUrl: './tickets.css',
})
export class Tickets implements OnInit {
  @ViewChild('dtActive') dtActive!: Table;
  @ViewChild('dtClosed') dtClosed!: Table;

  private ticketService = inject(TicketService);
  private cdr = inject(ChangeDetectorRef);

  allTickets: any[] = [];
  activeTickets: any[] = [];
  closedTickets: any[] = [];
  loading = true;

  activeTab: 'active' | 'closed' = 'active';
  drawerVisible = false;
  selectedTicketId: string | number | null = null;
  exportModalVisible = false;

  statusOptions = [
    { label: 'Abierto', value: 'Open' },
    { label: 'Asignado', value: 'Assigned' },
    { label: 'En Proceso', value: 'In progress' },
    { label: 'Cerrado', value: 'Closed' },
  ];
  priorityOptions = [
    { label: 'Crítica', value: 'P1' },
    { label: 'Alta', value: 'P2' },
    { label: 'Media', value: 'P3' },
    { label: 'Baja', value: 'P4' },
    { label: 'Servicio', value: 'Solicitud' },
  ];
  areaOptions = [
    { label: 'Implementación', value: 'Implementación' },
    { label: 'Infraestructura', value: 'Infraestructura' },
  ];
  applicationOptions = [
    { label: 'TMS Move Q', value: 'TMS' },
    { label: 'BatchFlow', value: 'BatchFlow' },
    { label: 'CCL Forms', value: 'CCL Forms' },
    { label: 'Digital Twin', value: 'Digital Twin' },
    { label: 'Control Tower', value: 'Control Tower' },
    { label: 'Digital Signage', value: 'Signage' },
    { label: 'Supplier WMS', value: 'WMS' },
    { label: 'Certificador Ordenes', value: 'Certificador' },
    { label: 'Catalogs', value: 'Catalogs' },
    { label: 'Morph E-Container', value: 'Morph' },
  ];
  operationOptions = [
    { label: 'Funza', value: 'Funza' },
    { label: 'Montevideo', value: 'Montevideo' },
    { label: 'Barranquilla', value: 'Barranquilla' },
    { label: 'Medellín', value: 'Medellín' },
    { label: 'Cali - Acopi Yumbo', value: 'Cali - Acopi Yumbo' },
    { label: 'Cali - Cortijo', value: 'Cali - Cortijo' },
    { label: 'Cali - Múltiple', value: 'Cali - Múltiple' },
  ];
  requestTypeOptions = [
    { label: 'Incidente', value: 'Incidente' },
    { label: 'Soporte técnico', value: 'Soporte técnico' },
    { label: 'Requerimiento', value: 'Requerimiento' },
    { label: 'Accesos y permisos', value: 'Accesos y permisos' },
    { label: 'Consulta funcional', value: 'Consulta funcional' },
    { label: 'Datos e información', value: 'Datos e información' },
    { label: 'Cambio de configuración', value: 'Cambio de configuración' },
    { label: 'Mejora o desarrollo', value: 'Mejora o desarrollo' },
  ];

  ngOnInit() {
    this.loadTickets();
  }

    loadTickets() {
    this.loading = true;
    this.cdr.detectChanges(); // Forzamos que el spinner aparezca de inmediato

    this.ticketService.getTickets().subscribe({
      next: (res: any) => {
        try {
          const arr = Array.isArray(res) ? res : res ? [res] : [];
          const sorted = arr
            .map((i: any) => i.json ?? i)
            .sort((a, b) => {
              return b.ticket_id.localeCompare(a.ticket_id, undefined, { numeric: true });
            });

          this.allTickets = sorted;
          this.activeTickets = sorted.filter((t) => t.status !== 'Closed');
          this.closedTickets = sorted.filter((t) => t.status === 'Closed');
        } catch (e) {
          console.error('Error procesando tickets', e);
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando tickets', err);
        this.activeTickets = [];
        this.closedTickets = [];
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ════════════════════════════════════════════════════════════
  // REGLAS EXACTAS DEL SLA
  // ════════════════════════════════════════════════════════════

  getSlaHours(priority: string): number {
    const p = (priority || '').toUpperCase();
    if (p.includes('P1') || p.includes('CRÍTICA')) return 4;
    if (p.includes('P2') || p.includes('ALTA')) return 24;
    if (p.includes('P3') || p.includes('MEDIA')) return 72;
    if (p.includes('P4') || p.includes('BAJA')) return 120;
    return 168; // Servicio
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
    if (pct <= 0) return 'red'; // Vencido (0% o menos)
    if (pct < 25) return 'yellow'; // Menos del 25% restante (Por vencer)
    return 'green'; // Más del 25% restante (En tiempo)
  }

  // NUEVO: Calcula el mensaje de tiempo restante o vencido
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
  // EXPORTACIÓN EXCEL
  // ════════════════════════════════════════════════════════════

  exportToExcel(range: { start: string; end: string }) {
    const startDate = new Date(range.start).getTime();
    const endDate = new Date(range.end);
    endDate.setHours(23, 59, 59, 999);

    const filtered = this.allTickets.filter((t) => {
      if (!t.created_at) return false;
      const tDate = new Date(t.created_at).getTime();
      return tDate >= startDate && tDate <= endDate.getTime();
    });

    const dataToExport = filtered.map((t) => ({
      ID: t.ticket_id,
      Asunto: t.subject,
      Estado: this.translateStatus(t.status),
      Prioridad: this.getPriorityLabel(t.priority),
      Remitente: t.email,
      Área: t.assigned_area,
      Operación: t.operation,
      Tipo: t.request_type,
      Aplicación: t.application,
      Agente: t.agent_name || t.assigned_agent || 'Sin asignar',
      'Fecha Creación': new Date(t.created_at).toLocaleString(),
      'Fecha Cierre': t.closed_at ? new Date(t.closed_at).toLocaleString() : '',
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tickets');
    XLSX.writeFile(wb, `Tickets_${range.start}_a_${range.end}.xlsx`);
  }

  // ════════════════════════════════════════════════════════════
  // HELPERS
  // ════════════════════════════════════════════════════════════

  openTicket(ticket: any) {
    this.selectedTicketId = ticket.ticket_id;
    this.drawerVisible = true;
  }
  closeDrawer() {
    this.drawerVisible = false;
    this.selectedTicketId = null;
  }

  // ACTUALIZADO: Limpia el input visualmente y los filtros de la tabla
  clearFilters(searchInput?: HTMLInputElement) {
    if (searchInput) {
      searchInput.value = '';
    }

    if (this.activeTab === 'active') this.dtActive.clear();
    else this.dtClosed.clear();
  }

  onGlobalFilter(e: Event) {
    const val = (e.target as HTMLInputElement).value;
    if (this.activeTab === 'active') this.dtActive.filterGlobal(val, 'contains');
    else this.dtClosed.filterGlobal(val, 'contains');
  }

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
  isOverdue(ticket: any): boolean {
    return this.getSlaStatus(ticket) === 'red';
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
  getStatusSeverity(s: string): Severity {
    return (
      ({ Open: 'info', Assigned: 'secondary', 'In progress': 'warn', Closed: 'success' } as any)[
        s
      ] ?? 'secondary'
    );
  }
  translateStatus(s: string): string {
    return (
      (
        {
          Open: 'Abierto',
          Assigned: 'Asignado',
          'In progress': 'En Proceso',
          Closed: 'Cerrado',
        } as any
      )[s] ?? s
    );
  }
}
