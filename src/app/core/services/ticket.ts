import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments';

@Injectable({ providedIn: 'root' })
export class TicketService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  getTickets(): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-tickets`);
  }

  getTicketDetail(id: string): Observable<any> {
    return this.getTickets();
  }

  getAgents(): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-agents`);
  }

  getMessages(ticketId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/get-messages`, { ticket_id: ticketId });
  }

  updateTicketStatus(ticketId: string, status: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-ticket-status`, {
      ticket_id: ticketId,
      status,
    });
  }

  updateTicketAgent(ticketId: string, agentEmail: string, agentName: string = ''): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-ticket-agent`, {
      ticket_id: ticketId,
      assigned_agent: agentEmail,
      agent_name: agentName,
    });
  }

  // NUEVO: Endpoint para actualizar la prioridad
  updateTicketPriority(ticketId: string, priority: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-ticket-priority`, {
      ticket_id: ticketId,
      priority: priority,
    });
  }

  sendReply(ticketId: string, body: string, senderEmail: string, files: File[] = []): Observable<any> {
    if (files.length > 0) {
      console.warn(`[sendReply] Archivos no soportados aún.`);
    }
    return this.http.post(`${this.apiUrl}/add-reply`, {
      ticket_id: ticketId,
      body: body,
      sender_email: senderEmail,
      created_at: new Date().toISOString(),
      message_id: 'MSG-' + Math.random().toString(36).substring(2, 8).toUpperCase(),
      is_agent: true,
    });
  }
}