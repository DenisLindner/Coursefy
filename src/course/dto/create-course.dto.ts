import { IsNotEmpty, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCourseDTO {
  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(60)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MinLength(4)
  @MaxLength(200)
  description: string;
}
