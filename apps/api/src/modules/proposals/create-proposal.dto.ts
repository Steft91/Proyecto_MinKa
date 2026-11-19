import { Transform } from 'class-transformer';
import {
  IsString,
  IsNotEmpty,
  MaxLength,
  Max,
  Min,
  IsNumber,
  IsInt,
  ValidateBy,
} from 'class-validator';
import { PublishedContentDto } from '../catalog/catalog.dto.js';

const coordinatePrecision = {
  name: 'coordinatePrecision',
  validator: {
    validate: (value: unknown) =>
      typeof value === 'number' &&
      Number.isFinite(value) &&
      Number(value.toFixed(7)) === value,
    defaultMessage: () =>
      'Las coordenadas deben tener como máximo siete decimales.',
  },
};

/** Reutiliza las restricciones de los campos publicados del mismo contrato. */
export class CreateProposalDto extends PublishedContentDto {
  @IsNumber()
  @ValidateBy(coordinatePrecision)
  @Min(-90)
  @Max(90)
  declare latitud_lugar: number;

  @IsNumber()
  @ValidateBy(coordinatePrecision)
  @Min(-180)
  @Max(180)
  declare longitud_lugar: number;
  @Max(2147483647)
  @IsInt()
  @Min(1)
  declare cupo_maximo: number;
  @IsString()
  @IsNotEmpty()
  @MaxLength(180)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  declare titulo: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  declare descripcion: string;

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  declare finalidad_comunitaria: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  declare direccion_lugar: string;
}
