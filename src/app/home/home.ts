import {
  Component,
  inject,
  OnInit,
  ChangeDetectorRef,
  ViewChild,
  ElementRef,
  OnDestroy,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer } from '@angular/platform-browser';
import { Chart, registerables, Plugin } from 'chart.js';
import { TicketService } from '../core/services/ticket';

// Optimus UI
import { TableModule, Table } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { SelectModule } from '@openng/optimus-ui/select';
import { DrawerModule } from '@openng/optimus-ui/drawer';

Chart.register(...registerables);

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export interface Message {
  id: string;
  from: string;
  date: string;
  body: string;
  isAgent: boolean;
  attachments: { name: string; url: string; isImage: boolean }[];
}

const centerTextPlugin: Plugin<'doughnut'> = {
  id: 'centerText',
  beforeDraw(chart: any) {
    const { ctx, chartArea, width, height } = chart;
    if (!chartArea || !ctx) return;
    const raw = chart.data?.datasets?.[0]?.data;
    const values = Array.isArray(raw) ? (raw as number[]) : [];
    const total = values.reduce((acc: number, val) => acc + (Number(val) || 0), 0);

    ctx.save();
    ctx.font = '800 26px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#0f172a';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    ctx.fillText(String(total), width / 2, height / 2 - 8);

    ctx.font = '600 10px Inter, system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('TOTAL', width / 2, height / 2 + 16);
    ctx.restore();
  },
};

@Component({
  selector: 'app-home',
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
    DrawerModule,
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('dt') dt!: Table;

  private ticketService = inject(TicketService);
  private cdr = inject(ChangeDetectorRef);
  private sanitizer = inject(DomSanitizer);

  // ── Charts ──
  @ViewChild('statusChart') statusChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('priorityChart') priorityChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') trendChartRef?: ElementRef<HTMLCanvasElement>;
  private charts: Chart<any, any, any>[] = [];

  readonly currentYear = new Date().getFullYear();
  readonly slaAverage = '2.5 h';

  // ── Lista ──
  tickets: any[] = [];
  loading = true;

  totalTickets = 0;
  activeTickets = 0;
  closedTickets = 0;

  // ── Tabla ──
  activeTicketsList: any[] = [];
  visibleActiveCount = 0;

  // ── Drawer ──
  drawerVisible = false;
  selectedTicket: any = null;
  messages: Message[] = [];
  lightboxSrc: string | null = null;

  // ── Filtros ──
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

  ngOnInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  // ─────────────────── Lista ───────────────────
  loadTickets(): void {
    this.loading = true;
    this.ticketService.getTickets().subscribe({
      next: (response: any) => {
        try {
          const dataArray: any[] = Array.isArray(response)
            ? response
            : response && typeof response === 'object'
              ? [response]
              : [];

          this.tickets = dataArray.map((item: any) => item.json ?? item);

          // Filtramos estados activos: Open, Assigned, In progress
          const activeStatuses = ['Open', 'Assigned', 'In progress'];
          this.activeTicketsList = this.tickets.filter((t: any) =>
            activeStatuses.includes(t.status),
          );

          this.visibleActiveCount = this.activeTicketsList.length;
          this.totalTickets = this.tickets.length;
          this.activeTickets = this.activeTicketsList.length;
          this.closedTickets = this.tickets.filter((t: any) => t.status === 'Closed').length;
        } catch (err) {
          console.error('Error procesando datos:', err);
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
          setTimeout(() => this.buildCharts());
        }
      },
      error: (err) => {
        console.error('Error cargando Tickets:', err);
        this.tickets = [];
        this.activeTicketsList = [];
        this.visibleActiveCount = 0;
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.buildCharts());
      },
    });
  }

  onTableFilter(event: any): void {
    this.visibleActiveCount = event?.filteredValue?.length ?? this.activeTicketsList.length;
  }

  // ─────────────────── Drawer ───────────────────
  openTicket(ticket: any): void {
    this.selectedTicket = ticket;
    this.drawerVisible = true;
    this.messages = this.buildMessages([ticket]);
    this.cdr.detectChanges();
  }

  closeDrawer(): void {
    this.drawerVisible = false;
    this.selectedTicket = null;
    this.messages = [];
    this.lightboxSrc = null;
  }

  private buildMessages(items: any[]): Message[] {
    const result: Message[] = [];
    items.forEach((item) => {
      const userBody = item.body_html ?? item.body ?? item.message ?? '';
      if (userBody) {
        result.push({
          id: item.ticket_id + '-user',
          from: item.email ?? 'Desconocido',
          date: item.created_at ?? '',
          body: this.cleanEmailHtml(userBody),
          isAgent: false,
          attachments: this.extractAttachments(item),
        });
      }
      const agentBody = item.resolution_notes ?? '';
      if (agentBody) {
        result.push({
          id: item.ticket_id + '-agent',
          from: item.assigned_agent ?? 'Agente de soporte',
          date: item.closed_at ?? item.created_at ?? '',
          body: this.cleanEmailHtml(agentBody),
          isAgent: true,
          attachments: [],
        });
      }
    });
    return result;
  }

  // ─────────────────── Helpers UI ───────────────────
  private cleanEmailHtml(html: string): string {
    if (!html) return '';
    return html
      .replace(/\ssrc=["'][^"']*cid:[^"']*["']/gi, ' src=""')
      .replace(/\ssrcset=["'][^"']*["']/gi, '')
      .replace(/\sbackground=["'][^"']*cid:[^"']*["']/gi, '');
  }

  extractImages(html: string): string[] {
    if (!html) return [];
    return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((s) => s && !s.startsWith('data:') && !s.startsWith('cid:') && s.trim() !== '');
  }

  isImageUrl(url: string): boolean {
    if (!url || url.startsWith('cid:') || url.startsWith('data:')) return false;
    return /\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
  }

  private extractAttachments(item: any) {
    if (!Array.isArray(item.attachments)) return [];
    return item.attachments.map((a: any) => {
      const url = a.url ?? a.src ?? a.path ?? '';
      return { name: a.name ?? a.filename ?? 'archivo', url, isImage: this.isImageUrl(url) };
    });
  }

  isHtml(s: string): boolean {
    return /<[a-z][\s\S]*>/i.test(s ?? '');
  }

  safeHtml(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(this.cleanEmailHtml(html));
  }

  initial(name: string): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  openLightbox(src: string): void {
    this.lightboxSrc = src;
  }
  closeLightbox(): void {
    this.lightboxSrc = null;
  }

  clearFilters(): void {
    this.dt?.clear();
    this.visibleActiveCount = this.activeTicketsList.length;
  }

  onGlobalFilter(e: Event): void {
    this.dt?.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }

  // ─────────────────── Estilos y Etiquetas ───────────────────
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

  // ─────────────────── Charts ───────────────────
  private buildCharts(): void {
    this.destroyCharts();
    this.buildStatusChart();
    this.buildPriorityChart();
    this.buildTrendChart();
  }

  private buildStatusChart(): void {
    const ctx = this.statusChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const counts = {
      open: this.tickets.filter((t) => t.status === 'Open').length,
      assigned: this.tickets.filter((t) => t.status === 'Assigned').length,
      progress: this.tickets.filter((t) => t.status === 'In progress').length,
      closed: this.tickets.filter((t) => t.status === 'Closed').length,
    };

    this.charts.push(
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Abiertos', 'Asignados', 'En Proceso', 'Cerrados'],
          datasets: [
            {
              data: [counts.open, counts.assigned, counts.progress, counts.closed],
              backgroundColor: ['#3b82f6', '#94a3b8', '#f59e0b', '#10b981'],
              borderWidth: 0,
              hoverOffset: 12,
              spacing: 3,
              borderRadius: 8,
            },
          ],
        },
        options: {
          cutout: '72%',
          responsive: true,
          maintainAspectRatio: false,
          animation: { animateRotate: true, duration: 900 },
          plugins: {
            legend: {
              position: 'bottom' as const,
              labels: {
                usePointStyle: true,
                pointStyle: 'circle' as const,
                padding: 16,
                color: '#475569',
                font: { size: 12, weight: 'bold' as const },
              },
            },
          },
        },
        plugins: [centerTextPlugin as Plugin<'doughnut'>],
      }),
    );
  }

  private buildPriorityChart(): void {
    const ctx = this.priorityChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const priorities = ['P1', 'P2', 'P3', 'P4', 'Solicitud'];
    const counts = priorities.map(
      (p) => this.tickets.filter((t) => (t.priority || '').toUpperCase().includes(p)).length,
    );

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Crítica', 'Alta', 'Media', 'Baja', 'Servicio'],
          datasets: [
            {
              data: counts,
              backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#94a3b8', '#8b5cf6'],
              borderRadius: 10,
              borderSkipped: false,
              maxBarThickness: 46,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0, color: '#94a3b8', font: { size: 11 } },
              grid: { color: '#f1f5f9' },
              border: { display: false },
            },
            x: {
              ticks: { color: '#64748b', font: { size: 11, weight: 'bold' as const } },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      }),
    );
  }

  private buildTrendChart(): void {
    const ctx = this.trendChartRef?.nativeElement?.getContext('2d');
    if (!ctx) return;

    const months = [
      'Ene',
      'Feb',
      'Mar',
      'Abr',
      'May',
      'Jun',
      'Jul',
      'Ago',
      'Sep',
      'Oct',
      'Nov',
      'Dic',
    ];
    const counts = new Array(12).fill(0) as number[];

    this.tickets.forEach((t: any) => {
      if (!t.created_at) return;
      const d = new Date(t.created_at);
      if (!isNaN(d.getTime()) && d.getFullYear() === this.currentYear) {
        counts[d.getMonth()]++;
      }
    });

    const gradient = ctx.createLinearGradient(0, 0, 0, 260);
    gradient.addColorStop(0, 'rgba(99, 102, 241, 0.28)');
    gradient.addColorStop(1, 'rgba(99, 102, 241, 0)');

    this.charts.push(
      new Chart(ctx, {
        type: 'line',
        data: {
          labels: months,
          datasets: [
            {
              label: 'Tickets',
              data: counts,
              borderColor: '#6366f1',
              backgroundColor: gradient,
              fill: true,
              tension: 0.4,
              pointBackgroundColor: '#6366f1',
              pointBorderColor: '#fff',
              pointBorderWidth: 2,
              pointRadius: 4,
              pointHoverRadius: 7,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: {
              beginAtZero: true,
              ticks: { precision: 0, color: '#94a3b8', font: { size: 11 } },
              grid: { color: '#f1f5f9' },
              border: { display: false },
            },
            x: {
              ticks: { color: '#94a3b8', font: { size: 11 } },
              grid: { display: false },
              border: { display: false },
            },
          },
        },
      }),
    );
  }

  private destroyCharts(): void {
    this.charts.forEach((c) => c.destroy());
    this.charts = [];
  }
}
