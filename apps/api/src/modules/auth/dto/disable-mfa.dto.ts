import { ApiProperty } from "@nestjs/swagger";
import { IsString, Length } from "class-validator";

export class DisableMfaDto {
  @ApiProperty({ description: "6-digit TOTP code, or a backup recovery code" })
  @IsString()
  @Length(6, 12)
  code!: string;
}
