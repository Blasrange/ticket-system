import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DialogModule } from '@openng/optimus-ui/dialog';
import { ButtonModule } from '@openng/optimus-ui/button';
import { InputTextModule } from '@openng/optimus-ui/inputtext';

@Component({
  selector: 'app-export-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, DialogModule, ButtonModule, InputTextModule],
  templateUrl: './export-modal.html',
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