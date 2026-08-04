import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { ArrayMinSize, IsArray, IsDateString, IsOptional, IsString, MaxLength, ValidateNested } from "class-validator";
import { JournalLineDto } from "./journal-line.dto";

export class CreateJournalEntryDto {
  @ApiProperty()
  @IsDateString()
  entryDate!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  memo?: string;

  @ApiProperty({ type: [JournalLineDto], description: "At least two lines; total debits must equal total credits" })
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => JournalLineDto)
  lines!: JournalLineDto[];
}
