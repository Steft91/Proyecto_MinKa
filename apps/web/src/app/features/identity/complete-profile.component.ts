import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import type { SesionActual } from '@minka/contracts';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-complete-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  template: `
    <main class="profile-page">
      <h1>Completa tu perfil</h1>
      <p>Necesitamos estos datos para validar tu participación en Minka.</p>
      <form [formGroup]="form" (ngSubmit)="submit()">
        <label>Nombres <input formControlName="nombres" /></label>
        <label>Apellidos <input formControlName="apellidos" /></label>
        <label>Fecha de nacimiento <input type="date" formControlName="fecha_nacimiento" /></label>
        <label>Sector de residencia <input formControlName="sector_residencia" /></label>
        <button type="submit" [disabled]="form.invalid || saving">Guardar perfil</button>
      </form>
      <p *ngIf="message" role="status">{{ message }}</p>
    </main>
  `,
})
export class CompleteProfileComponent {
  private readonly http = inject(HttpClient);
  private readonly fb = inject(FormBuilder);
  readonly form = this.fb.nonNullable.group({
    nombres: ['', [Validators.required, Validators.maxLength(120)]],
    apellidos: ['', [Validators.required, Validators.maxLength(120)]],
    fecha_nacimiento: ['', Validators.required],
    sector_residencia: ['', [Validators.required, Validators.maxLength(120)]],
  });
  saving = false;
  message = '';

  submit(): void {
    if (this.form.invalid) return;
    this.saving = true;
    this.http
      .patch<SesionActual>('/api/v1/profile/me', this.form.getRawValue())
      .pipe(finalize(() => (this.saving = false)))
      .subscribe({
        next: () => (this.message = 'Perfil guardado correctamente.'),
        error: () => (this.message = 'No se pudo guardar el perfil.'),
      });
  }
}
