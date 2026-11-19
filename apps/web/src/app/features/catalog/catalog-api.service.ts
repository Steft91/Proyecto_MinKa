import { inject, Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import type { ActividadPublica, CategoriaPublica, FiltrosCatalogo } from '@minka/contracts';

@Injectable({ providedIn: 'root' })
export class CatalogApiService {
  private readonly http = inject(HttpClient);

  getCategories() {
    return this.http.get<CategoriaPublica[]>('/api/v1/categories');
  }

  getActivities(filters: FiltrosCatalogo) {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value) params = params.set(key, value);
    }
    return this.http.get<ActividadPublica[]>('/api/v1/activities', { params });
  }

  getActivity(id: string) {
    return this.http.get<ActividadPublica>(`/api/v1/activities/${encodeURIComponent(id)}`);
  }
}
