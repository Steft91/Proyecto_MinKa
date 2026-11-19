import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { Subject, startWith, switchMap, map, catchError, of } from 'rxjs';
import type { PropuestaRevision } from '@minka/contracts';
import { AdminReviewApiService } from './admin-review-api.service';

@Component({
  selector: 'app-admin-review-queue',
  imports: [DatePipe, RouterLink],
  template: `<section class="proposal-page">
    <header class="proposal-heading">
      <p class="eyebrow">Administración</p>
      <h1>Propuestas por revisar</h1>
    </header>
    @if (state(); as result) {
      @if (result.loading) {
        <p role="status">Cargando propuestas…</p>
      } @else if (result.error) {
        <div class="state-panel" role="alert">
          <p>{{ result.error }}</p>
          <button class="button-primary" (click)="retry()">Reintentar</button>
        </div>
      } @else if (!result.rows.length) {
        <div class="state-panel">
          <h2>No hay propuestas pendientes de revisión</h2>
          <p>Los casos derivados aparecerán aquí.</p>
        </div>
      } @else {
        <p>{{ result.rows.length }} propuestas pendientes</p>
        <div class="proposal-list">
          @for (row of result.rows; track row.id_propuesta) {
            <article class="proposal-list-item">
              <div>
                <span class="category-tag">En revisión · Versión {{ row.version_actual }}</span>
                <h2>{{ row.titulo }}</h2>
                <p>{{ row.creada_en | date: 'd MMM y, HH:mm' : '-0500' }}</p>
              </div>
              <a
                [routerLink]="['/administracion/propuestas', row.id_propuesta]"
                [attr.aria-label]="'Revisar ' + row.titulo"
                >Revisar →</a
              >
            </article>
          }
        </div>
      }
    }
  </section>`,
})
export class AdminReviewQueueComponent {
  private readonly api = inject(AdminReviewApiService);
  private readonly refresh = new Subject<void>();
  readonly state = toSignal(
    this.refresh.pipe(
      startWith(undefined),
      switchMap(() => {
        const initial: { loading: boolean; rows: PropuestaRevision[]; error: string } = {
          loading: true,
          rows: [],
          error: '',
        };
        return this.api.pending().pipe(
          map((rows) => ({ ...initial, rows, loading: false })),
          catchError((error: HttpErrorResponse) =>
            of({
              ...initial,
              loading: false,
              error:
                error.status === 401 || error.status === 403
                  ? 'Esta sección requiere una cuenta administradora habilitada.'
                  : 'No pudimos cargar las propuestas pendientes.',
            }),
          ),
          startWith(initial),
        );
      }),
    ),
  );
  retry(): void {
    this.refresh.next();
  }
}
