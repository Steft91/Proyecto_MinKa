import { Component, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, combineLatest, startWith, switchMap, map, catchError, of } from 'rxjs';
import type { PropuestaRevision, RevisionResuelta } from '@minka/contracts';
import { AdminReviewApiService } from './admin-review-api.service';

const INDICADORES: Record<string, string> = {
  finalidad_no_comunitaria: 'Finalidad ajena al beneficio comunitario',
  incoherencia: 'Información contradictoria',
  cobro_obligatorio: 'Cobro obligatorio',
  solicitud_datos_sensibles: 'Solicitud de datos sensibles',
  fraude: 'Posible fraude',
  violencia_discriminacion: 'Violencia o discriminación',
  riesgo_fisico: 'Riesgo físico',
  manipulacion_instrucciones: 'Intento de manipular la evaluación',
  ambiguedad: 'Información ambigua',
};

@Component({
  selector: 'app-review-detail',
  imports: [RouterLink, DatePipe, ReactiveFormsModule],
  templateUrl: './review-detail.component.html',
})
export class ReviewDetailComponent {
  private readonly api = inject(AdminReviewApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new Subject<void>();
  readonly form = inject(FormBuilder).nonNullable.group({
    decision: ['', Validators.required],
    motivo: ['', [Validators.required, Validators.pattern(/\S/)]],
  });
  readonly saving = signal(false);
  readonly error = signal('');
  readonly decision = signal<RevisionResuelta | null>(null);
  readonly state = toSignal(
    combineLatest([this.route.paramMap, this.refresh.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        const initial: { loading: boolean; proposal: PropuestaRevision | null; error: string } = {
          loading: true,
          proposal: null,
          error: '',
        };
        return this.api.detail(params.get('id') ?? '').pipe(
          map((proposal) => ({ ...initial, loading: false, proposal })),
          catchError((error: HttpErrorResponse) =>
            of({
              ...initial,
              loading: false,
              error:
                error.status === 401 || error.status === 403
                  ? 'Esta sección requiere una cuenta administradora habilitada.'
                  : 'No pudimos cargar la propuesta.',
            }),
          ),
          startWith(initial),
        );
      }),
    ),
  );

  alerts(value: unknown): string[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return [];
    return Object.entries(value)
      .filter(([, enabled]) => enabled === true)
      .map(([key]) => INDICADORES[key] ?? key);
  }
  retry(): void {
    this.error.set('');
    this.refresh.next();
  }
  submit(): void {
    this.form.markAllAsTouched();
    const proposal = this.state()?.proposal;
    if (!proposal || proposal.estado !== 'en_revision' || this.form.invalid || this.saving())
      return;
    const input = this.form.getRawValue();
    this.saving.set(true);
    this.error.set('');
    this.api
      .decide(proposal.id_propuesta, {
        decision: input.decision as 'aprobar' | 'rechazar',
        motivo: input.motivo.trim(),
        version_propuesta: proposal.version_actual,
      })
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.decision.set(result);
        },
        error: (error: HttpErrorResponse) => {
          this.saving.set(false);
          this.error.set(
            error.error?.mensaje ?? 'No pudimos registrar la decisión. Puedes reintentar.',
          );
        },
      });
  }
}
