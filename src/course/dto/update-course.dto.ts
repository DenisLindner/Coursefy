import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateCourseDTO {
  @IsString()
  @IsOptional()
  @MinLength(4)
  @MaxLength(60)
  title?: string;

  @IsString()
  @IsOptional()
  @MinLength(4)
  @MaxLength(200)
  description?: string;
}
