"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../../lib/api-client";
import type { Ticket } from "../../../../../lib/types";
import { useAuth } from "../../../../../providers/auth-provider";
import { AttachmentsPanel } from "../../../../../components/crm/attachments-panel";
import { CommentsPanel } from "../../../../../components/crm/comments-panel";

export default function TicketDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.SUPPORT_WRITE) ?? false;

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = () => {
    void apiClient.get<Ticket>(`/support/tickets/${id}`).then(setTicket);
  };

  useEffect(load, [id]);

  async function handleAction(action: "resolve" | "close" | "reopen") {
    setActionError(null);
    try {
      await apiClient.post(`/support/tickets/${id}/${action}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action} ticket`);
    }
  }

  if (!ticket) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  const isOpenish = ticket.status === "OPEN" || ticket.status === "IN_PROGRESS" || ticket.status === "WAITING_ON_CUSTOMER";

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/support/tickets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to tickets
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold text-foreground">{ticket.subject}</h1>
          <Badge variant={isOpenish ? "default" : "outline"}>{ticket.status}</Badge>
          <Badge variant="outline">{ticket.priority}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          {ticket.ticketNumber}
          {ticket.assignee ? ` · Assigned to ${ticket.assignee.firstName} ${ticket.assignee.lastName}` : " · Unassigned"}
        </p>
      </div>

      {canWrite && (
        <div className="flex flex-wrap gap-2">
          {isOpenish && (
            <Button type="button" size="sm" onClick={() => handleAction("resolve")}>
              Resolve
            </Button>
          )}
          {ticket.status !== "CLOSED" && (
            <Button type="button" size="sm" variant="outline" onClick={() => handleAction("close")}>
              Close
            </Button>
          )}
          {(ticket.status === "RESOLVED" || ticket.status === "CLOSED") && (
            <Button type="button" size="sm" variant="outline" onClick={() => handleAction("reopen")}>
              Reopen
            </Button>
          )}
        </div>
      )}
      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      {ticket.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground">{ticket.description}</p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CommentsPanel entityType="Ticket" entityId={ticket.id} />
        <AttachmentsPanel entityType="Ticket" entityId={ticket.id} />
      </div>
    </div>
  );
}
