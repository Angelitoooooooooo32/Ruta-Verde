import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { Router, RouterLink } from '@angular/router';
import { animate, style, transition, trigger } from '@angular/animations';
import { AuthService } from '../../core/services/auth.service';
import { MatSelectModule } from '@angular/material/select';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatCheckboxModule,
    MatProgressSpinnerModule,
    MatSnackBarModule,
    RouterLink,
    MatSelectModule
  ],
  templateUrl: './register.component.html',
  styleUrls: ['./register.component.scss'],
  animations: [
    trigger('fadeSlideInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(20px)' }),
        animate('0.3s ease-out', style({ opacity: 1, transform: 'translateY(0)' }))
      ])
    ])
  ],
  host: {
    class: 'app-register'
  }
})
export class RegisterComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);
  private fb = inject(FormBuilder);

  showPassword = signal(false);
  loading = signal(false);
  error = signal<string | null>(null);

  roleOptions = ['cliente', 'conductor'];

  passwordStrength = computed(() => {
    const v = this.registerForm.controls.password.value || '';
    let score = 0;
    if (v.length >= 6) score += 25;
    if (/[A-Z]/.test(v)) score += 25;
    if (/[0-9]/.test(v)) score += 25;
    if (/[^A-Za-z0-9]/.test(v)) score += 25;
    return score;
  });

  registerForm = this.fb.nonNullable.group({
    name: ['', [Validators.required, Validators.minLength(3)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    role: ['cliente', [Validators.required]],
    terms: [false, [Validators.requiredTrue]]
  });

  togglePassword() {
    this.showPassword.update(show => !show);
  }

  async onSubmit() {
    if (this.loading()) return;
    if (this.registerForm.invalid) return;

    const { name, email, password, role } = this.registerForm.getRawValue();

    this.loading.set(true);
    this.error.set(null);

    try {
      const res = await this.authService.register({
        name,
        email,
        password,
        role
      });

      if (!res.success) {
        throw new Error(res.error);
      }

      this.snackBar.open(res.message || '¡Cuenta creada exitosamente! Redirigiendo al login...', 'Cerrar', {
        duration: 4000,
        horizontalPosition: 'center',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      });

      // Redirigir al login después de 2 segundos
      setTimeout(() => {
        this.router.navigate(['/auth/login']);
      }, 2000);

    } catch (error: any) {
      this.error.set(error?.message || 'No se pudo registrar. Por favor, intenta de nuevo.');
      this.snackBar.open(
        error?.message || 'Error al registrar',
        'Cerrar',
        {
          duration: 5000,
          horizontalPosition: 'center',
          verticalPosition: 'top',
          panelClass: ['error-snackbar']
        }
      );
    } finally {
      this.loading.set(false);
    }
  }
}
