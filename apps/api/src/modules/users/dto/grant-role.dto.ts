import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsUUID } from "class-validator";

export class GrantRoleDto {
  @ApiProperty()
  @IsUUID()
  roleId!: string;

  @ApiPropertyOptional({ description: "Scope the grant to a single branch; omit for company-wide" })
  @IsOptional()
  @IsUUID()
  branchId?: string;
}
