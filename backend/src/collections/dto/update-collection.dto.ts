import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class UpdateCollectionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;
}
