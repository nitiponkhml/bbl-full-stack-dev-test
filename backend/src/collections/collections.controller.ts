import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

function ownerId(req: Request): string {
  return (req.user as { sub: string }).sub;
}

@Controller('collections')
@UseGuards(JwtAuthGuard)
export class CollectionsController {
  constructor(private readonly collectionsService: CollectionsService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateCollectionDto) {
    return this.collectionsService.create(ownerId(req), dto);
  }

  @Get()
  findAll(@Req() req: Request, @Query('name') name?: string) {
    return this.collectionsService.findAll(ownerId(req), name);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.collectionsService.findOne(ownerId(req), id);
  }

  @Get(':id/bookmarks')
  findBookmarks(@Req() req: Request, @Param('id') id: string) {
    return this.collectionsService.findBookmarks(ownerId(req), id);
  }

  @Put(':id')
  replace(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateCollectionDto) {
    return this.collectionsService.update(ownerId(req), id, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateCollectionDto) {
    return this.collectionsService.update(ownerId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.collectionsService.remove(ownerId(req), id);
  }
}
