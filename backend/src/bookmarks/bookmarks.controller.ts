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
import { BookmarksService } from './bookmarks.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';

function ownerId(req: Request): string {
  return (req.user as { sub: string }).sub;
}

@Controller('bookmarks')
@UseGuards(JwtAuthGuard)
export class BookmarksController {
  constructor(private readonly bookmarksService: BookmarksService) {}

  @Post()
  create(@Req() req: Request, @Body() dto: CreateBookmarkDto) {
    return this.bookmarksService.create(ownerId(req), dto);
  }

  @Get()
  findAll(@Req() req: Request, @Query('collectionId') collectionId?: string) {
    return this.bookmarksService.findAll(ownerId(req), collectionId);
  }

  @Get(':id')
  findOne(@Req() req: Request, @Param('id') id: string) {
    return this.bookmarksService.findOne(ownerId(req), id);
  }

  @Put(':id')
  replace(@Req() req: Request, @Param('id') id: string, @Body() dto: CreateBookmarkDto) {
    return this.bookmarksService.update(ownerId(req), id, dto);
  }

  @Patch(':id')
  update(@Req() req: Request, @Param('id') id: string, @Body() dto: UpdateBookmarkDto) {
    return this.bookmarksService.update(ownerId(req), id, dto);
  }

  @Delete(':id')
  @HttpCode(204)
  async remove(@Req() req: Request, @Param('id') id: string) {
    await this.bookmarksService.remove(ownerId(req), id);
  }
}
