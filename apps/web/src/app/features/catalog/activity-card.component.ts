import { Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { RouterLink } from '@angular/router';
import type { ActividadPublica, FiltrosCatalogo } from '@minka/contracts';

@Component({
  selector: 'app-activity-card',
  imports: [DatePipe, RouterLink],
  template: `
    <article class="activity-card">
      <span class="category-tag">{{ categoryName() }}</span>
      <h2>
        <a [routerLink]="['/actividades', activity().id_actividad]" [queryParams]="filters()">{{
          activity().titulo
        }}</a>
      </h2>
      <p class="card-description">{{ activity().descripcion }}</p>
      <dl class="card-facts">
        <div>
          <dt>Fecha y hora</dt>
          <dd>{{ activity().inicio_previsto | date: 'EEE d MMM, HH:mm' : '-0500' }}</dd>
        </div>
        <div>
          <dt>Lugar</dt>
          <dd>{{ activity().direccion_lugar }}</dd>
        </div>
      </dl>
      <div class="card-bottom">
        <span class="availability" [class.full]="activity().cupos_disponibles === 0">
          @if (activity().cupos_disponibles === 0) {
            Cupos agotados
          } @else {
            {{ activity().cupos_disponibles }} de {{ activity().cupo_maximo }} cupos libres
          }
        </span>
        <a
          class="detail-link"
          [routerLink]="['/actividades', activity().id_actividad]"
          [queryParams]="filters()"
          [attr.aria-label]="'Ver detalles de ' + activity().titulo"
          >Ver detalles <span aria-hidden="true">↗</span></a
        >
      </div>
    </article>
  `,
})
export class ActivityCardComponent {
  readonly activity = input.required<ActividadPublica>();
  readonly categoryName = input.required<string>();
  readonly filters = input<FiltrosCatalogo>({});
}
