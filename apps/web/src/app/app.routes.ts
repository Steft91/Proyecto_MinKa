import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'actividades' },
  {
    path: 'actividades',
    loadComponent: () =>
      import('./features/catalog/activity-catalog.component').then(
        (m) => m.ActivityCatalogComponent,
      ),
  },
  {
    path: 'actividades/:id',
    loadComponent: () =>
      import('./features/catalog/activity-detail.component').then((m) => m.ActivityDetailComponent),
  },
  {
    path: 'propuestas/nueva',
    loadComponent: () =>
      import('./features/proposals/proposal-form.component').then((m) => m.ProposalFormComponent),
  },
  {
    path: 'mis-propuestas',
    loadComponent: () =>
      import('./features/proposals/my-proposals.component').then((m) => m.MyProposalsComponent),
  },
  {
    path: 'mis-propuestas/:id',
    loadComponent: () =>
      import('./features/proposals/my-proposal-detail.component').then(
        (m) => m.MyProposalDetailComponent,
      ),
  },
  {
    path: 'administracion/propuestas',
    loadComponent: () =>
      import('./features/admin-review/admin-review-queue.component').then(
        (m) => m.AdminReviewQueueComponent,
      ),
  },
  {
    path: 'administracion/propuestas/:id',
    loadComponent: () =>
      import('./features/admin-review/review-detail.component').then(
        (m) => m.ReviewDetailComponent,
      ),
  },
  { path: '**', redirectTo: 'actividades' },
];
