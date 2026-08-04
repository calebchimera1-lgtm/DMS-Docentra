import { ApiProperty } from "@nestjs/swagger";
import { IsString, MaxLength, MinLength } from "class-validator";

export class UploadAttachmentDto {
  @ApiProperty({ description: "The kind of record this file is attached to, e.g. \"User\"" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  entityType!: string;

  @ApiProperty({ description: "The id of the record this file is attached to" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  entityId!: string;
}
