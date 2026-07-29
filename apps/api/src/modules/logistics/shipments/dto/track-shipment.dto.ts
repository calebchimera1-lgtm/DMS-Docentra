import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsOptional, IsString, MaxLength } from "class-validator";

/** Shared shape for the actions that only append a tracking event. */
export class TrackShipmentDto {
  @ApiPropertyOptional({ description: "Where the shipment was when this happened" })
  @IsOptional()
  @IsString()
  @MaxLength(300)
  location?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
