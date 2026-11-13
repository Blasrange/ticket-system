import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgentService } from '../../core/services/agent';

// Optimus UI
import { DrawerModule } from '@openng/optimus-ui/drawer';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { ButtonModule } from '@openng/optimus-ui/button';
import { SelectModule } from '@openng/optimus-ui/select';
import { PasswordModule } from '@openng/optimus-ui/password';

@Component({
  selector: 'app-agent-form',
  standalone: true,
  imports: [
    CommonModule, 
    ReactiveFormsModule, 
    DrawerModule, 
    InputTextModule, 
    ButtonModule, 
    SelectModule,
    PasswordModule
  ],
  templateUrl: './agent-form.html',
})
export class AgentFormComponent implements OnChanges {
  @Input() visible = false;
  @Input() agentId: string | null = null;
  @Input() agentData: any = null; 
  @Output() visibleChange = new EventEmitter<boolean>();
  @Output() close = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private agentService = inject(AgentService);
  private fb = inject(FormBuilder);

  isEditing = false;
  saving = false;

  roleOptions = [
    { label: 'Administrador', value: 'Admin' },
    { label: 'Jefe', value: 'Jefe' },
    { label: 'Agente', value: 'Agente' },
  ];

  statusOptions = [
    { label: 'Activo', value: true },
    { label: 'Inactivo', value: false },
  ];

  agentForm = this.fb.group({
    full_name: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    role: ['Agente', Validators.required],
    is_active: [true, Validators.required],
    password: [''] 
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && this.visible) {
      this.isEditing = !!this.agentId;
      
      if (this.isEditing) {
        if (this.agentData) {
          this.agentForm.patchValue({
            full_name: this.agentData.full_name,
            email: this.agentData.email,
            role: this.agentData.role,
            is_active: this.agentData.is_active === true || this.agentData.is_active === 'true'
          });
        }
        this.agentForm.get('password')?.clearValidators();
      } else {
        this.agentForm.reset({ role: 'Agente', is_active: true });
        this.agentForm.get('password')?.setValidators([Validators.required, Validators.minLength(6)]);
      }
      this.agentForm.get('password')?.updateValueAndValidity();
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

  async save() {
    if (this.agentForm.invalid) return;
    this.saving = true;

    const formValues = this.agentForm.value;

    let payload: any = {
      full_name: formValues.full_name,
      email: formValues.email,
      role: formValues.role,
      is_active: formValues.is_active
    };

    if (!this.isEditing) {
      payload.password_hash = await this.hashPassword(formValues.password || '');
      payload.created_at = new Date().toISOString();
      
      const randomNum = Math.floor(Math.random() * 99) + 1;
      payload.agent_id = 'A-' + randomNum.toString().padStart(2, '0');
    }

    const request = this.isEditing 
      ? this.agentService.updateAgent(this.agentId!, payload)
      : this.agentService.createAgent(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit();
        this.onClose();
      },
      error: (err) => {
        this.saving = false;
        alert('Error al guardar el agente. Verifica la consola o n8n.');
        console.error(err);
      }
    });
  }

  onClose() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.close.emit();
  }
}