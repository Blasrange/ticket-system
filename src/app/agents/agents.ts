import { Component, inject, OnInit, ChangeDetectorRef, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

import { TableModule, Table } from '@openng/optimus-ui/table';
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';

import { AgentService } from '../core/services/agent';
import { AgentFormComponent } from './agent-form/agent-form';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

@Component({
  selector: 'app-agents',
  standalone: true,
  imports: [
    CommonModule, FormsModule, TableModule, TagModule, ButtonModule,
    InputTextModule, IconFieldModule, InputIconModule, AgentFormComponent
  ],
  templateUrl: './agents.html',
  styleUrl: './agents.css',
})
export class Agents implements OnInit {
  @ViewChild('dt') dt!: Table;
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;

  private agentService = inject(AgentService);
  private cdr = inject(ChangeDetectorRef);

  agents: any[] = [];
  loading = true;

  drawerVisible = false;
  selectedAgentId: string | null = null;
  selectedAgentData: any = null;

  ngOnInit() {
    this.loadAgents();
  }

  loadAgents() {
    this.loading = true;
    this.agentService.getAgents().subscribe({
      next: (res: any) => {
        try {
          const arr = Array.isArray(res) ? res : res ? [res] : [];
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

  openCreate() {
    this.selectedAgentId = null;
    this.selectedAgentData = null;
    this.resetFilters(); // Limpiamos filtros
    this.drawerVisible = true;
  }

  openEdit(agent: any) {
    this.selectedAgentId = agent.agent_id;
    this.selectedAgentData = agent;
    this.resetFilters(); // Limpiamos filtros
    this.drawerVisible = true;
  }

  onAgentSaved() {
    this.loadAgents();
  }

  private resetFilters() {
    if (this.dt) {
      this.dt.clear();
    }
    if (this.searchInput) {
      this.searchInput.nativeElement.value = '';
    }
  }

  initial(str: string): string {
    return (str ?? '?').charAt(0).toUpperCase();
  }

  clearFilters() {
    this.resetFilters();
  }

  onGlobalFilter(e: Event) {
    this.dt.filterGlobal((e.target as HTMLInputElement).value, 'contains');
  }

  getStatusSeverity(is_active: any): Severity {
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 'activo') return 'success';
    if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'inactivo') return 'danger';
    return 'secondary';
  }

  translateStatus(is_active: any): string {
    if (is_active === true || is_active === 'true' || is_active === 1 || is_active === 'activo') return 'Activo';
    if (is_active === false || is_active === 'false' || is_active === 0 || is_active === 'inactivo') return 'Inactivo';
    return 'Desconocido';
  }

  getRoleClass(role: string): string {
    const r = (role || '').toLowerCase();
    if (r.includes('admin')) return 'role-admin';
    if (r.includes('jefe')) return 'role-jefe';
    return 'role-agente';
  }
}