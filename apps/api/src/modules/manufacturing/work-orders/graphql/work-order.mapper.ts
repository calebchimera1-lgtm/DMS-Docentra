import type { WorkOrderItemType } from "./work-order.type";

interface PrismaWorkOrderWithRelations {
  id: string;
  workOrderNumber: string;
  quantity: number;
  status: string;
  bom: { id: string; name: string };
  product: { id: string; sku: string; name: string };
  warehouse: { id: string; name: string; code: string };
}

export function toWorkOrderItemType(workOrder: PrismaWorkOrderWithRelations): WorkOrderItemType {
  return {
    id: workOrder.id,
    workOrderNumber: workOrder.workOrderNumber,
    quantity: workOrder.quantity,
    status: workOrder.status,
    bom: workOrder.bom,
    product: workOrder.product,
    warehouse: workOrder.warehouse,
  };
}
