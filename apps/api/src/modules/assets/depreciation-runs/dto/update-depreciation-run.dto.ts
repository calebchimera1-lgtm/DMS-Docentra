import { PartialType } from "@nestjs/swagger";
import { CreateDepreciationRunDto } from "./create-depreciation-run.dto";

export class UpdateDepreciationRunDto extends PartialType(CreateDepreciationRunDto) {}
