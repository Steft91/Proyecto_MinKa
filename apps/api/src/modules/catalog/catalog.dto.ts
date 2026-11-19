import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import type {
  CategoriaCodigo,
  ContenidoActividadPublicada,
  FiltrosCatalogo,
} from '@minka/contracts';
import { CODIGOS_CATEGORIA } from './categories.js';

export class CatalogFiltersDto implements FiltrosCatalogo {
  @IsOptional()
  @IsIn(CODIGOS_CATEGORIA)
  category?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateFrom?: string;

  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  dateTo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  location?: string;
}

export class PublishedContentDto implements ContenidoActividadPublicada {
  @IsIn(CODIGOS_CATEGORIA)
  categoria_codigo!: CategoriaCodigo;

  @IsString()
  @MinLength(1)
  @MaxLength(180)
  titulo!: string;

  @IsString()
  @MinLength(1)
  descripcion!: string;

  @IsString()
  @MinLength(1)
  finalidad_comunitaria!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(255)
  direccion_lugar!: string;

  @IsNumber()
  @Min(-90)
  @Max(90)
  latitud_lugar!: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitud_lugar!: number;

  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  inicio_previsto!: string;

  @IsDateString({ strict: true })
  @Matches(/T.*(?:Z|[+-]\d{2}:\d{2})$/)
  fin_previsto!: string;

  @IsInt()
  @Min(1)
  cupo_maximo!: number;
}
