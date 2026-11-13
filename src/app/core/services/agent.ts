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

  getAgents(): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/get-agents`);
  }

  getAgentDetail(agentId: string): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/get-agent-detail?agent_id=${agentId}`);
  }

  // 👇 NUEVOS MÉTODOS
  createAgent(data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/create-agent`, data);
  }

  updateAgent(agentId: string, data: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-agent`, { agent_id: agentId, ...data });
  }
}
