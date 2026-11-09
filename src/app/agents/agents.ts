import { Component, inject, OnInit, ChangeDetectorRef, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

// Optimus UI
import { TableModule, Table } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';

// Servicios
import { AgentService } from '../core/services/agent';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-agents',
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
  ],
  templateUrl: './agents.html',
  styleUrl: './agents.css',
})
export class Agents implements OnInit {
  @ViewChild('dt') dt!: Table;

  private agentService = inject(AgentService);
  private cdr = inject(ChangeDetectorRef);

  // ── Lista ──
  agents: any[] = [];
  loading = true;

  ngOnInit() {
    this.loadAgents();
  }

  // ─────────────────── Lista ───────────────────
  loadAgents() {
    this.loading = true;
    this.agentService.getAgents().subscribe({
      next: (res: any) => {
        try {
          const arr = Array.isArray(res) ? res : res ? [res] : [];
          // Mapeo estándar de n8n
          this.agents = arr.map((item: any) => item.json ?? item);
        } catch (e) {
          console.error('Error procesando agentes:', e);
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (err) => {
        console.error('Error cargando agentes:', err);
        this.agents = [];
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─────────────────── Helpers ───────────────────

  initial(str: string): string {
    return (str ?? '?').charAt(0).toUpperCase();
  }

  clearFilters() {
    this.dt.clear();
  }

  onGlobalFilter(e: Event) {
    this.dt.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }

  // Como is_active viene como booleano, evaluamos si es true/false o string
  getStatusSeverity(is_active: any): Severity {
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 'activo') {
      return 'success';
    }
    if (
      is_active === false ||
      is_active === 'false' ||
      is_active === 0 ||
      is_active === 'inactivo'
    ) {
      return 'danger';
    }
    return 'secondary';
  }

  translateStatus(is_active: any): string {
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 'activo') {
      return 'Activo';
    }
    if (
      is_active === false ||
      is_active === 'false' ||
      is_active === 0 ||
      is_active === 'inactivo'
    ) {
      return 'Inactivo';
    }
    return 'Desconocido';
  }
}
