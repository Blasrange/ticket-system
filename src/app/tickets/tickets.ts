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
  ],
  templateUrl: './tickets.html',
  styleUrl: './tickets.css',
})
export class Tickets implements OnInit {
  @ViewChild('dt') dt!: Table;

  private ticketService = inject(TicketService);
  private cdr = inject(ChangeDetectorRef);

  tickets: any[] = [];
  loading = true;

  // ── Drawer ──
  drawerVisible = false;
  selectedTicketId: string | number | null = null;

  statusOptions = [
    { label: 'Abierto', value: 'Open' },
    { label: 'Pendiente', value: 'Pending' },
    { label: 'Cerrado', value: 'Closed' },
  ];
  priorityOptions = [
    { label: 'Crítica', value: 'Critical' },
    { label: 'Alta', value: 'High' },
    { label: 'Media', value: 'Medium' },
    { label: 'Baja', value: 'Low' },
  ];

  ngOnInit() {
    this.loadTickets();
  }

  loadTickets() {
    this.loading = true;
    this.ticketService.getTickets().subscribe({
      next: (res: any) => {
        try {
          const arr = Array.isArray(res) ? res : res ? [res] : [];
          this.tickets = arr.map((i: any) => i.json ?? i);
        } catch (e) {
          console.error(e);
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.tickets = [];
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  openTicket(ticket: any) {
    this.selectedTicketId = ticket.ticket_id;
    this.drawerVisible = true;
  }

  closeDrawer() {
    this.drawerVisible = false;
    this.selectedTicketId = null;
  }

  clearFilters() {
    this.dt.clear();
  }

  onGlobalFilter(e: Event) {
    this.dt.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }

  getStatusSeverity(s: string): Severity {
    return ({ Open: 'info', Pending: 'warn', Closed: 'success' } as any)[s] ?? 'secondary';
  }

  getPrioritySeverity(p: string): Severity {
    return (
      ({ Critical: 'danger', High: 'warn', Medium: 'info', Low: 'secondary' } as any)[p] ??
      'secondary'
    );
  }

  translateStatus(s: string): string {
    return ({ Open: 'Abierto', Pending: 'Pendiente', Closed: 'Cerrado' } as any)[s] ?? s;
  }

  translatePriority(p: string): string {
    return ({ Critical: 'Crítica', High: 'Alta', Medium: 'Media', Low: 'Baja' } as any)[p] ?? p;
  }
}
