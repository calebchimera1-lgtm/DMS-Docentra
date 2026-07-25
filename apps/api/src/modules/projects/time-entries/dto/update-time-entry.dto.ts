import { PartialType, PickType } from "@nestjs/swagger";
import { CreateTimeEntryDto } from "./create-time-entry.dto";

export class UpdateTimeEntryDto extends PartialType(
  PickType(CreateTimeEntryDto, ["minutes", "entryDate", "note", "billable"] as const),
) {}
