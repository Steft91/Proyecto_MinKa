import { Component, inject } from '@angular/core';
import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';
import type { ActividadPublica } from '@minka/contracts';
import { CatalogApiService } from './catalog-api.service';

interface DetailState {
  loading: boolean;
  activity: ActividadPublica | null;
  category: string;
  error: string;
}

@Component({
  selector: 'app-activity-detail',
  imports: [DatePipe, RouterLink],
  templateUrl: './activity-detail.component.html',
})
export class ActivityDetailComponent {
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly refresh = new Subject<void>();
  readonly backFilters = this.route.snapshot.queryParams;
  readonly state = toSignal(
    combineLatest([this.route.paramMap, this.refresh.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        const initial: DetailState = { loading: true, activity: null, category: '', error: '' };
        return forkJoin({
          activity: this.api.getActivity(params.get('id') ?? ''),
          categories: this.api.getCategories(),
        }).pipe(
          map(({ activity, categories }) => ({
            ...initial,
            loading: false,
            activity,
            category:
              categories.find((category) => category.codigo === activity.categoria_codigo)
                ?.nombre ?? activity.categoria_codigo.replaceAll('_', ' '),
          })),
          catchError((error: HttpErrorResponse) =>
            of({
              ...initial,
              loading: false,
              error:
                error.status === 404 || error.status === 400
                  ? 'Esta actividad no está disponible en el catálogo.'
                  : 'No pudimos cargar la actividad. Inténtalo de nuevo.',
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
