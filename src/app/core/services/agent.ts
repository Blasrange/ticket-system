import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

@Injectable({
  providedIn: 'root'
})
export class AgentService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}`;

  /** Lista de todos los agentes */
  getAgents(): Observable<any[]> {
    // ⚠️ Nota: Si tu webhook en n8n se llama diferente (ej. /agentes), cámbialo aquí abajo
    return this.http.get<any[]>(`${this.apiUrl}/get-agents`);
  }

  /** (Opcional) Detalle de un agente por ID */
  getAgentDetail(agentId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-agent-detail?agent_id=${agentId}`);
  }
}
