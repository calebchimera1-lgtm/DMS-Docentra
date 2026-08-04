"use client";

import { Plus, Trash2 } from "lucide-react";
import { Button, Input } from "@omniflow/ui";
import { formatCents } from "../../lib/format";
import type { LedgerAccount } from "../../lib/types";

export interface DraftJournalLine {
  ledgerAccountId: string;
  side: "debit" | "credit";
  amountDollars: string;
  description: string;
}

export function emptyJournalLine(): DraftJournalLine {
  return { ledgerAccountId: "", side: "debit", amountDollars: "", description: "" };
}

export function toJournalLinePayload(lines: DraftJournalLine[]) {
  return lines
    .filter((line) => line.ledgerAccountId && line.amountDollars)
    .map((line) => {
      const cents = Math.round(parseFloat(line.amountDollars || "0") * 100);
      return {
        ledgerAccountId: line.ledgerAccountId,
        debitCents: line.side === "debit" ? cents : 0,
        creditCents: line.side === "credit" ? cents : 0,
        description: line.description.trim() || undefined,
      };
    });
}

export function JournalLinesEditor({
  lines,
  onChange,
  ledgerAccounts,
}: {
  lines: DraftJournalLine[];
  onChange: (lines: DraftJournalLine[]) => void;
  ledgerAccounts: LedgerAccount[];
}) {
  const payload = toJournalLinePayload(lines);
  const totalDebitCents = payload.reduce((sum, l) => sum + l.debitCents, 0);
  const totalCreditCents = payload.reduce((sum, l) => sum + l.creditCents, 0);
  const isBalanced = totalDebitCents === totalCreditCents && totalDebitCents > 0;

  function update(index: number, patch: Partial<DraftJournalLine>) {
    onChange(lines.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function remove(index: number) {
    onChange(lines.length > 2 ? lines.filter((_, i) => i !== index) : lines);
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-[2fr_100px_120px_1fr_32px] gap-2 text-xs font-medium text-muted-foreground">
        <span>Ledger account</span>
        <span>Side</span>
        <span>Amount</span>
        <span>Description</span>
        <span />
      </div>
      {lines.map((line, index) => (
        <div key={index} className="grid grid-cols-[2fr_100px_120px_1fr_32px] items-center gap-2">
          <select
            value={line.ledgerAccountId}
            onChange={(e) => update(index, { ledgerAccountId: e.target.value })}
            className="h-10 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="">Account…</option>
            {ledgerAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <select
            value={line.side}
            onChange={(e) => update(index, { side: e.target.value as "debit" | "credit" })}
            className="h-10 rounded-md border border-border bg-background px-2 text-sm"
          >
            <option value="debit">Debit</option>
            <option value="credit">Credit</option>
          </select>
          <Input
            type="number"
            min="0"
            step="0.01"
            placeholder="0.00"
            value={line.amountDollars}
            onChange={(e) => update(index, { amountDollars: e.target.value })}
          />
          <Input
            placeholder="Description (optional)"
            value={line.description}
            onChange={(e) => update(index, { description: e.target.value })}
          />
          <Button type="button" size="icon" variant="ghost" onClick={() => remove(index)} aria-label="Remove line">
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex items-center justify-between">
        <Button type="button" size="sm" variant="outline" onClick={() => onChange([...lines, emptyJournalLine()])}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          Add line
        </Button>
        <span className={`text-sm font-medium ${isBalanced ? "text-foreground" : "text-red-600"}`}>
          Debits {formatCents(totalDebitCents)} / Credits {formatCents(totalCreditCents)}
          {!isBalanced && " (not balanced)"}
        </span>
      </div>
    </div>
  );
}
