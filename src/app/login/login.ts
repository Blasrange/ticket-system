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

import { ForgotPasswordComponent } from './forgot-password/forgot-password';

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
    ForgotPasswordComponent 
  ],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private authService = inject(AuthService);
  private cdr = inject(ChangeDetectorRef);

  isLoading = false;
  loginError = false;
  errorMessage = '';
  
  forgotPasswordVisible = false; // 👈 Controla el modal

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

    this.authService.logout();

    const credentials = {
      email: this.loginForm.value.email!,
      password: this.loginForm.value.password!,
    };

    this.authService
      .login(credentials)
      .pipe(
        finalize(() => {
          this.isLoading = false;
          this.cdr.detectChanges();
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
          this.errorMessage = err.error?.message || err.message || 'Credenciales incorrectas.';
          this.cdr.detectChanges();
        },
      });
  }
}