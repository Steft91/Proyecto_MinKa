import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CompleteProfileDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nombres!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  apellidos!: string;

  @IsDateString()
  fecha_nacimiento!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  sector_residencia!: string;
}
