import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class UpdateBookmarkDto {
  @IsOptional()
  @IsUrl()
  @IsNotEmpty()
  url?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  title?: string;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsString()
  collectionId?: string;
}
