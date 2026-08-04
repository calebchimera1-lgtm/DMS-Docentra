import { ApiProperty } from "@nestjs/swagger";
import { IsEmail, IsString, MaxLength, MinLength } from "class-validator";
import { IsStrongPassword } from "../validators/is-strong-password.validator";

export class RegisterDto {
  @ApiProperty({ example: "Acme Corp" })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  companyName!: string;

  @ApiProperty({ example: "founder@acme.com" })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "Correct-Horse-Battery-9!" })
  @IsStrongPassword()
  password!: string;

  @ApiProperty({ example: "Ada" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  firstName!: string;

  @ApiProperty({ example: "Founder" })
  @IsString()
  @MinLength(1)
  @MaxLength(60)
  lastName!: string;
}
