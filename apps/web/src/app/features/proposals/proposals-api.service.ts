import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import type { CrearPropuesta, ElegibilidadPropuesta, PropuestaPropia } from '@minka/contracts';

@Injectable({ providedIn: 'root' })
export class ProposalsApiService {
  private readonly http = inject(HttpClient);
  eligibility() {
    return this.http.get<ElegibilidadPropuesta>('/api/v1/proposals/eligibility');
  }
  mine() {
    return this.http.get<PropuestaPropia[]>('/api/v1/proposals/me');
  }
  detail(id: string) {
    return this.http.get<PropuestaPropia>(`/api/v1/proposals/${encodeURIComponent(id)}`);
  }
  create(body: CrearPropuesta, key: string) {
    return this.http.post<PropuestaPropia>('/api/v1/proposals', body, {
      headers: { 'Idempotency-Key': key },
    });
  }
}
