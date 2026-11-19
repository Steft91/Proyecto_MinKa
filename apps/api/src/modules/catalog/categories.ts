import type { CategoriaCodigo } from '@minka/contracts';

export const CATEGORIAS_AUTORIZADAS: {
  codigo: CategoriaCodigo;
  nombre: string;
}[] = [
  { codigo: 'limpieza', nombre: 'Limpieza comunitaria' },
  {
    codigo: 'recuperacion_espacios',
    nombre: 'Recuperación de espacios públicos',
  },
  { codigo: 'reciclaje', nombre: 'Reciclaje' },
  { codigo: 'convivencia', nombre: 'Convivencia barrial' },
];
export const CODIGOS_CATEGORIA = CATEGORIAS_AUTORIZADAS.map(
  ({ codigo }) => codigo,
);
