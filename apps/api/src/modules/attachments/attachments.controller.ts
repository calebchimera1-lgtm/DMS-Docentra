import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../auth/interfaces/jwt-payload.interface";
import { AttachmentsService, type UploadedFile as StoredFile } from "./attachments.service";
import { ListAttachmentsQueryDto } from "./dto/list-attachments-query.dto";
import { UploadAttachmentDto } from "./dto/upload-attachment.dto";

@ApiTags("attachments")
@ApiBearerAuth()
@Controller("attachments")
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Post()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 25 * 1024 * 1024 } }))
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        file: { type: "string", format: "binary" },
        entityType: { type: "string" },
        entityId: { type: "string" },
      },
    },
  })
  @ApiOperation({ summary: "Upload a file attached to any record (polymorphic via entityType/entityId)" })
  upload(
    @CurrentUser() user: RequestUser,
    @Body() dto: UploadAttachmentDto,
    @UploadedFile() file: StoredFile,
  ) {
    return this.attachmentsService.upload(user.companyId, user.id, dto.entityType, dto.entityId, file);
  }

  @Get()
  @ApiOperation({ summary: "List attachments for a record" })
  list(@CurrentUser() user: RequestUser, @Query() query: ListAttachmentsQueryDto) {
    return this.attachmentsService.list(user.companyId, user.id, query.entityType, query.entityId);
  }

  @Get(":id/download")
  @ApiOperation({ summary: "Get a short-lived signed URL to download this attachment" })
  getDownloadUrl(@CurrentUser() user: RequestUser, @Param("id") id: string) {
    return this.attachmentsService.getDownloadUrl(user.companyId, user.id, id);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete an attachment" })
  async remove(@CurrentUser() user: RequestUser, @Param("id") id: string): Promise<void> {
    await this.attachmentsService.remove(user.companyId, user.id, id);
  }
}
