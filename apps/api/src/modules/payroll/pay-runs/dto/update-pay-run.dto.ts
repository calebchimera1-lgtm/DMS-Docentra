import { PartialType } from "@nestjs/swagger";
import { CreatePayRunDto } from "./create-pay-run.dto";

export class UpdatePayRunDto extends PartialType(CreatePayRunDto) {}
