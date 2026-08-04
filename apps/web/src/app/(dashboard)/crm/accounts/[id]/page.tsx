"use client";

import { use, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Badge, Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { apiClient } from "../../../../../lib/api-client";
import { formatCents } from "../../../../../lib/format";
import type { CrmAccountDetail } from "../../../../../lib/types";
import { AttachmentsPanel } from "../../../../../components/crm/attachments-panel";
import { CommentsPanel } from "../../../../../components/crm/comments-panel";

export default function CrmAccountDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [account, setAccount] = useState<CrmAccountDetail | null>(null);

  useEffect(() => {
    void apiClient.get<CrmAccountDetail>(`/crm/accounts/${id}`).then(setAccount);
  }, [id]);

  if (!account) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href="/crm/accounts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to accounts
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-foreground">{account.name}</h1>
        <p className="text-sm text-muted-foreground">
          {account.industry ?? "No industry set"}
          {account.website ? ` · ${account.website}` : ""}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contacts ({account.contacts.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {account.contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No contacts linked yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {account.contacts.map((c) => (
                  <li key={c.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">
                      {c.firstName} {c.lastName}
                    </span>
                    <span className="text-muted-foreground">{c.email ?? "—"}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Deals ({account.deals.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {account.deals.length === 0 ? (
              <p className="text-sm text-muted-foreground">No deals linked yet.</p>
            ) : (
              <ul className="flex flex-col gap-2">
                {account.deals.map((d) => (
                  <li key={d.id} className="flex items-center justify-between text-sm">
                    <span className="font-medium text-foreground">{d.title}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline">{d.stage}</Badge>
                      <span className="text-muted-foreground">{formatCents(d.valueCents, d.currency)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CommentsPanel entityType="CrmAccount" entityId={account.id} />
        <AttachmentsPanel entityType="CrmAccount" entityId={account.id} />
      </div>
    </div>
  );
}
