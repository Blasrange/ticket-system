import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { ButtonModule } from '@openng/optimus-ui/button';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule],
  template: `
    <p-dialog
      [(visible)]="visible"
      (visibleChange)="visibleChange.emit($event)"
      header="Exportar a Excel"
      [modal]="true"
      [style]="{ width: '420px' }"
      styleClass="export-dialog"
    >
      <div class="export-form">
        <p class="export-desc">
          Selecciona el rango de fechas para descargar el historial de tickets.
        </p>

        <div class="field">
          <label>Fecha Inicio</label>
          <input type="date" class="p-inputtext w-full" [(ngModel)]="startDate" />
        </div>

        <div class="field">
          <label>Fecha Fin</label>
          <input type="date" class="p-inputtext w-full" [(ngModel)]="endDate" />
        </div>
      </div>

      <ng-template #footer>
        <p-button label="Cancelar" [text]="true" severity="secondary" (onClick)="close()" />
        <p-button
          label="Descargar Excel"
          icon="pi pi-file-excel"
          (onClick)="download()"
          [disabled]="!startDate || !endDate"
        />
      </ng-template>
    </p-dialog>
  `,
  styles: [
    `
      .export-form {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding-top: 10px;
      }
      .export-desc {
        font-size: 0.85rem;
        color: #64748b;
        margin: 0 0 8px 0;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }
      .field label {
        font-size: 0.8rem;
        font-weight: 600;
        color: #334155;
      }
      :host ::ng-deep .p-inputtext {
        width: 100%;
        padding: 8px 12px;
        border-radius: 8px;
        border: 1px solid #e2e8f0;
      }
    `,
  ],
})
export class ExportModalComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() onExport = new EventEmitter<{ start: string; end: string }>();

  startDate = '';
  endDate = '';

  close() {
    this.visibleChange.emit(false);
  }

  download() {
    if (this.startDate && this.endDate) {
      this.onExport.emit({ start: this.startDate, end: this.endDate });
      this.close();
    }
  }
}
