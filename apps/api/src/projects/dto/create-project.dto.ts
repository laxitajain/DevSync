import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class CreateProjectDto {
  @IsString()
  @MinLength(2)
  @MaxLength(80)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(12)
  @Matches(/^[A-Z][A-Z0-9]*$/)
  key!: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;
}
