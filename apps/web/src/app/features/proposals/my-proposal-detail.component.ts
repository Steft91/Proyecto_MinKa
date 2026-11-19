import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import type { PropuestaPropia } from '@minka/contracts';
import { ProposalsApiService } from './proposals-api.service';
import { ESTADOS_PROPUESTA } from './my-proposals.component';

@Component({
  selector: 'app-my-proposal-detail',
  imports: [DatePipe, RouterLink],
  template: `
    <section class="proposal-page">
      <a class="back-link" routerLink="/mis-propuestas">← Mis propuestas</a>
      @if (state(); as result) {
        @if (result.loading) {
          <p role="status">Cargando propuesta…</p>
        } @else if (result.error) {
          <div class="state-panel" role="alert">
            <p>{{ result.error }}</p>
            <a routerLink="/mis-propuestas">Volver a mis propuestas</a>
          </div>
        } @else if (result.proposal; as proposal) {
          <header class="detail-heading">
            <span class="category-tag">{{ labels[proposal.estado] }}</span>
            <h1>{{ proposal.titulo }}</h1>
            <p>Versión {{ proposal.version_actual }}</p>
          </header>
          <div class="detail-layout">
            <div class="detail-description">
              <h2>Descripción</h2>
              <p>{{ proposal.descripcion }}</p>
              <h2>Finalidad comunitaria</h2>
              <p>{{ proposal.finalidad_comunitaria }}</p>
            </div>
            <aside class="detail-facts">
              <h2>Lugar y horario propuestos</h2>
              <dl>
                <div>
                  <dt>Dirección</dt>
                  <dd>{{ proposal.direccion_lugar }}</dd>
                </div>
                <div>
                  <dt>Inicio</dt>
                  <dd>{{ proposal.inicio_previsto | date: 'd MMM y, HH:mm' : '-0500' }}</dd>
                </div>
                <div>
                  <dt>Finalización</dt>
                  <dd>{{ proposal.fin_previsto | date: 'd MMM y, HH:mm' : '-0500' }}</dd>
                </div>
                <div>
                  <dt>Cupo máximo</dt>
                  <dd>{{ proposal.cupo_maximo }}</dd>
                </div>
              </dl>
              <p class="timezone-note">Horarios de Ecuador continental (UTC−5).</p>
            </aside>
          </div>
        }
      }
    </section>
  `,
})
export class MyProposalDetailComponent {
  private readonly api = inject(ProposalsApiService);
  readonly labels = ESTADOS_PROPUESTA;
  readonly state = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      switchMap((params) => {
        const initial: { loading: boolean; proposal: PropuestaPropia | null; error: string } = {
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
                error.status === 401
                  ? 'Necesitas iniciar sesión para consultar esta propuesta.'
                  : error.status === 403 || error.status === 404
                    ? 'No puedes consultar esta propuesta.'
                    : 'No pudimos cargar la propuesta.',
            }),
          ),
          startWith(initial),
        );
      }),
    ),
  );
}
