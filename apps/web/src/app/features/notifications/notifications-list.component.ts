import { CommonModule, DatePipe } from '@angular/common';
import { Component, inject } from '@angular/core';
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
      <button type="button" (click)="reload()">Actualizar</button>
      <p *ngIf="loading">Cargando notificaciones…</p>
      <p *ngIf="error" role="alert">No se pudieron cargar las notificaciones.</p>
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
  readonly items = this.service.notifications;
  loading = false;
  error = false;

  unreadCount(): number {
    return this.items().filter((item) => !item.leida).length;
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading = true;
    this.error = false;
    this.service.loadMine().subscribe({
      error: () => {
        this.error = true;
        this.loading = false;
      },
      complete: () => (this.loading = false),
    });
  }

  read(id: string): void {
    this.service.markRead(id).subscribe();
  }
}
