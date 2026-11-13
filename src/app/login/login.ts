import { Component, inject, ChangeDetectorRef } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AuthService } from '../core/services/auth';
import { finalize } from 'rxjs/operators';

import { InputTextModule } from '@openng/optimus-ui/inputtext';
import { PasswordModule } from '@openng/optimus-ui/password';
import { ButtonModule } from '@openng/optimus-ui/button';
import { CheckboxModule } from '@openng/optimus-ui/checkbox';
import { IconFieldModule } from '@openng/optimus-ui/iconfield';
import { InputIconModule } from '@openng/optimus-ui/inputicon';
import { MessageModule } from '@openng/optimus-ui/message';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    InputTextModule,
    PasswordModule,
    ButtonModule,
    CheckboxModule,
    IconFieldModule,
    InputIconModule,
    MessageModule,
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef); // 👈 Para forzar actualización de pantalla

  isLoading = false;
  loginError = false;
  errorMessage = '';

  loginForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
    rememberMe: [false],
  });

  onSubmit() {
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    this.isLoading = true;
    this.loginError = false;
    this.errorMessage = '';

    // Limpiamos cualquier sesión previa
    this.authService.logout();

    const credentials = {
      email: this.loginForm.value.email!,
      password: this.loginForm.value.password!,
    };

    this.authService
      .login(credentials)
      .pipe(
        finalize(() => {
          this.isLoading = false; // 👈 Siempre apagamos el spinner
          this.cdr.detectChanges(); // 👈 Forzamos a Angular a pintar el cambio
        }),
      )
      .subscribe({
        next: (response: any) => {
          try {
            localStorage.setItem(
              'currentUser',
              JSON.stringify({
                agent_id: response.agent_id,
                email: response.email,
                full_name: response.full_name,
                role: response.role,
              }),
            );
          } catch (e) {
            console.error('Error guardando usuario', e);
          }
          this.router.navigate(['/home']);
        },
        error: (err) => {
          this.loginError = true;
          
          // 👇 Extraemos el mensaje exacto que envía n8n (401)
          if (err.error && err.error.message) {
            this.errorMessage = err.error.message;
          } else if (err.message) {
            this.errorMessage = err.message;
          } else {
            this.errorMessage = 'Credenciales incorrectas.';
          }
          
          this.cdr.detectChanges(); // Forzamos la actualización
        },
      });
  }
}