import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';

@Injectable()
export class CollectionsService {
  private readonly logger = new Logger(CollectionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  create(ownerId: string, dto: CreateCollectionDto) {
    this.logger.log('Collection created');
    return this.prisma.collection.create({
      data: { name: dto.name, ownerId },
    });
  }

  findAll(ownerId: string, name?: string) {
    return this.prisma.collection.findMany({
      where: {
        ownerId,
        ...(name ? { name: { contains: name, mode: 'insensitive' } } : {}),
      },
    });
  }

  async findOne(ownerId: string, id: string) {
    const collection = await this.prisma.collection.findFirst({
      where: { id, ownerId },
    });

    if (!collection) {
      this.logger.warn('Collection not found');
      throw new NotFoundException('Collection not found');
    }

    return collection;
  }

  async update(ownerId: string, id: string, dto: UpdateCollectionDto) {
    const result = await this.prisma.collection.updateMany({
      where: { id, ownerId },
      data: { name: dto.name },
    });

    if (result.count === 0) {
      this.logger.warn('Collection not found');
      throw new NotFoundException('Collection not found');
    }

    this.logger.log('Collection updated');
    return this.prisma.collection.findFirstOrThrow({ where: { id, ownerId } });
  }

  async remove(ownerId: string, id: string) {
    const result = await this.prisma.collection.deleteMany({
      where: { id, ownerId },
    });

    if (result.count === 0) {
      this.logger.warn('Collection not found');
      throw new NotFoundException('Collection not found');
    }

    this.logger.log('Collection deleted');
  }

  async findBookmarks(ownerId: string, id: string) {
    await this.findOne(ownerId, id);

    return this.prisma.bookmark.findMany({
      where: { collectionId: id, ownerId },
    });
  }
}
