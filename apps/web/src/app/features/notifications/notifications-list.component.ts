import { CommonModule, DatePipe } from '@angular/common';
import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { NotificationsService } from './notifications.service';

@Component({
  selector: 'app-notifications-list',
  standalone: true,
  imports: [CommonModule, DatePipe],
  template: `
    <main class="notifications-page">
      <header>
        <h1>Notificaciones</h1>
        <span>{{ unreadCount() }} sin leer</span>
      </header>
      <button type="button" (click)="reload()" [disabled]="loading">Actualizar</button>
      <p *ngIf="loading">Cargando notificaciones…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="!loading && !error && !items().length">No tienes notificaciones.</p>
      <article *ngFor="let item of items()" [class.unread]="!item.leida">
        <h2>{{ item.titulo }}</h2>
        <p>{{ item.mensaje }}</p>
        <small>{{ item.creadaEn | date: 'medium' }}</small>
        <button *ngIf="!item.leida" type="button" (click)="read(item.id)">
          Marcar como leída
        </button>
      </article>
    </main>
  `,
})
export class NotificationsListComponent {
  private readonly service = inject(NotificationsService);
  private readonly destroy = inject(DestroyRef);
  readonly items = this.service.notifications;
  loading = false;
  error = '';

  unreadCount(): number {
    return this.items().filter((item) => !item.leida).length;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = '';
    this.service.loadMine().pipe(
      takeUntilDestroyed(this.destroy),
      finalize(() => (this.loading = false)),
    ).subscribe({
      error: () => (this.error = 'No se pudieron cargar las notificaciones.'),
    });
  }

  read(id: string): void {
    this.error = '';
    this.service.markRead(id).pipe(takeUntilDestroyed(this.destroy)).subscribe({
      error: () => (this.error = 'No se pudo marcar el aviso como leído.'),
    });
  }
}
