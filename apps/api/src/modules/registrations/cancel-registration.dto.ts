import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class CancelRegistrationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  motivo?: string;
}
