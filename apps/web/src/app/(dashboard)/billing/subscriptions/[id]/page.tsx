"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../../lib/api-client";
import { formatCents } from "../../../../../lib/format";
import type { Subscription } from "../../../../../lib/types";
import { BillingSubnav } from "../../../../../components/billing/billing-subnav";

export default function SubscriptionDetailPage() {
  const params = useParams<{ id: string }>();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    void apiClient
      .get<Subscription>(`/billing/subscriptions/${params.id}`)
      .then(setSub)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load subscription"));
  }, [params?.id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Subscription Billing</h1>
        <p className="text-sm text-muted-foreground">
          Recurring plans, subscriptions, and the invoices they generate.
        </p>
      </div>

      <BillingSubnav />

      <Link href="/billing/subscriptions">
        <Button type="button" variant="outline" size="sm">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to subscriptions
        </Button>
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {sub === null ? (
        !error && <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {sub.account.name}
                <Badge variant={sub.status === "ACTIVE" ? "default" : "outline"}>{sub.status}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Plan</dt>
                  <dd className="text-foreground">
                    {sub.plan.name} ({sub.plan.code})
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Price</dt>
                  <dd className="text-foreground">
                    {formatCents(sub.plan.priceCents, sub.plan.currency)} /{" "}
                    {sub.plan.billingInterval.toLowerCase()} × {sub.quantity}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Current period</dt>
                  <dd className="text-foreground">
                    {new Date(sub.currentPeriodStart).toLocaleDateString()} –{" "}
                    {new Date(sub.currentPeriodEnd).toLocaleDateString()}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Started</dt>
                  <dd className="text-foreground">{new Date(sub.startDate).toLocaleDateString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Trial ends</dt>
                  <dd className="text-foreground">
                    {sub.trialEndsAt ? new Date(sub.trialEndsAt).toLocaleDateString() : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Cancelled</dt>
                  <dd className="text-foreground">
                    {sub.cancelledAt ? new Date(sub.cancelledAt).toLocaleDateString() : "—"}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Billing history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Period</th>
                    <th className="p-3 font-medium">Amount</th>
                    <th className="p-3 font-medium">Invoice</th>
                    <th className="p-3 font-medium">Invoice status</th>
                  </tr>
                </thead>
                <tbody>
                  {sub.invoices.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-4 text-center text-muted-foreground">
                        Not billed yet.
                      </td>
                    </tr>
                  ) : (
                    sub.invoices.map((entry) => (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="p-3 text-foreground">
                          {new Date(entry.periodStart).toLocaleDateString()} –{" "}
                          {new Date(entry.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="p-3 text-muted-foreground">{formatCents(entry.amountCents)}</td>
                        <td className="p-3 text-muted-foreground">{entry.invoice.invoiceNumber}</td>
                        <td className="p-3">
                          <Badge variant={entry.invoice.status === "PAID" ? "default" : "outline"}>
                            {entry.invoice.status}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
