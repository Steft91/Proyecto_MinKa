import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of, startWith, Subject, switchMap } from 'rxjs';
import { ProposalsApiService } from './proposals-api.service';
import type { PropuestaPropia, EstadoPropuesta } from '@minka/contracts';

export const ESTADOS_PROPUESTA: Record<EstadoPropuesta, string> = {
  pendiente_evaluacion: 'Pendiente de evaluación',
  en_revision: 'En revisión administrativa',
  aprobada: 'Aprobada',
  rechazada: 'Rechazada',
  retirada: 'Retirada',
};
interface State {
  loading: boolean;
  proposals: PropuestaPropia[];
  error: string;
}

@Component({
  selector: 'app-my-proposals',
  imports: [DatePipe, RouterLink],
  templateUrl: './my-proposals.component.html',
})
export class MyProposalsComponent {
  private readonly api = inject(ProposalsApiService);
  private readonly refresh = new Subject<void>();
  readonly labels = ESTADOS_PROPUESTA;
  readonly state = toSignal(
    this.refresh.pipe(
      startWith(undefined),
      switchMap(() => {
        const initial: State = { loading: true, proposals: [], error: '' };
        return this.api.mine().pipe(
          map((proposals) => ({ ...initial, loading: false, proposals })),
          catchError((error: HttpErrorResponse) =>
            of({
              ...initial,
              loading: false,
              error:
                error.status === 401
                  ? 'Necesitas iniciar sesión para consultar tus propuestas.'
                  : 'No pudimos cargar tus propuestas. Inténtalo de nuevo.',
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
