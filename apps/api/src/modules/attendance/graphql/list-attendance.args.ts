import { ArgsType, Field, ID, Int, ObjectType } from "@nestjs/graphql";
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from "class-validator";
import { AttendanceItemType } from "./attendance.type";

@ArgsType()
export class ListAttendanceArgs {
  @Field(() => Int, { defaultValue: 1 })
  @IsInt()
  @Min(1)
  page!: number;

  @Field(() => Int, { defaultValue: 20 })
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize!: number;

  @Field(() => ID, { nullable: true })
  @IsOptional()
  @IsUUID()
  employeeId?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string;
}

@ObjectType()
export class PaginatedAttendance {
  @Field(() => [AttendanceItemType])
  items!: AttendanceItemType[];

  @Field(() => Int)
  total!: number;

  @Field(() => Int)
  page!: number;

  @Field(() => Int)
  pageSize!: number;

  @Field(() => Int)
  totalPages!: number;
}
