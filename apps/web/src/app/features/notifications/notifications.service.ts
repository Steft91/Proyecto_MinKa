import { HttpClient } from '@angular/common/http';
import { Injectable, signal } from '@angular/core';
import { tap } from 'rxjs';

export interface MinkaNotification {
  id: string;
  eventKey: string;
  leida: boolean;
  creadaEn: string;
  titulo: string;
  mensaje: string;
  tipo_evento?: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationsService {
  readonly notifications = signal<MinkaNotification[]>([]);

  constructor(private readonly http: HttpClient) {}

  loadMine() {
    this.notifications.set([]);
    return this.http
      .get<MinkaNotification[]>('/api/v1/notifications')
      .pipe(tap((items) => this.notifications.set(items)));
  }

  markRead(id: string) {
    return this.http.patch<{ id: string; leida: true }>(
      `/api/v1/notifications/${id}/read`,
      { leida: true },
    ).pipe(
      tap(() =>
        this.notifications.update((items) =>
          items.map((item) => (item.id === id ? { ...item, leida: true } : item)),
        ),
      ),
    );
  }
}
