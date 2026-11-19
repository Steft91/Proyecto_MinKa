import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'actividades' },
  { path: 'actividades', loadComponent: () => import('./features/catalog/activity-catalog.component').then(m => m.ActivityCatalogComponent) },
  { path: 'actividades/:id', loadComponent: () => import('./features/catalog/activity-detail.component').then(m => m.ActivityDetailComponent) },
  { path: '**', redirectTo: 'actividades' },
];
