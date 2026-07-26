"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { formatCents } from "../../../../lib/format";
import type { Contract } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { AttachmentsPanel } from "../../../../components/crm/attachments-panel";
import { CommentsPanel } from "../../../../components/crm/comments-panel";

export default function ContractDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.CONTRACTS_WRITE) ?? false;

  const [contract, setContract] = useState<Contract | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [terminating, setTerminating] = useState(false);
  const [terminationReason, setTerminationReason] = useState("");

  const [renewing, setRenewing] = useState(false);
  const [renewEndDate, setRenewEndDate] = useState("");

  const load = () => {
    void apiClient.get<Contract>(`/contracts/${id}`).then(setContract);
  };

  useEffect(load, [id]);

  async function handleAction(action: "activate" | "expire") {
    setActionError(null);
    try {
      await apiClient.post(`/contracts/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} contract`);
    }
  }

  async function handleTerminate() {
    setActionError(null);
    try {
      await apiClient.post(`/contracts/${id}/terminate`, { terminationReason });
      setTerminating(false);
      setTerminationReason("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to terminate contract");
    }
  }

  async function handleRenew() {
    setActionError(null);
    try {
      await apiClient.post(`/contracts/${id}/renew`, { endDate: renewEndDate });
      setRenewing(false);
      setRenewEndDate("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to renew contract");
    }
  }

  if (!contract) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/contracts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to contracts
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{contract.title}</h1>
          <Badge variant={contract.status === "ACTIVE" ? "default" : "outline"}>{contract.status}</Badge>
          <Badge variant="outline">{contract.type}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {contract.contractNumber}
          {contract.account ? ` · ${contract.account.name}` : ""}
          {" · "}
          {formatCents(contract.valueCents, contract.currency)}
          {" · "}
          {new Date(contract.startDate).toLocaleDateString()} – {new Date(contract.endDate).toLocaleDateString()}
        </p>
        {contract.parentContract && (
          <p className="text-xs text-muted-foreground">
            Renewed from{" "}
            <Link href={`/contracts/${contract.parentContract.id}`} className="hover:underline">
              {contract.parentContract.contractNumber}
            </Link>
          </p>
        )}
        {contract.renewedAsContract && (
          <p className="text-xs text-muted-foreground">
            Renewed as{" "}
            <Link href={`/contracts/${contract.renewedAsContract.id}`} className="hover:underline">
              {contract.renewedAsContract.contractNumber}
            </Link>
          </p>
        )}
        {contract.terminationReason && (
          <p className="text-xs text-red-600">Terminated: {contract.terminationReason}</p>
        )}
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {contract.status === "DRAFT" && (
            <Button type="button" size="sm" onClick={() => handleAction("activate")}>
              Activate
            </Button>
          )}
          {contract.status === "ACTIVE" && (
            <>
              <Button type="button" size="sm" onClick={() => { setRenewing((v) => !v); setTerminating(false); }}>
                Renew
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => { setTerminating((v) => !v); setRenewing(false); }}
              >
                Terminate
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => handleAction("expire")}>
                Mark expired
              </Button>
            </>
          )}
        </div>
      )}

      {renewing && (
        <Card>
          <CardContent className="flex flex-wrap items-end gap-2 p-4">
            <Input type="date" value={renewEndDate} onChange={(e) => setRenewEndDate(e.target.value)} className="w-40" />
            <Button type="button" size="sm" disabled={!renewEndDate} onClick={handleRenew}>
              Confirm renew
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setRenewing(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {terminating && (
        <Card>
          <CardContent className="flex flex-wrap items-center gap-2 p-4">
            <Input
              placeholder="Reason for termination"
              value={terminationReason}
              onChange={(e) => setTerminationReason(e.target.value)}
              className="max-w-sm"
            />
            <Button type="button" size="sm" disabled={!terminationReason} onClick={handleTerminate}>
              Confirm terminate
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setTerminating(false)}>
              Cancel
            </Button>
          </CardContent>
        </Card>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {contract.note && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{contract.note}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CommentsPanel entityType="Contract" entityId={contract.id} />
        <AttachmentsPanel entityType="Contract" entityId={contract.id} />
      </div>
    </div>
  );
}
