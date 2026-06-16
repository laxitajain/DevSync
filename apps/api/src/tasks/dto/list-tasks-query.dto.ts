import { Type } from "class-transformer";
import { TaskPriority } from "@devsync/db";
import { IsEnum, IsIn, IsInt, IsOptional, IsString, Max, Min } from "class-validator";

export class ListTasksQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @IsString()
  columnId?: string;

  @IsOptional()
  @IsString()
  assigneeId?: string;

  @IsOptional()
  @IsEnum(TaskPriority)
  priority?: TaskPriority;

  @IsOptional()
  @IsString()
  q?: string;

  @IsOptional()
  @IsIn(["createdAt", "-createdAt", "dueAt", "-dueAt"])
  sort?: "createdAt" | "-createdAt" | "dueAt" | "-dueAt";
}
