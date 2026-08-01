import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { CommentsService } from "./comments.service";
import { CreateCommentDto } from "./dto/create-comment.dto";
import { ListCommentsQueryDto } from "./dto/list-comments-query.dto";
import { UpdateCommentDto } from "./dto/update-comment.dto";

@ApiTags("comments")
@ApiBearerAuth()
@Controller("comments")
export class CommentsController {
  constructor(private readonly commentsService: CommentsService) {}

  @Post()
  @ApiOperation({ summary: "Add a comment to any record (polymorphic via entityType/entityId)" })
  create(@CurrentUser() user: RequestUser, @Body() dto: CreateCommentDto) {
    return this.commentsService.create(user.companyId, user.id, dto.entityType, dto.entityId, dto.body);
  }

  @Get()
  @ApiOperation({ summary: "List comments for a record" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListCommentsQueryDto) {
    return this.commentsService.list(user.companyId, user.id, query.entityType, query.entityId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Edit your own comment" })
  update(@CurrentUser() user: RequestUser, @Param("id") id: string, @Body() dto: UpdateCommentDto) {
    return this.commentsService.update(user.companyId, user.id, id, dto.body);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete your own comment" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.commentsService.remove(user.companyId, user.id, id);
  }
}
