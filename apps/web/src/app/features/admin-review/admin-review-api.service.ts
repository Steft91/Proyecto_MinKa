import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { DecisionPropuesta, PropuestaRevision, RevisionResuelta } from '@minka/contracts';

@Injectable({ providedIn: 'root' })
export class AdminReviewApiService {
  private readonly http = inject(HttpClient);
  pending() {
    return this.http.get<PropuestaRevision[]>('/api/v1/admin/proposals/review');
  }
  detail(id: string) {
    return this.http.get<PropuestaRevision>(`/api/v1/admin/proposals/${encodeURIComponent(id)}`);
  }
  decide(id: string, input: DecisionPropuesta) {
    return this.http.post<RevisionResuelta>(
      `/api/v1/admin/proposals/${encodeURIComponent(id)}/decision`,
      input,
    );
  }
}
