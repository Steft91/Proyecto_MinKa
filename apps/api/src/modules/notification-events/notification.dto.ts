import { IsBoolean } from 'class-validator';

export class MarkNotificationDto {
  @IsBoolean()
  leida = true;
}
