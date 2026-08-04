import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsEmail, IsOptional, IsString, IsUUID, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../../auth/validators/is-strong-password.validator";

export class CreateUserDto {
  @ApiProperty({ example: "teammate@acme.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ description: "Initial password — the user can change it later via account settings" })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: "Priya" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: "Patel" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;

  @ApiPropertyOptional({ type: [String], description: "Branch IDs to grant access to" })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  branchIds?: string[];

  @ApiPropertyOptional({ type: [String], description: "Role IDs to grant company-wide" })
  @IsOptional()
  @IsArray()
  @IsUUID(4, { each: true })
  roleIds?: string[];
}
