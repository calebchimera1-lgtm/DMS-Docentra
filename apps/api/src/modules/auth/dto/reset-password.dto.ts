import { ApiProperty } from "@nestjs/swagger";
import { IsString } from "class-validator";
import { IsStrongPassword } from "../validators/is-strong-password.validator";

export class ResetPasswordDto {
  @ApiProperty()
  @IsString()
  token!: string;

  @ApiProperty()
  @IsStrongPassword()
  newPassword!: string;
}
