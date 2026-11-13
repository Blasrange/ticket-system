import {
  Component,
  OnChanges,
  SimpleChanges,
  Input,
  Output,
  EventEmitter,
  inject,
  ChangeDetectorRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeUrl } from '@angular/platform-browser';
import { TicketService } from '../../core/services/ticket';
import { NotificationService } from '../../core/services/notification'; // 👈 IMPORTAMOS
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DrawerModule } from '@openng/optimus-ui/drawer';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export interface Attachment {
  name: string;
  url: string;
  type: 'image' | 'file';
}
export interface Message {
  id: string;
  from: string;
  date: string;
  subject: string;
  body: string;
  cleanBody: string;
  isHtml: boolean;
  htmlImages: string[];
  isAgent: boolean;
  attachments: Attachment[];
}

@Component({
  selector: 'app-ticket-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TagModule,
    ButtonModule,
    DrawerModule,
    SelectModule,
    TextareaModule,
  ],
  templateUrl: './ticket-detail.html',
  styleUrl: './ticket-detail.css',
})
export class TicketDetail implements OnChanges {
  private ticketService = inject(TicketService);
  private sanitizer = inject(DomSanitizer);
  private cdr = inject(ChangeDetectorRef);
  private notifService = inject(NotificationService); // 👈 INYECTAMOS

  @Input() visible = false;
  @Input() ticketId: string | number | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();

  ticket: any = null;
  messages: Message[] = [];
  loading = false;
  error = false;
  lightboxSrc: string | null = null;

  isEditingStatus = false;
  isEditingAgent = false;
  isEditingPriority = false;

  editStatusValue = '';
  editAgentValue = '';
  editPriorityValue = '';
  agentsList: any[] = [];

  currentAgentEmail = 'brangel@ccl.com.co';

  statusOptions = [
    { label: 'Abierto', value: 'Open' },
    { label: 'Asignado', value: 'Assigned' },
    { label: 'En Proceso', value: 'In progress' },
    { label: 'Cerrado', value: 'Closed' },
  ];

  priorityOptions = [
    { label: 'Crítica', value: 'P1 – Crítica' },
    { label: 'Alta', value: 'P2 – Alta' },
    { label: 'Media', value: 'P3 – Media' },
    { label: 'Baja', value: 'P4 – Baja' },
    { label: 'Servicio', value: 'Solicitud de servicio' },
  ];

  replyText = '';
  sendingReply = false;

  get isTicketClosed(): boolean {
    return this.ticket?.status === 'Closed';
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['ticketId'] && this.ticketId && this.visible) {
      this.loadDetail();
      this.loadAgents();
    }
    if (changes['visible'] && !this.visible) {
      this.lightboxSrc = null;
      this.isEditingStatus = false;
      this.isEditingAgent = false;
      this.isEditingPriority = false;
      this.replyText = '';
    }
  }

  loadAgents() {
    this.ticketService.getAgents().subscribe({
      next: (res: any) => {
        const arr = Array.isArray(res) ? res : [];
        this.agentsList = arr.map((i: any) => i.json ?? i);
      },
      error: (err) => console.error('Error cargando agentes', err),
    });
  }

  loadDetail() {
    if (!this.ticketId) return;
    this.loading = true;
    this.error = false;
    this.ticket = null;
    this.messages = [];

    this.ticketService.getTicketDetail(this.ticketId.toString()).subscribe({
      next: (response: any) => {
        try {
          if (Array.isArray(response)) {
            const rawItems = response.map((i: any) => i.json ?? i);
            this.ticket = rawItems.find((t) => String(t.ticket_id) === String(this.ticketId));
          } else {
            this.ticket = response.json ?? response;
          }
          if (this.ticket) {
            this.editStatusValue = this.ticket.status;
            this.editAgentValue = this.ticket.assigned_agent || '';
            this.editPriorityValue = this.ticket.priority || 'P3';
            this.loadTicketMessages();
          }
        } catch (err) {
          console.error('Error procesando detalle', err);
          this.error = true;
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  loadTicketMessages() {
    if (!this.ticket) return;
    this.ticketService.getMessages(this.ticket.ticket_id).subscribe({
      next: (res: any) => {
        const rawMessages = Array.isArray(res) ? res.map((i: any) => i.json ?? i) : [];
        const initialMessage = this.buildSingleMessage({
          ticket_id: this.ticket.ticket_id + '-initial',
          sender_email: this.ticket.email,
          sender_name: this.ticket.user_name || this.ticket.email,
          created_at: this.ticket.created_at,
          subject: this.ticket.subject,
          body: this.ticket.body_html,
          is_agent: false,
          attachments: this.ticket.attachments,
        });
        const historyMessages = rawMessages.map((msg: any) =>
          this.buildSingleMessage({
            ticket_id: msg.message_id,
            sender_email: msg.sender_email,
            created_at: msg.created_at,
            body: msg.body_html,
            is_agent: msg.is_agent === 'true' || msg.is_agent === true,
            attachments: msg.attachments,
          }),
        );
        this.messages = [initialMessage, ...historyMessages].sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
        );
        this.cdr.detectChanges();
        this.scrollToBottom();
      },
      error: (err) => console.error('Error cargando mensajes', err),
    });
  }

  startEditStatus() {
    this.editStatusValue = this.ticket?.status ?? '';
    this.isEditingStatus = true;
  }
  cancelEditStatus() {
    this.editStatusValue = this.ticket?.status ?? '';
    this.isEditingStatus = false;
  }
  saveStatus() {
    if (!this.ticket) return;
    this.ticketService.updateTicketStatus(this.ticket.ticket_id, this.editStatusValue).subscribe({
      next: () => {
        this.ticket.status = this.editStatusValue;
        this.isEditingStatus = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        // 👇 REEMPLAZO DEL ALERT
        this.notifService.pushManualNotification(
          'Error al actualizar estado',
          'El servidor rechazó la solicitud. Posiblemente falló el envío del correo (Error 500).',
          'danger',
        );
      },
    });
  }

  startEditAgent() {
    this.editAgentValue = this.ticket?.assigned_agent ?? '';
    this.isEditingAgent = true;
  }
  cancelEditAgent() {
    this.editAgentValue = this.ticket?.assigned_agent ?? '';
    this.isEditingAgent = false;
  }
  saveAgent() {
    if (!this.ticket) return;
    const selectedAgent = this.agentsList.find((a) => a.email === this.editAgentValue);
    const agentName = selectedAgent?.full_name ?? '';
    this.ticketService
      .updateTicketAgent(this.ticket.ticket_id, this.editAgentValue, agentName)
      .subscribe({
        next: () => {
          this.ticket.assigned_agent = this.editAgentValue;
          this.ticket.agent_name = agentName;
          this.isEditingAgent = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // 👇 REEMPLAZO DEL ALERT
          this.notifService.pushManualNotification(
            'Error al asignar agente',
            'No se pudo asignar el agente. Intente nuevamente.',
            'danger',
          );
        },
      });
  }

  startEditPriority() {
    this.editPriorityValue = this.ticket?.priority ?? 'P3';
    this.isEditingPriority = true;
  }
  cancelEditPriority() {
    this.editPriorityValue = this.ticket?.priority ?? 'P3';
    this.isEditingPriority = false;
  }
  savePriority() {
    if (!this.ticket) return;
    this.ticketService
      .updateTicketPriority(this.ticket.ticket_id, this.editPriorityValue)
      .subscribe({
        next: () => {
          this.ticket.priority = this.editPriorityValue;
          this.isEditingPriority = false;
          this.cdr.detectChanges();
        },
        error: () => {
          // 👇 REEMPLAZO DEL ALERT
          this.notifService.pushManualNotification(
            'Error al actualizar prioridad',
            'No se pudo cambiar la prioridad del ticket.',
            'danger',
          );
        },
      });
  }

  sendReply() {
    if (this.isTicketClosed || !this.replyText.trim() || !this.ticket) return;
    this.sendingReply = true;
    const currentReply = this.replyText;
    const agentEmail = this.ticket.assigned_agent || this.currentAgentEmail;

    this.ticketService.sendReply(this.ticket.ticket_id, currentReply, agentEmail).subscribe({
      next: () => {
        this.replyText = '';
        this.sendingReply = false;
        this.loadTicketMessages();
      },
      error: () => {
        // 👇 REEMPLAZO DEL ALERT
        this.notifService.pushManualNotification(
          'Error al enviar respuesta',
          'No se pudo enviar la respuesta al correo del usuario.',
          'danger',
        );
        this.sendingReply = false;
      },
    });
  }

  displaySender(): string {
    return this.ticket?.user_name?.trim() || this.ticket?.email || 'Desconocido';
  }
  displayAgent(): string {
    return this.ticket?.agent_name?.trim() || this.ticket?.assigned_agent || 'Sin asignar';
  }

  getTicketAge(ticket: any): string {
    if (!ticket?.created_at) return '—';
    const diffMs = Date.now() - new Date(ticket.created_at).getTime();
    if (diffMs < 0) return '—';
    const minutes = Math.floor(diffMs / (1000 * 60));
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 30) return `${days} día${days !== 1 ? 's' : ''}`;
    return `${Math.floor(days / 30)} mes${Math.floor(days / 30) !== 1 ? 'es' : ''}`;
  }

  private buildSingleMessage(item: any): Message {
    const rawBody = item.body ?? item.body_html ?? item.message ?? '';
    const rawAttachments = this.normalizeAttachments(item.attachments);
    const cleanBody = this.cleanEmailHtml(rawBody, rawAttachments);
    const isHtml = this.isHtml(rawBody);

    return {
      id: item.ticket_id ?? Math.random().toString(),
      from: item.sender_name ?? item.sender_email ?? 'Desconocido',
      date: item.created_at ?? '',
      subject: item.subject ?? '',
      body: rawBody,
      cleanBody,
      isHtml,
      htmlImages: isHtml ? this.extractImagesFromHtml(cleanBody) : [],
      isAgent: !!item.is_agent,
      attachments: this.extractAttachments(rawAttachments),
    };
  }

  private normalizeAttachments(raw: any): any[] {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    if (typeof raw === 'object') return [raw];
    return [];
  }

  private cleanEmailHtml(html: string, rawAttachments: any[] = []): string {
    if (!html) return '';
    const cidMap = new Map<string, string>();
    rawAttachments.forEach((att: any) => {
      const cid = att.content_id ?? att.contentId ?? att.contentID ?? att.cid;
      if (!cid) return;
      let src: string | undefined = att.url ?? att.src ?? att.path;
      if (!src) {
        const b64 = att.data ?? att.base64 ?? att.content ?? att.body;
        if (b64) {
          const mime = att.mimeType ?? att.content_type ?? att.contentType ?? 'image/png';
          src = `data:${mime};base64,${String(b64)
            .replace(/^data:[^;]+;base64,/, '')
            .replace(/\s/g, '')}`;
        }
      }
      if (!src) return;
      const cleanCid = String(cid).replace(/^<|>$/g, '').trim();
      cidMap.set(cleanCid, src);
      cidMap.set(`cid:${cleanCid}`, src);
    });
    let out = html.replace(
      /<img\b([^>]*?)\ssrc=["']cid:([^"']+)["']([^>]*)>/gi,
      (_m, pre, cidVal, post) => {
        const clean = String(cidVal).replace(/^<|>$/g, '').trim();
        const url = cidMap.get(clean) ?? cidMap.get(`cid:${clean}`);
        return url ? `<img${pre} src="${url}"${post}>` : '';
      },
    );
    return out
      .replace(/<img\b[^>]*\ssrc=["']cid:[^"']*["'][^>]*>/gi, '')
      .replace(/\ssrcset=["'][^"']*["']/gi, '');
  }

  private extractImagesFromHtml(html: string): string[] {
    if (!html) return [];
    return [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)]
      .map((m) => m[1])
      .filter((s) => s && (/^https?:\/\//i.test(s) || /^data:image\//i.test(s)));
  }

  private extractAttachments(rawList: any[]): Attachment[] {
    const result: Attachment[] = [];
    rawList.forEach((att: any) => {
      let url: string | undefined = att.url ?? att.src ?? att.path;
      if (!url) {
        const b64 = att.data ?? att.base64 ?? att.content ?? att.body;
        if (b64) {
          const mime =
            att.mimeType ?? att.content_type ?? att.contentType ?? 'application/octet-stream';
          url = `data:${mime};base64,${String(b64)
            .replace(/^data:[^;]+;base64,/, '')
            .replace(/\s/g, '')}`;
        }
      }
      if (!url) return;
      const name = att.name ?? att.filename ?? att.fileName ?? 'archivo';
      const mime = att.mimeType ?? att.content_type ?? att.contentType ?? '';
      result.push({
        name,
        url,
        type: mime.startsWith('image/') || this.isImageUrl(url) ? 'image' : 'file',
      });
    });
    return result;
  }

  isImageUrl(url: string): boolean {
    if (!url) return false;
    return (
      !url.startsWith('cid:') &&
      (url.startsWith('data:image/') || /\.(jpe?g|png|gif|webp|svg|bmp|avif)(\?.*)?$/i.test(url))
    );
  }

  safeUrl(url: string | null): string | SafeUrl {
    return url ? this.sanitizer.bypassSecurityTrustUrl(url) : '';
  }

  safeHtml(html: string) {
    return this.sanitizer.bypassSecurityTrustHtml(html);
  }
  isHtml(s: string): boolean {
    return /<[a-z][\s\S]*>/i.test(s ?? '');
  }
  getInitial(email: string): string {
    return (email ?? '?').charAt(0).toUpperCase();
  }
  openLightbox(src: string) {
    this.lightboxSrc = src;
  }
  closeLightbox() {
    this.lightboxSrc = null;
  }
  onCloseDrawer() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.close.emit();
  }

  translateStatus(status: string): string {
    const map: Record<string, string> = {
      Open: 'Abierto',
      Assigned: 'Asignado',
      'In progress': 'En Proceso',
      Closed: 'Cerrado',
    };
    return map[status] ?? status;
  }

  getStatusSeverity(status: string): Severity {
    const map: Record<string, Severity> = {
      Open: 'info',
      Assigned: 'secondary',
      'In progress': 'warn',
      Closed: 'success',
    };
    return map[status] ?? 'secondary';
  }

  getPriorityClass(p: string): string {
    const s = (p ?? '').toLowerCase().trim();
    if (s.startsWith('p1') || s.includes('crítica') || s.includes('critica') || s === 'critical')
      return 'prio-p1';
    if (s.startsWith('p2') || s.includes('alta') || s === 'high') return 'prio-p2';
    if (s.startsWith('p3') || s.includes('media') || s === 'medium') return 'prio-p3';
    if (s.startsWith('p4') || s.includes('baja') || s === 'low') return 'prio-p4';
    if (s.includes('solicitud') || s.includes('servicio') || s === 'sr') return 'prio-sr';
    return 'prio-p3';
  }

  getPriorityLabel(p: string): string {
    const cls = this.getPriorityClass(p);
    const map: Record<string, string> = {
      'prio-p1': 'Crítica',
      'prio-p2': 'Alta',
      'prio-p3': 'Media',
      'prio-p4': 'Baja',
      'prio-sr': 'Servicio',
    };
    return map[cls] ?? 'Media';
  }

  getPriorityTooltip(p: string): string {
    const cls = this.getPriorityClass(p);
    const map: Record<string, string> = {
      'prio-p1': 'P1 – Crítica',
      'prio-p2': 'P2 – Alta',
      'prio-p3': 'P3 – Media',
      'prio-p4': 'P4 – Baja',
      'prio-sr': 'Solicitud de servicio',
    };
    return map[cls] ?? p ?? 'Sin prioridad';
  }

  getOperationClass(op: string): string {
    const s = (op ?? '').toLowerCase().trim();
    if (s.includes('funza')) return 'op-funza';
    if (s.includes('montevideo')) return 'op-montevideo';
    if (s.includes('barranquilla')) return 'op-barranquilla';
    if (s.includes('medell')) return 'op-medellin';
    if (s.includes('acopi')) return 'op-cali-acopi';
    if (s.includes('cortijo')) return 'op-cali-cortijo';
    if (s.includes('múltiple') || s.includes('multiple')) return 'op-cali-multiple';
    return 'op-unknown';
  }

  getAreaClass(area: string): string {
    const s = (area ?? '').toLowerCase().trim();
    if (s.includes('implement')) return 'area-impl';
    if (s.includes('infra')) return 'area-infra';
    return 'area-unknown';
  }

  getApplicationClass(app: string): string {
    const s = (app ?? '').toLowerCase().trim();
    if (s.includes('tms')) return 'app-tms';
    if (s.includes('batch')) return 'app-batchflow';
    if (s.includes('forms')) return 'app-ccl-forms';
    if (s.includes('twin')) return 'app-digital-twin';
    if (s.includes('control') || s.includes('tower')) return 'app-control-tower';
    if (s.includes('signage')) return 'app-digital-signage';
    if (s.includes('supplier') || s.includes('wms')) return 'app-supplier-wms';
    if (s.includes('certificador') || s.includes('ordenes') || s.includes('órdenes'))
      return 'app-certificador';
    if (s.includes('catalog')) return 'app-catalogs';
    if (s.includes('morph')) return 'app-morph';
    return 'app-unknown';
  }

  getRequestTypeClass(rt: string): string {
    const s = (rt ?? '').toLowerCase().trim();
    if (s.includes('incidente')) return 'rt-incidente';
    if (s.includes('soporte')) return 'rt-soporte';
    if (s.includes('requerimiento')) return 'rt-requerimiento';
    if (s.includes('acceso') || s.includes('permiso')) return 'rt-accesos';
    if (s.includes('consulta')) return 'rt-consulta';
    if (s.includes('datos') || s.includes('informaci')) return 'rt-datos';
    if (s.includes('cambio') || s.includes('configuraci')) return 'rt-cambio';
    if (s.includes('mejora') || s.includes('desarrollo')) return 'rt-mejora';
    return 'rt-unknown';
  }

  private scrollToBottom() {
    setTimeout(() => {
      const list = document.querySelector('.thread-list');
      if (list) list.scrollTop = list.scrollHeight;
    }, 100);
  }
}
