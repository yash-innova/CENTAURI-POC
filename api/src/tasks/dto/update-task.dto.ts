import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsEnum } from 'class-validator';
import { TaskStatus } from '../task.entity.js';

export class UpdateTaskDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @IsOptional()
  @IsBoolean()
  completed?: boolean;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;
}
