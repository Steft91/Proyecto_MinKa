import { Transform } from 'class-transformer';
import { IsIn, IsInt, IsNotEmpty, IsString, Min } from 'class-validator';
import type { DecisionPropuesta } from '@minka/contracts';

export class AdminDecisionDto implements DecisionPropuesta {
  @IsIn(['aprobar', 'rechazar'])
  decision!: 'aprobar' | 'rechazar';

  @IsString()
  @IsNotEmpty()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  motivo!: string;

  @IsInt()
  @Min(1)
  version_propuesta!: number;
}
