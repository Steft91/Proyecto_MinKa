import { Component, input } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import type { CategoriaPublica } from '@minka/contracts';

@Component({
  selector: 'app-category-filter',
  imports: [ReactiveFormsModule],
  template: `
    <label for="category">Categoría</label>
    <select id="category" [formControl]="control()">
      <option value="">Todas las categorías</option>
      @for (category of categories(); track category.codigo) {
        <option [value]="category.codigo">{{ category.nombre }}</option>
      }
    </select>
  `,
})
export class CategoryFilterComponent {
  readonly control = input.required<FormControl<string>>();
  readonly categories = input.required<CategoriaPublica[]>();
}
