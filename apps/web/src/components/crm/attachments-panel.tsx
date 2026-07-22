"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Paperclip, Trash2 } from "lucide-react";
import { Button, Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { ApiError, apiClient } from "../../lib/api-client";
import type { CrmAttachment } from "../../lib/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AttachmentsPanel({ entityType, entityId }: { entityType: string; entityId: string }) {
  const [attachments, setAttachments] = useState<CrmAttachment[] | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const load = () => {
    void apiClient
      .get<CrmAttachment[]>(`/attachments?entityType=${entityType}&entityId=${entityId}`)
      .then(setAttachments);
  };

  useEffect(load, [entityType, entityId]);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("entityType", entityType);
      formData.append("entityId", entityId);
      await apiClient.upload("/attachments", formData);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Upload failed. Please try again.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleDownload(id: string) {
    setError(null);
    try {
      const { url } = await apiClient.get<{ url: string }>(`/attachments/${id}/download`);
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Couldn't get a download link. Please try again.");
    }
  }

  async function handleDelete(id: string) {
    setError(null);
    try {
      await apiClient.delete(`/attachments/${id}`);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Delete failed. Please try again.");
    }
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0">
        <CardTitle>Attachments</CardTitle>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={uploading}
          onClick={() => fileInputRef.current?.click()}
        >
          <Paperclip className="mr-1 h-3.5 w-3.5" />
          {uploading ? "Uploading…" : "Upload"}
        </Button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {attachments === null ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : attachments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No files attached yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {attachments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-md border border-border p-2 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-foreground">{a.originalName}</p>
                  <p className="text-xs text-muted-foreground">{formatBytes(a.sizeBytes)}</p>
                </div>
                <div className="flex shrink-0 gap-1">
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleDownload(a.id)}>
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button type="button" size="icon" variant="ghost" onClick={() => handleDelete(a.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
