import { Field, ID, Int, ObjectType } from "@nestjs/graphql";

@ObjectType()
export class PayslipEmployeeRef {
  @Field(() => ID)
  id!: string;

  @Field()
  employeeNumber!: string;

  @Field()
  firstName!: string;

  @Field()
  lastName!: string;
}

@ObjectType()
export class PayslipPayRunRef {
  @Field(() => ID)
  id!: string;

  @Field()
  periodStart!: Date;

  @Field()
  periodEnd!: Date;

  @Field()
  status!: string;
}

@ObjectType()
export class PayslipItemType {
  @Field(() => ID)
  id!: string;

  @Field(() => Int)
  basicSalaryCents!: number;

  @Field(() => Int)
  grossPayCents!: number;

  @Field(() => Int)
  deductionsCents!: number;

  @Field(() => Int)
  netPayCents!: number;

  @Field()
  currency!: string;

  @Field()
  status!: string;

  @Field(() => PayslipEmployeeRef)
  employee!: PayslipEmployeeRef;

  @Field(() => PayslipPayRunRef)
  payRun!: PayslipPayRunRef;
}
