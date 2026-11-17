import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnChanges,
  SimpleChanges,
  inject,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgentService } from '../../core/services/agent';
import { NotificationService } from '../../core/services/notification';

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
    PasswordModule,
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
  private notifService = inject(NotificationService);
  private fb = inject(FormBuilder);

  isEditing = false;
  saving = false;
  serverError = '';

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
    password: [''], // 👈 Siempre presente
  });

  ngOnChanges(changes: SimpleChanges) {
    if (changes['visible'] && this.visible) {
      this.isEditing = !!this.agentId;
      this.serverError = '';

      if (this.isEditing) {
        if (this.agentData) {
          this.agentForm.patchValue({
            full_name: this.agentData.full_name,
            email: this.agentData.email,
            role: this.agentData.role,
            is_active: this.agentData.is_active === true || this.agentData.is_active === 'true',
            password: '', // Limpiamos el campo de contraseña al abrir
          });
        }
        // Al editar, la contraseña es opcional (solo validamos longitud si escriben algo)
        this.agentForm.get('password')?.setValidators([Validators.minLength(6)]);
      } else {
        this.agentForm.reset({ role: 'Agente', is_active: true, password: '' });
        // Al crear, la contraseña es obligatoria
        this.agentForm
          .get('password')
          ?.setValidators([Validators.required, Validators.minLength(6)]);
      }
      this.agentForm.get('password')?.updateValueAndValidity();
    }
  }

  private async hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async save() {
    if (this.agentForm.invalid) return;
    this.saving = true;
    this.serverError = '';

    const formValues = this.agentForm.value;

    let payload: any = {
      full_name: formValues.full_name,
      email: formValues.email,
      role: formValues.role,
      is_active: formValues.is_active,
    };

    // 👇 LÓGICA CLAVE: Si el usuario escribió una contraseña (nueva o editada), la encriptamos y enviamos
    if (formValues.password && formValues.password.trim() !== '') {
      payload.password_hash = await this.hashPassword(formValues.password);
    }

    if (!this.isEditing) {
      // Si es nuevo agente, agregamos la fecha de creación
      payload.created_at = new Date().toISOString();
    }

    const request = this.isEditing
      ? this.agentService.updateAgent(this.agentId!, payload)
      : this.agentService.createAgent(payload);

    request.subscribe({
      next: () => {
        this.saving = false;
        this.saved.emit();
        this.onClose();

        this.notifService.pushManualNotification(
          'Agente Guardado',
          `El agente ${payload.full_name} se guardó correctamente.`,
          'info',
        );
      },
      error: (err) => {
        this.saving = false;
        const errorMsg = err.error?.message || 'Error al guardar el agente. Verifica los datos.';
        this.serverError = errorMsg;

        this.notifService.pushManualNotification('Error al guardar agente', errorMsg, 'danger');
      },
    });
  }

  onClose() {
    this.visible = false;
    this.visibleChange.emit(false);
    this.close.emit();
  }
}
