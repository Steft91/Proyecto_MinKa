import { Component, inject, signal } from '@angular/core';
import { AbstractControl, FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { forkJoin } from 'rxjs';
import type { CategoriaPublica, CrearPropuesta, PropuestaPropia } from '@minka/contracts';
import { CatalogApiService } from '../catalog/catalog-api.service';
import { ProposalsApiService } from './proposals-api.service';

const coordinatePrecision = (control: AbstractControl) => {
  const value: unknown = control.value;
  return value === null ||
    (typeof value === 'number' && Number.isFinite(value) && Number(value.toFixed(7)) === value)
    ? null
    : { precision: true };
};

@Component({
  selector: 'app-proposal-form',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './proposal-form.component.html',
})
export class ProposalFormComponent {
  private readonly api = inject(ProposalsApiService);
  private readonly catalog = inject(CatalogApiService);
  private readonly fb = inject(FormBuilder);
  private readonly creationKey = crypto.randomUUID();
  readonly categories = signal<CategoriaPublica[]>([]);
  readonly loading = signal(true);
  readonly allowed = signal(false);
  readonly eligibilityMessage = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly created = signal<PropuestaPropia | null>(null);
  readonly form = this.fb.group({
    titulo: ['', [Validators.required, Validators.maxLength(180), Validators.pattern(/\S/)]],
    categoria_codigo: ['', Validators.required],
    descripcion: ['', [Validators.required, Validators.pattern(/\S/)]],
    finalidad_comunitaria: ['', [Validators.required, Validators.pattern(/\S/)]],
    direccion_lugar: [
      '',
      [Validators.required, Validators.maxLength(255), Validators.pattern(/\S/)],
    ],
    latitud_lugar: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(-90),
      Validators.max(90),
      coordinatePrecision,
    ]),
    longitud_lugar: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(-180),
      Validators.max(180),
      coordinatePrecision,
    ]),
    inicio_previsto: ['', Validators.required],
    fin_previsto: ['', Validators.required],
    cupo_maximo: this.fb.control<number | null>(null, [
      Validators.required,
      Validators.min(1),
      Validators.max(2147483647),
      Validators.pattern(/^\d+$/),
    ]),
  });

  constructor() {
    forkJoin({ categories: this.catalog.getCategories(), eligibility: this.api.eligibility() })
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ({ categories, eligibility }) => {
          this.categories.set(categories);
          this.allowed.set(eligibility.puede_proponer);
          this.eligibilityMessage.set(eligibility.motivo ?? '');
          this.loading.set(false);
        },
        error: (error: HttpErrorResponse) => {
          this.loading.set(false);
          this.eligibilityMessage.set(
            error.status === 401
              ? 'Necesitas iniciar sesión y completar tu perfil para presentar una propuesta.'
              : 'No pudimos comprobar si puedes proponer. Vuelve a abrir el formulario para reintentar.',
          );
        },
      });
  }

  fieldError(name: keyof typeof this.form.controls): boolean {
    const field = this.form.controls[name];
    return field.touched && field.invalid;
  }

  dateError(): string {
    const { inicio_previsto: inicio, fin_previsto: fin } = this.form.getRawValue();
    if (inicio && Date.parse(`${inicio}-05:00`) <= Date.now())
      return 'El inicio debe estar en el futuro.';
    if (inicio && fin && Date.parse(`${fin}-05:00`) <= Date.parse(`${inicio}-05:00`))
      return 'La finalización debe ser posterior al inicio.';
    return '';
  }

  submit(): void {
    this.form.markAllAsTouched();
    if (this.form.invalid || this.dateError() || !this.allowed() || this.saving()) return;
    const values = this.form.getRawValue();
    const body: CrearPropuesta = {
      titulo: values.titulo!.trim(),
      categoria_codigo: values.categoria_codigo as CrearPropuesta['categoria_codigo'],
      descripcion: values.descripcion!.trim(),
      finalidad_comunitaria: values.finalidad_comunitaria!.trim(),
      direccion_lugar: values.direccion_lugar!.trim(),
      latitud_lugar: values.latitud_lugar!,
      longitud_lugar: values.longitud_lugar!,
      cupo_maximo: values.cupo_maximo!,
      inicio_previsto: new Date(`${values.inicio_previsto}-05:00`).toISOString(),
      fin_previsto: new Date(`${values.fin_previsto}-05:00`).toISOString(),
    };
    this.saving.set(true);
    this.error.set('');
    this.api.create(body, this.creationKey).subscribe({
      next: (proposal) => {
        this.saving.set(false);
        this.created.set(proposal);
      },
      error: (error: HttpErrorResponse) => {
        this.saving.set(false);
        this.error.set(
          error.error?.mensaje ?? 'No pudimos registrar la propuesta. Puedes reintentar el envío.',
        );
      },
    });
  }
}
