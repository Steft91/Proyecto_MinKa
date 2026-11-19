import { Component, inject } from '@angular/core';
import { FormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, forkJoin, map, of, startWith, Subject, switchMap } from 'rxjs';
import type { ActividadPublica, CategoriaPublica, FiltrosCatalogo } from '@minka/contracts';
import { CatalogApiService } from './catalog-api.service';
import { CategoryFilterComponent } from './category-filter.component';
import { ActivityCardComponent } from './activity-card.component';

interface CatalogState {
  loading: boolean;
  categories: CategoriaPublica[];
  activities: ActividadPublica[];
  filters: FiltrosCatalogo;
  error: string;
}

@Component({
  selector: 'app-activity-catalog',
  imports: [ReactiveFormsModule, CategoryFilterComponent, ActivityCardComponent],
  templateUrl: './activity-catalog.component.html',
})
export class ActivityCatalogComponent {
  private readonly api = inject(CatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly refresh = new Subject<void>();
  readonly form = inject(FormBuilder).nonNullable.group({
    category: '',
    dateFrom: '',
    dateTo: '',
    location: '',
  });
  readonly state = toSignal(
    combineLatest([this.route.queryParamMap, this.refresh.pipe(startWith(undefined))]).pipe(
      switchMap(([params]) => {
        const filters = {
          category: params.get('category') ?? '',
          dateFrom: params.get('dateFrom') ?? '',
          dateTo: params.get('dateTo') ?? '',
          location: params.get('location') ?? '',
        };
        this.form.reset(filters);
        const initial: CatalogState = {
          loading: true,
          categories: [],
          activities: [],
          filters,
          error: '',
        };
        return forkJoin({
          categories: this.api.getCategories(),
          activities: this.api.getActivities(filters),
        }).pipe(
          map((result) => ({ ...initial, ...result, loading: false })),
          catchError((error: HttpErrorResponse) =>
            of({
              ...initial,
              loading: false,
              error:
                error.status === 400
                  ? 'Revisa la categoría y el rango de fechas de tu búsqueda.'
                  : 'No pudimos cargar las actividades. Inténtalo de nuevo.',
            }),
          ),
          startWith(initial),
        );
      }),
    ),
  );

  invalidRange(): boolean {
    const { dateFrom, dateTo } = this.form.getRawValue();
    return Boolean(dateFrom && dateTo && dateFrom > dateTo);
  }

  search(): void {
    if (this.invalidRange()) return;
    const filters = this.form.getRawValue();
    void this.router
      .navigate([], {
        relativeTo: this.route,
        queryParams: {
          category: filters.category || null,
          dateFrom: filters.dateFrom || null,
          dateTo: filters.dateTo || null,
          location: filters.location.trim() || null,
        },
      })
      .then((changed) => {
        if (!changed) this.retry();
      });
  }

  clear(): void {
    void this.router.navigate(['/actividades']);
  }
  retry(): void {
    this.refresh.next();
  }

  categoryName(code: string): string {
    return (
      this.state()?.categories.find((category) => category.codigo === code)?.nombre ??
      code.replaceAll('_', ' ')
    );
  }
}
