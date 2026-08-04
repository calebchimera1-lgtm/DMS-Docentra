"use client";

import { useEffect, useState } from "react";
import { Button, Card, CardContent, CardHeader, CardTitle, Input } from "@omniflow/ui";
import { apiClient } from "../../lib/api-client";
import type { CrmComment } from "../../lib/types";

export function CommentsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [comments, setComments] = useState<CrmComment[] | null>(null);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    void apiClient
      .get<CrmComment[]>(`/comments?entityType=${entityType}&entityId=${entityId}`)
      .then(setComments);
  };

  useEffect(load, [entityType, entityId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!draft.trim()) return;
    setSubmitting(true);
    try {
      await apiClient.post("/comments", { entityType, entityId, body: draft.trim() });
      setDraft("");
      load();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Comments</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Add a comment…"
            disabled={submitting}
          />
          <Button type="submit" size="sm" disabled={submitting || !draft.trim()}>
            Post
          </Button>
        </form>

        {comments === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {comments.map((c) => (
              <li key={c.id} className="rounded-md border border-border p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {c.author ? `${c.author.firstName} ${c.author.lastName}` : "Unknown"}
                  </span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                </div>
                <p className="mt-1 text-sm text-foreground">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
