import { Component, inject, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NotificationService, AppNotification } from '../../services/notification';
import { PopoverModule, Popover } from '@openng/optimus-ui/popover';

@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [CommonModule, PopoverModule],
  templateUrl: './notification-bell.html'
})
export class NotificationBellComponent {
  private notifService = inject(NotificationService);
  @ViewChild('notifPanel') notifPanel!: Popover;

  // Exponemos las señales del servicio para el HTML
  notifications = this.notifService.notifications;
  unreadCount = this.notifService.unreadCount;
  dangerCount = this.notifService.dangerCount;
  warningCount = this.notifService.warningCount;

  toggleNotifications(event: any) {
    this.notifService.refresh(); // Refresca al abrir
    this.notifPanel.toggle(event);
  }

  markAllAsRead() {
    this.notifService.markAllAsRead();
  }

  // 👇 AQUÍ ESTÁ LA MAGIA: Solo marca como leída, no envía a ningún lado
  onNotifClick(n: AppNotification) {
    if (!n.read) {
      this.notifService.markAsRead(n.id);
    }
    // No redirigimos, no cerramos el panel. Solo se marca como leída.
  }

  trackById(index: number, item: AppNotification) {
    return item.id;
  }

  getNotifIcon(type: string): string {
    switch (type) {
      case 'danger': return 'pi-exclamation-circle';
      case 'warning': return 'pi-exclamation-triangle';
      default: return 'pi-info-circle';
    }
  }
}