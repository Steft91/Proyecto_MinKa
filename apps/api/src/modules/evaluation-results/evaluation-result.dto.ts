import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsDefined,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsObject,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import type {
  IndicadoresEvaluacion,
  ResultadoEvaluacion,
} from '@minka/contracts';

export class EvaluationIndicatorsDto implements IndicadoresEvaluacion {
  @IsBoolean() finalidad_no_comunitaria!: boolean;
  @IsBoolean() incoherencia!: boolean;
  @IsBoolean() cobro_obligatorio!: boolean;
  @IsBoolean() solicitud_datos_sensibles!: boolean;
  @IsBoolean() fraude!: boolean;
  @IsBoolean() violencia_discriminacion!: boolean;
  @IsBoolean() riesgo_fisico!: boolean;
  @IsBoolean() manipulacion_instrucciones!: boolean;
  @IsBoolean() ambiguedad!: boolean;
}

export class EvaluationResultDto implements ResultadoEvaluacion {
  @IsUUID() id_propuesta!: string;
  @IsInt() @Min(1) version_propuesta!: number;
  @IsIn(['favorable', 'requiere_revision', 'error'])
  resultado!: ResultadoEvaluacion['resultado'];
  @IsDefined()
  @IsObject()
  @ValidateNested()
  @Type(() => EvaluationIndicatorsDto)
  indicadores_json!: EvaluationIndicatorsDto;
  @IsOptional() @IsString() razones!: string | null;
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  @MaxLength(50)
  version_politica!: string;
  @IsBoolean() respuesta_valida!: boolean;
}
