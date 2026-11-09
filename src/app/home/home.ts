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

/* ==========================================================
   Plugin: texto central del donut
   ========================================================== */
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
  openTickets = 0;
  closedTickets = 0;

  // ── Tabla: lista estable (NO usar getter, rompe el filtro del p-table) ──
  openTicketsList: any[] = [];
  visibleOpenCount = 0;

  // ── Drawer ──
  drawerVisible = false;
  selectedTicket: any = null;
  messages: Message[] = [];
  loadingMessages = false;

  // ── Lightbox ──
  lightboxSrc: string | null = null;

  // ── Filtros ──
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

          // 👇 Lista estable (una sola vez, no en cada CD)
          this.openTicketsList = this.tickets.filter((t: any) => t.status === 'Open');
          this.visibleOpenCount = this.openTicketsList.length;

          this.totalTickets = this.tickets.length;
          this.openTickets = this.openTicketsList.length;
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
        this.openTicketsList = [];
        this.visibleOpenCount = 0;
        this.totalTickets = 0;
        this.openTickets = 0;
        this.closedTickets = 0;
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.buildCharts());
      },
    });
  }

  // ─────────────────── Tabla: filtro en vivo ───────────────────
  onTableFilter(event: any): void {
    this.visibleOpenCount = event?.filteredValue?.length ?? this.openTicketsList.length;
  }

  // ─────────────────── Drawer ───────────────────
  openTicket(ticket: any): void {
    this.selectedTicket = ticket;
    this.drawerVisible = true;
    this.loadingMessages = false;
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
          from: item.sender_email ?? 'Desconocido',
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

  private extractAttachments(item: any) {
    if (!Array.isArray(item.attachments)) return [];
    return item.attachments.map((a: any) => {
      const url = a.url ?? a.src ?? a.path ?? '';
      return { name: a.name ?? a.filename ?? 'archivo', url, isImage: this.isImageUrl(url) };
    });
  }

  // ─────────────────── Helpers ───────────────────
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

  isHtml(s: string): boolean {
    return /<[a-z][\s\S]*>/i.test(s ?? '');
  }

  safeHtml(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(this.cleanEmailHtml(html));
  }

  initial(email: string): string {
    return (email ?? '?').charAt(0).toUpperCase();
  }

  openLightbox(src: string): void {
    this.lightboxSrc = src;
  }
  closeLightbox(): void {
    this.lightboxSrc = null;
  }

  clearFilters(): void {
    this.dt?.clear();
    this.visibleOpenCount = this.openTicketsList.length;
  }

  onGlobalFilter(e: Event): void {
    this.dt?.filterGlobal((e.target as HTMLInputElement).value, 'contains');
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

    this.charts.push(
      new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Abiertos', 'Cerrados'],
          datasets: [
            {
              data: [this.openTickets, this.closedTickets],
              backgroundColor: ['#3b82f6', '#10b981'],
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

    const priorities = ['Critical', 'High', 'Medium', 'Low'];
    const counts = priorities.map((p) => this.tickets.filter((t: any) => t.priority === p).length);

    this.charts.push(
      new Chart(ctx, {
        type: 'bar',
        data: {
          labels: ['Crítica', 'Alta', 'Media', 'Baja'],
          datasets: [
            {
              data: counts,
              backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#94a3b8'],
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
