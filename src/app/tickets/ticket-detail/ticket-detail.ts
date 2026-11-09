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
import { DomSanitizer } from '@angular/platform-browser';
import { TicketService } from '../../core/services/ticket';
import { TagModule } from '@openng/optimus-ui/tag';
import { ButtonModule } from '@openng/optimus-ui/button';
import { DrawerModule } from '@openng/optimus-ui/drawer';
import { SelectModule } from '@openng/optimus-ui/select';
import { TextareaModule } from '@openng/optimus-ui/textarea';

type Severity = 'success' | 'info' | 'warn' | 'danger' | 'secondary' | 'contrast';

export interface Attachment {
  name: string;
  url: string;
  type: string;
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

  @Input() visible = false;
  @Input() ticketId: string | number | null = null;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();

  ticket: any = null;
  messages: Message[] = [];
  loading = false;
  error = false;
  lightboxSrc: string | null = null;

  // Edición de estado y agente
  isEditingStatus = false;
  isEditingAgent = false;
  editStatusValue = '';
  editAgentValue = '';
  agentsList: any[] = [];

  statusOptions = [
    { label: 'Abierto', value: 'Open' },
    { label: 'En Proceso', value: 'Pending' },
    { label: 'Cerrado', value: 'Closed' },
  ];

  replyText = '';
  sendingReply = false;

  ngOnChanges(changes: SimpleChanges) {
    if (changes['ticketId'] && this.ticketId && this.visible) {
      this.loadDetail();
      this.loadAgents();
    }
    if (changes['visible'] && !this.visible) {
      this.lightboxSrc = null;
      this.isEditingStatus = false;
      this.isEditingAgent = false;
      this.replyText = '';
    }
  }

  loadAgents() {
    this.ticketService.getAgents().subscribe({
      next: (res: any) => (this.agentsList = Array.isArray(res) ? res : []),
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
          let items: any[] = [];
          if (response?.ticket) {
            this.ticket = response.ticket;
            items = (response.messages ?? []).map((i: any) => i.json ?? i);
          } else if (Array.isArray(response)) {
            const rawItems = response.map((i: any) => i.json ?? i);
            const foundTicket = rawItems.find((t) => String(t.ticket_id) === String(this.ticketId));
            this.ticket = foundTicket ? foundTicket : rawItems[0];
            items = foundTicket ? [foundTicket] : rawItems;
          } else {
            const item = response.json ?? response;
            this.ticket = item;
            items = [item];
          }

          if (this.ticket) {
            this.editStatusValue = this.ticket.status;
            this.editAgentValue = this.ticket.assigned_agent || '';
          }
          this.messages = this.buildMessages(items);
        } catch (err) {
          this.error = true;
        } finally {
          this.loading = false;
          this.cdr.detectChanges();
          this.scrollToBottom();
        }
      },
      error: () => {
        this.error = true;
        this.loading = false;
        this.cdr.detectChanges();
      },
    });
  }

  // ─────────────────── ACCIONES CON BASE DE DATOS ───────────────────

  saveStatus() {
    if (!this.ticket) return;
    this.ticketService.updateTicketStatus(this.ticket.ticket_id, this.editStatusValue).subscribe({
      next: () => {
        this.ticket.status = this.editStatusValue;
        this.isEditingStatus = false;
        this.cdr.detectChanges();
      },
      error: () => alert('Error al actualizar el estado'),
    });
  }

  saveAgent() {
    if (!this.ticket) return;
    this.ticketService.updateTicketAgent(this.ticket.ticket_id, this.editAgentValue).subscribe({
      next: () => {
        this.ticket.assigned_agent = this.editAgentValue;
        this.isEditingAgent = false;
        this.cdr.detectChanges();
      },
      error: () => alert('Error al asignar el agente'),
    });
  }

  sendReply() {
    if (!this.replyText.trim() || !this.ticket) return;

    this.sendingReply = true;
    const currentReply = this.replyText;

    this.ticketService
      .sendReply(this.ticket.ticket_id, currentReply, 'Agente de soporte')
      .subscribe({
        next: () => {
          const newMsg = this.buildSingleMessage({
            ticket_id: this.ticket.ticket_id + '-agent-' + Date.now(),
            sender_email: 'Tú (Agente)',
            created_at: new Date().toISOString(),
            body: currentReply,
            is_agent: true,
          });

          this.messages = [...this.messages, newMsg];
          this.replyText = '';
          this.sendingReply = false;
          this.scrollToBottom();
          this.cdr.detectChanges();
        },
        error: () => {
          alert('Error al enviar la respuesta');
          this.sendingReply = false;
        },
      });
  }

  // ─────────────────── CONSTRUCTORES Y HELPERS ───────────────────

  private buildMessages(items: any[]): Message[] {
    const msgs: Message[] = [];
    items.forEach((item) => {
      const rawBody = item.body_html ?? item.body ?? item.message ?? '';
      if (rawBody) {
        msgs.push(
          this.buildSingleMessage({
            ...item,
            sender_email: item.sender_email ?? 'Desconocido',
            created_at: item.created_at ?? '',
            is_agent: false,
          }),
        );
      }
      const agentBody = item.resolution_notes ?? '';
      if (agentBody) {
        msgs.push(
          this.buildSingleMessage({
            ...item,
            sender_email: item.assigned_agent ?? 'Agente de soporte',
            created_at: item.closed_at ?? item.created_at ?? '',
            body: agentBody,
            is_agent: true,
          }),
        );
      }
    });
    return msgs;
  }

  private buildSingleMessage(item: any): Message {
    const rawBody = item.body ?? item.body_html ?? item.message ?? '';
    const rawAttachments = Array.isArray(item.attachments) ? item.attachments : [];
    const cleanBody = this.cleanEmailHtml(rawBody, rawAttachments);
    const isHtml = this.isHtml(rawBody);

    return {
      id: item.ticket_id ?? Math.random().toString(),
      from: item.sender_email ?? 'Desconocido',
      date: item.created_at ?? '',
      subject: item.subject ?? '',
      body: rawBody,
      cleanBody,
      isHtml,
      htmlImages: isHtml ? this.extractImagesFromHtml(cleanBody) : [],
      isAgent: !!item.is_agent,
      attachments: this.extractAttachments(item),
    };
  }

  private cleanEmailHtml(html: string, rawAttachments: any[] = []): string {
    if (!html) return '';
    const cidMap = new Map<string, string>();
    rawAttachments.forEach((att: any) => {
      const cid = att.content_id ?? att.contentId ?? att.cid;
      const url = att.url ?? att.src ?? att.path;
      if (cid && url) {
        const clean = String(cid).replace(/^<|>$/g, '');
        cidMap.set(clean, url);
        cidMap.set(`cid:${clean}`, url);
      }
    });

    let out = html;
    out = out.replace(
      /<img\b([^>]*?)\ssrc=["']cid:([^"']+)["']([^>]*)>/gi,
      (_m, pre, cidVal, post) => {
        const clean = String(cidVal).replace(/^<|>$/g, '');
        const url = cidMap.get(clean) ?? cidMap.get(`cid:${clean}`);
        if (!url) return '';
        return `<img${pre} src="${url}"${post}>`;
      },
    );

    return out
      .replace(/<img\b[^>]*\ssrc=["']cid:[^"']*["'][^>]*>/gi, '')
      .replace(/<img\b[^>]*\ssrc=["']["'][^>]*>/gi, '')
      .replace(/\ssrcset=["'][^"']*["']/gi, '')
      .replace(/\sbackground=["'][^"']*cid:[^"']*["']/gi, '');
  }

  private extractImagesFromHtml(html: string): string[] {
    if (!html) return [];
    const matches = html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi);
    return [...matches].map((m) => m[1]).filter((s) => !!s && /^https?:\/\//i.test(s.trim()));
  }

  private extractAttachments(item: any): Attachment[] {
    const result: Attachment[] = [];
    if (Array.isArray(item.attachments)) {
      item.attachments.forEach((att: any) => {
        const url = att.url ?? att.src ?? att.path ?? '';
        const name = att.name ?? att.filename ?? 'archivo';
        const type = this.isImageUrl(url) ? 'image' : 'file';
        if (url) result.push({ name, url, type });
      });
    }
    return result;
  }

  isImageUrl(url: string): boolean {
    if (!url || url.startsWith('cid:') || url.startsWith('data:')) return false;
    return /\.(jpe?g|png|gif|webp|svg|bmp)(\?.*)?$/i.test(url);
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
      Pending: 'En Proceso',
      Closed: 'Cerrado',
    };
    return map[status] ?? status;
  }

  translatePriority(priority: string): string {
    const map: Record<string, string> = {
      Critical: 'Crítica',
      High: 'Alta',
      Medium: 'Media',
      Low: 'Baja',
    };
    return map[priority] ?? priority;
  }

  getStatusSeverity(status: string): Severity {
    const map: Record<string, Severity> = { Open: 'info', Pending: 'warn', Closed: 'success' };
    return map[status] ?? 'secondary';
  }

  getPrioritySeverity(priority: string): Severity {
    const map: Record<string, Severity> = {
      Critical: 'danger',
      High: 'warn',
      Medium: 'info',
      Low: 'secondary',
    };
    return map[priority] ?? 'secondary';
  }

  private scrollToBottom() {
    setTimeout(() => {
      const list = document.querySelector('.thread-list');
      if (list) list.scrollTop = list.scrollHeight;
    }, 100);
  }
}
