"use client";

import { useEffect, useState } from "react";
import { Minus, Plus, ShoppingCart, Trash2 } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { formatCents } from "../../../../lib/format";
import type { Paginated, PaymentMethod, PosSale, PosSession, Product, Warehouse } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { PosSubnav } from "../../../../components/pos/pos-subnav";

const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "BANK_TRANSFER", "OTHER"];

interface CartLine {
  productId: string;
  description: string;
  quantity: number;
  unitPriceCents: number;
}

export default function RegisterPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.POS_WRITE) ?? false;

  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [warehouseId, setWarehouseId] = useState("");
  const [session, setSession] = useState<PosSession | null | undefined>(undefined);
  const [openingFloat, setOpeningFloat] = useState("0");

  const [products, setProducts] = useState<Product[]>([]);
  const [pickProductId, setPickProductId] = useState("");
  const [pickQuantity, setPickQuantity] = useState("1");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [amountTendered, setAmountTendered] = useState("");

  const [closing, setClosing] = useState(false);
  const [countedCash, setCountedCash] = useState("");
  const [lastSale, setLastSale] = useState<PosSale | null>(null);
  const [closedSummary, setClosedSummary] = useState<PosSession | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    void apiClient.get<Paginated<Warehouse>>("/inventory/warehouses?page=1&pageSize=100").then((r) => {
      setWarehouses(r.items);
      const first = r.items[0];
      if (first) setWarehouseId(first.id);
    });
    void apiClient.get<Paginated<Product>>("/sales/products?page=1&pageSize=100").then((r) => setProducts(r.items));
  }, []);

  const loadSession = () => {
    if (!warehouseId) return;
    void apiClient
      .get<Paginated<PosSession>>(`/pos/sessions?warehouseId=${warehouseId}&status=OPEN&pageSize=1`)
      .then((r) => setSession(r.items[0] ?? null));
  };

  useEffect(loadSession, [warehouseId]);

  async function handleOpenSession(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await apiClient.post("/pos/sessions", {
        warehouseId,
        openingFloatCents: Math.round(parseFloat(openingFloat || "0") * 100),
      });
      loadSession();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to open register session");
    } finally {
      setSubmitting(false);
    }
  }

  function addToCart() {
    const product = products.find((p) => p.id === pickProductId);
    if (!product) return;
    const quantity = Math.max(1, parseInt(pickQuantity, 10) || 1);
    setCart((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) => (l.productId === product.id ? { ...l, quantity: l.quantity + quantity } : l));
      }
      return [...prev, { productId: product.id, description: product.name, quantity, unitPriceCents: product.unitPriceCents }];
    });
    setPickProductId("");
    setPickQuantity("1");
  }

  function updateQuantity(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0),
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.productId !== productId));
  }

  const totalCents = cart.reduce((sum, l) => sum + l.quantity * l.unitPriceCents, 0);
  const amountTenderedCents = Math.round(parseFloat(amountTendered || "0") * 100);
  const changeDueCents = paymentMethod === "CASH" ? amountTenderedCents - totalCents : 0;

  async function handleCompleteSale() {
    if (!session || cart.length === 0) return;
    setError(null);
    setSubmitting(true);
    try {
      const sale = await apiClient.post<PosSale>("/pos/sales", {
        sessionId: session.id,
        items: cart.map((l) => ({
          productId: l.productId,
          description: l.description,
          quantity: l.quantity,
          unitPriceCents: l.unitPriceCents,
        })),
        paymentMethod,
        amountTenderedCents: paymentMethod === "CASH" ? amountTenderedCents : undefined,
      });
      setLastSale(sale);
      setCart([]);
      setAmountTendered("");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to complete sale");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleCloseSession() {
    if (!session) return;
    setError(null);
    setSubmitting(true);
    try {
      const closed = await apiClient.post<PosSession>(`/pos/sessions/${session.id}/close`, {
        countedCashCents: Math.round(parseFloat(countedCash || "0") * 100),
      });
      setClosedSummary(closed);
      setClosing(false);
      setCountedCash("");
      setSession(null);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to close register session");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Point of Sale</h1>
        <p className="text-sm text-muted-foreground">
          Register sessions and sales, with immediate stock deduction and cash reconciliation.
        </p>
      </div>

      <PosSubnav />

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={warehouseId}
          onChange={(e) => {
            setWarehouseId(e.target.value);
            setLastSale(null);
            setClosedSummary(null);
          }}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          {warehouses.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      </div>

      {closedSummary && (
        <Card>
          <CardHeader>
            <CardTitle>Register closed — {closedSummary.sessionNumber}</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Expected cash</p>
              <p className="font-medium text-foreground">{formatCents(closedSummary.expectedCashCents ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Counted cash</p>
              <p className="font-medium text-foreground">{formatCents(closedSummary.countedCashCents ?? 0)}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Difference</p>
              <p className="font-medium text-foreground">{formatCents(closedSummary.cashDifferenceCents ?? 0)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {session === undefined && <p className="text-sm text-muted-foreground">Loading…</p>}

      {session === null && (
        <Card>
          <CardHeader>
            <CardTitle>Open a register session</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleOpenSession} className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs text-muted-foreground">Opening cash float</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openingFloat}
                  onChange={(e) => setOpeningFloat(e.target.value)}
                  className="w-40"
                />
              </div>
              <Button type="submit" disabled={submitting || !canWrite}>
                {submitting ? "Opening…" : "Open register"}
              </Button>
            </form>
            {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {session && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="flex flex-col gap-4 lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle>
                  {session.sessionNumber} <Badge>OPEN</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <select
                  value={pickProductId}
                  onChange={(e) => setPickProductId(e.target.value)}
                  className="h-10 flex-1 rounded-md border border-border bg-background px-3 text-sm"
                >
                  <option value="">Select a product…</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.sku} — {p.name} ({formatCents(p.unitPriceCents)})
                    </option>
                  ))}
                </select>
                <Input
                  type="number"
                  min="1"
                  value={pickQuantity}
                  onChange={(e) => setPickQuantity(e.target.value)}
                  className="w-20"
                />
                <Button type="button" onClick={addToCart} disabled={!pickProductId || !canWrite}>
                  <ShoppingCart className="mr-1 h-3.5 w-3.5" />
                  Add
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="p-3 font-medium">Item</th>
                      <th className="p-3 font-medium">Qty</th>
                      <th className="p-3 font-medium">Unit price</th>
                      <th className="p-3 font-medium">Line total</th>
                      <th className="p-3 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {cart.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-4 text-center text-muted-foreground">
                          Cart is empty.
                        </td>
                      </tr>
                    ) : (
                      cart.map((line) => (
                        <tr key={line.productId} className="border-b border-border last:border-0">
                          <td className="p-3 font-medium text-foreground">{line.description}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button type="button" size="icon" variant="ghost" onClick={() => updateQuantity(line.productId, -1)}>
                                <Minus className="h-3.5 w-3.5" />
                              </Button>
                              <span className="w-6 text-center">{line.quantity}</span>
                              <Button type="button" size="icon" variant="ghost" onClick={() => updateQuantity(line.productId, 1)}>
                                <Plus className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                          <td className="p-3 text-muted-foreground">{formatCents(line.unitPriceCents)}</td>
                          <td className="p-3 text-muted-foreground">{formatCents(line.quantity * line.unitPriceCents)}</td>
                          <td className="p-3 text-right">
                            <Button type="button" size="icon" variant="ghost" onClick={() => removeLine(line.productId)} aria-label="Remove">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="flex flex-col gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Checkout</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col gap-3">
                <div className="flex items-center justify-between text-lg font-semibold text-foreground">
                  <span>Total</span>
                  <span>{formatCents(totalCents)}</span>
                </div>
                <select
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                  className="h-10 rounded-md border border-border bg-background px-3 text-sm"
                >
                  {PAYMENT_METHODS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
                {paymentMethod === "CASH" && (
                  <>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Amount tendered"
                      value={amountTendered}
                      onChange={(e) => setAmountTendered(e.target.value)}
                    />
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>Change due</span>
                      <span>{formatCents(Math.max(0, changeDueCents))}</span>
                    </div>
                  </>
                )}
                <Button type="button" onClick={handleCompleteSale} disabled={submitting || cart.length === 0 || !canWrite}>
                  {submitting ? "Processing…" : "Complete sale"}
                </Button>
                {error && <p className="text-sm text-red-600">{error}</p>}
              </CardContent>
            </Card>

            {lastSale && (
              <Card>
                <CardHeader>
                  <CardTitle>Last sale — {lastSale.saleNumber}</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground">
                  {formatCents(lastSale.totalCents)} via {lastSale.paymentMethod}
                  {lastSale.changeDueCents !== null && lastSale.changeDueCents > 0 && (
                    <> · change {formatCents(lastSale.changeDueCents)}</>
                  )}
                </CardContent>
              </Card>
            )}

            <Card>
              <CardContent className="flex flex-col gap-3 p-4">
                {!closing ? (
                  <Button type="button" variant="outline" onClick={() => setClosing(true)} disabled={!canWrite}>
                    Close register
                  </Button>
                ) : (
                  <>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      placeholder="Counted cash in drawer"
                      value={countedCash}
                      onChange={(e) => setCountedCash(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button type="button" onClick={handleCloseSession} disabled={submitting}>
                        Confirm close
                      </Button>
                      <Button type="button" variant="outline" onClick={() => setClosing(false)}>
                        Cancel
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}
