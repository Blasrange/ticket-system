import { Component, Input, Output, EventEmitter, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { AgentService } from '../../core/services/agent';
import { NotificationService } from '../../core/services/notification';

import { DialogModule } from '@openng/optimus-ui/dialog';
import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { ButtonModule } from '@openng/optimus-ui/button';
import { PasswordModule } from '@openng/optimus-ui/password';

@Component({
  selector: 'app-forgot-password',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    InputTextModule,
    ButtonModule,
    PasswordModule,
  ],
  templateUrl: './forgot-password.html',
})
export class ForgotPasswordComponent {
  @Input() visible = false;
  @Output() visibleChange = new EventEmitter<boolean>();

  private fb = inject(FormBuilder);
  private agentService = inject(AgentService);
  private notifService = inject(NotificationService);

  isLoading = false;
  errorMessage = '';
  successMessage = '';

  resetForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  close() {
    this.visibleChange.emit(false);
    setTimeout(() => {
      this.resetForm.reset();
      this.errorMessage = '';
      this.successMessage = '';
    }, 300);
  }

  private async hashPassword(password: string): Promise<string> {
    const msgBuffer = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  async onSubmit() {
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';
    this.successMessage = '';

    const email = this.resetForm.value.email!.trim().toLowerCase();
    const newPassword = this.resetForm.value.password!;

    // 1. Buscamos al agente
    this.agentService.getAgents().subscribe({
      next: async (res: any) => {
        const arr = Array.isArray(res) ? res : res ? [res] : [];
        const agents = arr.map((i: any) => i.json ?? i);

        const agent = agents.find((a: any) => (a.email || '').toLowerCase() === email);

        if (!agent) {
          this.errorMessage = 'El correo ingresado no se encuentra registrado.';
          this.isLoading = false;
          return;
        }

        // 2. Encriptamos la nueva contraseña
        const newHash = await this.hashPassword(newPassword);

        // 3. Actualizamos el agente
        this.agentService
          .updateAgent(agent.agent_id, {
            ...agent,
            password_hash: newHash,
          })
          .subscribe({
            next: () => {
              this.isLoading = false;
              this.successMessage = '¡Contraseña actualizada! Ya puedes iniciar sesión.';
              this.notifService.pushManualNotification(
                'Contraseña Restablecida',
                `Se actualizó la clave para ${email}.`,
                'info',
              );

              setTimeout(() => this.close(), 2500);
            },
            error: (err) => {
              this.isLoading = false;
              this.errorMessage = 'Error al actualizar la contraseña en el servidor.';
              console.error(err);
            },
          });
      },
      error: (err) => {
        this.isLoading = false;
        this.errorMessage = 'Error de conexión al buscar el usuario.';
        console.error(err);
      },
    });
  }
}
