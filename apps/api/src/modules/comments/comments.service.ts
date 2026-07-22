import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";

const authorSelect = { id: true, firstName: true, lastName: true } as const;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, authorId: string, entityType: string, entityId: string, body: string) {
    return this.prisma.comment.create({
      data: { companyId, authorId, entityType, entityId, body },
      include: { author: { select: authorSelect } },
    });
  }

  async list(companyId: string, entityType: string, entityId: string) {
    return this.prisma.comment.findMany({
      where: { companyId, entityType, entityId, deletedAt: null },
      include: { author: { select: authorSelect } },
      orderBy: { createdAt: "asc" },
    });
  }

  async update(companyId: string, authorId: string, id: string, body: string) {
    const comment = await this.findOne(companyId, id);
    if (comment.authorId !== authorId) {
      throw new ForbiddenException("You can only edit your own comments");
    }
    return this.prisma.comment.update({
      where: { id },
      data: { body },
      include: { author: { select: authorSelect } },
    });
  }

  async remove(companyId: string, authorId: string, id: string): Promise<void> {
    const comment = await this.findOne(companyId, id);
    if (comment.authorId !== authorId) {
      throw new ForbiddenException("You can only delete your own comments");
    }
    await this.prisma.comment.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  private async findOne(companyId: string, id: string) {
    const comment = await this.prisma.comment.findFirst({ where: { id, companyId, deletedAt: null } });
    if (!comment) {
      throw new NotFoundException("Comment not found");
    }
    return comment;
  }
}
