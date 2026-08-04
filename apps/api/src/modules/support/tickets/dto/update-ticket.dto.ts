import { OmitType, PartialType } from "@nestjs/swagger";
import { CreateTicketDto } from "./create-ticket.dto";

export class UpdateTicketDto extends PartialType(OmitType(CreateTicketDto, ["assigneeId"] as const)) {}
