import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateBookmarkDto } from './dto/create-bookmark.dto';
import { UpdateBookmarkDto } from './dto/update-bookmark.dto';

@Injectable()
export class BookmarksService {
  private readonly logger = new Logger(BookmarksService.name);

  constructor(private readonly prisma: PrismaService) {}

  private async assertCollectionOwned(ownerId: string, collectionId: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id: collectionId, ownerId },
    });

    if (!collection) {
      this.logger.warn('Collection not found');
      throw new NotFoundException('Collection not found');
    }
  }

  async create(ownerId: string, dto: CreateBookmarkDto) {
    if (dto.collectionId) {
      await this.assertCollectionOwned(ownerId, dto.collectionId);
    }

    this.logger.log('Bookmark created');
    return this.prisma.bookmark.create({
      data: {
        url: dto.url,
        title: dto.title,
        notes: dto.notes,
        collectionId: dto.collectionId,
        ownerId,
      },
    });
  }

  findAll(ownerId: string, collectionId?: string) {
    return this.prisma.bookmark.findMany({
      where: {
        ownerId,
        ...(collectionId ? { collectionId } : {}),
      },
    });
  }

  async findOne(ownerId: string, id: string) {
    const bookmark = await this.prisma.bookmark.findFirst({
      where: { id, ownerId },
    });

    if (!bookmark) {
      this.logger.warn('Bookmark not found');
      throw new NotFoundException('Bookmark not found');
    }

    return bookmark;
  }

  async update(ownerId: string, id: string, dto: UpdateBookmarkDto) {
    if (dto.collectionId) {
      await this.assertCollectionOwned(ownerId, dto.collectionId);
    }

    const result = await this.prisma.bookmark.updateMany({
      where: { id, ownerId },
      data: {
        url: dto.url,
        title: dto.title,
        notes: dto.notes,
        collectionId: dto.collectionId,
      },
    });

    if (result.count === 0) {
      this.logger.warn('Bookmark not found');
      throw new NotFoundException('Bookmark not found');
    }

    this.logger.log('Bookmark updated');
    return this.prisma.bookmark.findFirstOrThrow({ where: { id, ownerId } });
  }

  async remove(ownerId: string, id: string) {
    const result = await this.prisma.bookmark.deleteMany({
      where: { id, ownerId },
    });

    if (result.count === 0) {
      this.logger.warn('Bookmark not found');
      throw new NotFoundException('Bookmark not found');
    }

    this.logger.log('Bookmark deleted');
  }
}
