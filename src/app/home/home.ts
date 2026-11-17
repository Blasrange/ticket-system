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

Chart.register(...registerables);

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

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
  ],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home implements OnInit, OnDestroy {
  @ViewChild('dt') dt!: Table;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private ticketService = inject(TicketService);
  private cdr = inject(ChangeDetectorRef);

  // ── Charts ──
  @ViewChild('statusChart') statusChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('priorityChart') priorityChartRef?: ElementRef<HTMLCanvasElement>;
  @ViewChild('trendChart') trendChartRef?: ElementRef<HTMLCanvasElement>;
  private charts: Chart<any, any, any>[] = [];

  readonly currentYear = new Date().getFullYear();
  readonly averageResponseTime = '2.5 h'; // ← antes "SLA Promedio"

  // ── Datos ──
  tickets: any[] = []; // dataset original
  filteredTickets: any[] = []; // dataset tras filtro de área
  loading = true;

  // ── KPIs ──
  totalTickets = 0;
  activeTickets = 0;
  inProgressTickets = 0; 
  closedTickets = 0;
  unassignedTickets = 0;

  // ── Filtro por área ──
  availableAreas: string[] = [];
  areaOptions: { label: string; value: string }[] = [{ label: 'Todas las áreas', value: '' }];
  selectedArea = '';

  // ── Tabla ──
  allActiveTickets: any[] = [];
  activeTicketsList: any[] = [];
  visibleActiveCount = 0;

  ngOnInit(): void {
    this.loadTickets();
  }

  ngOnDestroy(): void {
    this.destroyCharts();
  }

  // ─────────────────── Carga ───────────────────
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

          // Opciones únicas de área
          this.availableAreas = Array.from(
            new Set(
              this.tickets
                .map((t: any) => (t.assigned_area ?? '').toString().trim())
                .filter((a: string) => a !== ''),
            ),
          ).sort();

          this.areaOptions = [
            { label: 'Todas las áreas', value: '' },
            ...this.availableAreas.map((a) => ({ label: a, value: a })),
          ];
          this.selectedArea = '';

          this.applyAreaFilter();
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
        this.filteredTickets = [];
        this.availableAreas = [];
        this.selectedArea = '';
        this.activeTicketsList = [];
        this.allActiveTickets = [];
        this.totalTickets = 0;
        this.activeTickets = 0;
        this.inProgressTickets = 0;
        this.closedTickets = 0;
        this.unassignedTickets = 0;
        this.visibleActiveCount = 0;
        this.loading = false;
        this.cdr.detectChanges();
        setTimeout(() => this.buildCharts());
      },
    });
  }

  // ─────────────────── Filtro por área ───────────────────
  filterByArea(): void {
    this.applyAreaFilter();
    this.cdr.detectChanges();
    setTimeout(() => this.buildCharts());
  }

  private applyAreaFilter(): void {
    this.filteredTickets = this.selectedArea
      ? this.tickets.filter(
          (t: any) => (t.assigned_area ?? '').toString().trim() === this.selectedArea,
        )
      : [...this.tickets];

    const activeStatuses = ['Open', 'Assigned', 'In progress'];
    this.allActiveTickets = this.filteredTickets.filter((t: any) =>
      activeStatuses.includes(t.status),
    );

    this.totalTickets = this.filteredTickets.length;
    this.activeTickets = this.allActiveTickets.length;
    this.inProgressTickets = this.filteredTickets.filter(
      (t: any) => t.status === 'In progress',
    ).length;
    this.closedTickets = this.filteredTickets.filter((t: any) => t.status === 'Closed').length;
    this.unassignedTickets = this.allActiveTickets.filter((t: any) => !t.assigned_agent).length;

    this.activeTicketsList = [...this.allActiveTickets];
    this.visibleActiveCount = this.activeTicketsList.length;
  }

  // ─────────────────── Tabla ───────────────────
  onTableFilter(event: any): void {
    this.visibleActiveCount = event?.filteredValue?.length ?? this.activeTicketsList.length;
  }

  initial(name: string): string {
    return (name ?? '?').charAt(0).toUpperCase();
  }

  clearFilters(): void {
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
    this.selectedArea = '';
    this.filterByArea();
    this.dt?.clear();
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

  // ─────────────────── Charts (usan filteredTickets) ───────────────────
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
      open: this.filteredTickets.filter((t) => t.status === 'Open').length,
      assigned: this.filteredTickets.filter((t) => t.status === 'Assigned').length,
      progress: this.filteredTickets.filter((t) => t.status === 'In progress').length,
      closed: this.filteredTickets.filter((t) => t.status === 'Closed').length,
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
      (p) =>
        this.filteredTickets.filter((t) => (t.priority || '').toUpperCase().includes(p)).length,
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

    this.filteredTickets.forEach((t: any) => {
      if (!t.created_at) return;
      const d = new Date(t.created_at);
      if (!isNaN(d.getTime()) && d.getFullYear() === this.currentYear) counts[d.getMonth()]++;
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
