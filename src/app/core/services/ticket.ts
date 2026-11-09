import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environments'; // ajusta la ruta si es necesario

@Injectable({ providedIn: 'root' })
export class TicketService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  /**
   * ✅ NUEVO: Para la tabla del listado (componente padre `Tickets`).
   * Devuelve TODOS los tiques.
   */
  getTickets(): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-tickets`);
  }

  /**
   * Para el detalle (componente hijo `TicketDetail`).
   * Usa el mismo endpoint porque n8n no tiene uno específico por ID;
   * el componente filtra por `ticket_id` internamente.
   */
  getTicketDetail(ticketId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-tickets`);
  }

  /**
   * Lista de agentes para el dropdown de asignación.
   */
  getAgents(): Observable<any> {
    return this.http.get(`${this.apiUrl}/get-agents`);
  }

  /**
   * Guarda el cambio de estado en Google Sheets vía n8n.
   */
  updateTicketStatus(ticketId: string, status: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-ticket-status`, {
      ticket_id: ticketId,
      status,
    });
  }

  /**
   * Guarda el agente asignado en Google Sheets vía n8n.
   */
  updateTicketAgent(ticketId: string, agentEmail: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/update-ticket-agent`, {
      ticket_id: ticketId,
      assigned_agent: agentEmail,
    });
  }

  /**
   * Guarda la respuesta del agente en `resolution_notes`.
   */
  sendReply(ticketId: string, body: string, senderEmail: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/add-reply`, {
      ticket_id: ticketId,
      body: body,
      sender_email: senderEmail,
    });
  }
}