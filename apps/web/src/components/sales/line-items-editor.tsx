"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@omniflow/ui";
import { formatCents } from "../../lib/format";

export interface DraftLineItem {
  description: string;
  quantity: string;
  unitPriceDollars: string;
}

export function emptyLineItem(): DraftLineItem {
  return { description: "", quantity: "1", unitPriceDollars: "" };
}

export function toLineItemPayload(items: DraftLineItem[]) {
  return items
    .filter((item) => item.description.trim())
    .map((item) => ({
      description: item.description.trim(),
      quantity: Math.max(1, parseInt(item.quantity, 10) || 1),
      unitPriceCents: Math.round(parseFloat(item.unitPriceDollars || "0") * 100),
    }));
}

export function LineItemsEditor({
  items,
  onChange,
}: {
  items: DraftLineItem[];
  onChange: (items: DraftLineItem[]) => void;
}) {
  const subtotalCents = toLineItemPayload(items).reduce((sum, i) => sum + i.quantity * i.unitPriceCents, 0);

  function update(index: number, patch: Partial<DraftLineItem>) {
    onChange(items.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  }

  function remove(index: number) {
    onChange(items.length > 1 ? items.filter((_, i) => i !== index) : items);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[1fr_80px_120px_32px] gap-2 text-xs font-medium text-muted-foreground">
        <span>Description</span>
        <span>Qty</span>
        <span>Unit price</span>
        <span />
      </div>
      {items.map((item, index) => (
        <div key={index} className="grid grid-cols-[1fr_80px_120px_32px] items-center gap-2">
          <Input
            placeholder="Item description"
            value={item.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <Input
            type="number"
            min="1"
            value={item.quantity}
            onChange={(e) => update(index, { quantity: e.target.value })}
          />
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={item.unitPriceDollars}
            onChange={(e) => update(index, { unitPriceDollars: e.target.value })}
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={() => remove(index)}
            aria-label="Remove line"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...items, emptyLineItem()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add line
        </Button>
        <span className="text-sm font-medium text-foreground">Subtotal: {formatCents(subtotalCents)}</span>
      </div>
    </div>
  );
}
