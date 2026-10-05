import { Transform } from 'class-transformer';
import { IsEnum, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { TaskStatus } from '../task.entity.js';

export const TASK_SORT_FIELDS = [
  'createdAt',
  'updatedAt',
  'title',
  'status',
] as const;
export type TaskSortField = (typeof TASK_SORT_FIELDS)[number];

export const SORT_ORDERS = ['asc', 'desc'] as const;
export type SortOrder = (typeof SORT_ORDERS)[number];

export class ListTasksQueryDto {
  // Blank or whitespace-only search means "no search filter".
  @IsOptional()
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim() || undefined : value,
  )
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @IsOptional()
  @IsIn(TASK_SORT_FIELDS)
  sort?: TaskSortField;

  @IsOptional()
  @IsIn(SORT_ORDERS)
  order?: SortOrder;
}
