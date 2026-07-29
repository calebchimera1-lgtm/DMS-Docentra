import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, MaxLength, Min } from "class-validator";

/**
 * Only quantity and note are editable. The plan and account are not:
 * changing either mid-subscription would silently reprice periods that
 * have already been invoiced, so a move between plans is a cancel plus a
 * new subscription rather than an edit.
 */
export class UpdateSubscriptionDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  quantity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  note?: string;
}
