import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsObject, IsOptional } from "class-validator";

export class EnablePluginDto {
  @ApiPropertyOptional({
    description: "Plugin-specific config, e.g. { \"webhookUrl\": \"https://...\" } for webhook-notifier",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  config?: Record<string, unknown>;
}
