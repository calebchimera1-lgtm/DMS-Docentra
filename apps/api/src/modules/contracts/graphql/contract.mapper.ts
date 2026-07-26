import type { ContractItemType } from "./contract.type";

interface PrismaContractWithRelations {
  id: string;
  contractNumber: string;
  title: string;
  type: string;
  valueCents: number;
  currency: string;
  startDate: Date;
  endDate: Date;
  status: string;
  account: { id: string; name: string } | null;
  owner: { id: string; firstName: string; lastName: string } | null;
}

export function toContractItemType(contract: PrismaContractWithRelations): ContractItemType {
  return {
    id: contract.id,
    contractNumber: contract.contractNumber,
    title: contract.title,
    type: contract.type,
    valueCents: contract.valueCents,
    currency: contract.currency,
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
    account: contract.account ?? undefined,
    owner: contract.owner ?? undefined,
  };
}
