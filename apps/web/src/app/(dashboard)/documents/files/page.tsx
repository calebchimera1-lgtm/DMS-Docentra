"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Download, Lock, Plus } from "lucide-react";
import { PERMISSIONS } from "@omniflow/shared";
import { Badge, Button, Card, CardContent, Input } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../lib/api-client";
import { downloadCsv } from "../../../../lib/format";
import type { DocumentFolder, DocumentStatus, ManagedDocument, Paginated } from "../../../../lib/types";
import { useAuth } from "../../../../providers/auth-provider";
import { DocumentsSubnav } from "../../../../components/documents/documents-subnav";

export default function DocumentsListPage() {
  const { user } = useAuth();
  const canWrite = user?.effectivePermissions.includes(PERMISSIONS.DOCUMENTS_WRITE) ?? false;
  const canDelete = user?.effectivePermissions.includes(PERMISSIONS.DOCUMENTS_DELETE) ?? false;

  const [result, setResult] = useState<Paginated<ManagedDocument> | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [statusFilter, setStatusFilter] = useState<DocumentStatus | "">("");

  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [folderId, setFolderId] = useState("");
  const [fileName, setFileName] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const [checkingInId, setCheckingInId] = useState<string | null>(null);
  const [newFileName, setNewFileName] = useState("");
  const [versionNote, setVersionNote] = useState("");

  const load = () => {
    const qs = new URLSearchParams({ page: "1", pageSize: "50" });
    if (statusFilter) qs.set("status", statusFilter);
    void apiClient.get<Paginated<ManagedDocument>>(`/documents/files?${qs}`).then(setResult);
  };

  useEffect(load, [statusFilter]);
  useEffect(() => {
    void apiClient
      .get<Paginated<DocumentFolder>>("/documents/folders?page=1&pageSize=100")
      .then((r) => setFolders(r.items));
  }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await apiClient.post("/documents/files", {
        title,
        folderId: folderId || undefined,
        description: description || undefined,
        fileName,
      });
      setTitle("");
      setFolderId("");
      setFileName("");
      setDescription("");
      setShowCreate(false);
      load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to create document");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleAction(
    id: string,
    action: "check-out" | "cancel-check-out" | "publish" | "archive" | "restore",
  ) {
    setActionError(null);
    try {
      await apiClient.post(`/documents/files/${id}/${action}`, {});
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : `Failed to ${action.replace(/-/g, " ")}`);
    }
  }

  async function handleCheckIn(id: string) {
    setActionError(null);
    try {
      await apiClient.post(`/documents/files/${id}/check-in`, {
        fileName: newFileName || "revision",
        note: versionNote || undefined,
      });
      setCheckingInId(null);
      setNewFileName("");
      setVersionNote("");
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to check in");
    }
  }

  async function handleDelete(id: string) {
    setActionError(null);
    try {
      await apiClient.delete(`/documents/files/${id}`);
      load();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Failed to delete document");
    }
  }

  async function handleExport() {
    const csv = await apiClient.get<string>("/documents/files/export");
    downloadCsv(csv, "documents.csv");
  }

  /** Someone else holds the lock — every editing action is unavailable. */
  const lockedByOther = (doc: ManagedDocument) => Boolean(doc.checkedOutById && doc.checkedOutById !== user?.id);
  const lockedByMe = (doc: ManagedDocument) => Boolean(doc.checkedOutById && doc.checkedOutById === user?.id);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Controlled documents with version history and exclusive check-out.
        </p>
      </div>

      <DocumentsSubnav />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as DocumentStatus | "")}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm"
        >
          <option value="">All statuses</option>
          <option value="DRAFT">Draft</option>
          <option value="PUBLISHED">Published</option>
          <option value="ARCHIVED">Archived</option>
        </select>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-1 h-3.5 w-3.5" />
            Export CSV
          </Button>
          {canWrite && (
            <Button type="button" size="sm" onClick={() => setShowCreate((v) => !v)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              New document
            </Button>
          )}
        </div>
      </div>

      {showCreate && (
        <Card>
          <CardContent className="flex flex-col gap-3 p-4">
            <form onSubmit={handleCreate} className="grid grid-cols-1 gap-3 sm:grid-cols-4">
              <Input placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} required />
              <select
                value={folderId}
                onChange={(e) => setFolderId(e.target.value)}
                className="h-10 rounded-md border border-border bg-background px-3 text-sm"
              >
                <option value="">No folder…</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
              <Input
                placeholder="File name (version 1)"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                required
              />
              <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
              <Button type="submit" disabled={submitting} className="sm:col-start-4">
                {submitting ? "Creating…" : "Create document"}
              </Button>
            </form>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </CardContent>
        </Card>
      )}

      {actionError && <p className="text-sm text-red-600">{actionError}</p>}

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-muted-foreground">
                <th className="p-3 font-medium">Title</th>
                <th className="p-3 font-medium">Folder</th>
                <th className="p-3 font-medium">Version</th>
                <th className="p-3 font-medium">Status</th>
                <th className="p-3 font-medium">Lock</th>
                <th className="p-3 font-medium" />
              </tr>
            </thead>
            <tbody>
              {result === null ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    Loading…
                  </td>
                </tr>
              ) : result.items.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-4 text-center text-muted-foreground">
                    No documents yet.
                  </td>
                </tr>
              ) : (
                result.items.map((doc) => (
                  <tr key={doc.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                    <td className="p-3 font-medium text-foreground">
                      <Link href={`/documents/files/${doc.id}`} className="hover:underline">
                        {doc.title}
                      </Link>
                    </td>
                    <td className="p-3 text-muted-foreground">{doc.folder?.name ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">v{doc.currentVersionNumber}</td>
                    <td className="p-3">
                      <Badge variant={doc.status === "PUBLISHED" ? "default" : "outline"}>{doc.status}</Badge>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {doc.checkedOutBy ? (
                        <span className="flex items-center gap-1">
                          <Lock className="h-3.5 w-3.5" />
                          {doc.checkedOutBy.firstName} {doc.checkedOutBy.lastName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex justify-end gap-2">
                        {canWrite && lockedByOther(doc) && (
                          <span className="text-xs text-muted-foreground">Locked by someone else</span>
                        )}
                        {canWrite && !doc.checkedOutById && doc.status !== "ARCHIVED" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(doc.id, "check-out")}>
                            Check out
                          </Button>
                        )}
                        {canWrite && lockedByMe(doc) && (
                          <>
                            {checkingInId === doc.id ? (
                              <>
                                <Input
                                  placeholder="New file name"
                                  value={newFileName}
                                  onChange={(e) => setNewFileName(e.target.value)}
                                  className="h-9 w-36"
                                />
                                <Input
                                  placeholder="What changed"
                                  value={versionNote}
                                  onChange={(e) => setVersionNote(e.target.value)}
                                  className="h-9 w-36"
                                />
                                <Button type="button" size="sm" onClick={() => handleCheckIn(doc.id)}>
                                  Confirm
                                </Button>
                              </>
                            ) : (
                              <Button type="button" size="sm" onClick={() => setCheckingInId(doc.id)}>
                                Check in
                              </Button>
                            )}
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => handleAction(doc.id, "cancel-check-out")}
                            >
                              Cancel
                            </Button>
                          </>
                        )}
                        {canWrite && !doc.checkedOutById && doc.status === "DRAFT" && (
                          <Button type="button" size="sm" onClick={() => handleAction(doc.id, "publish")}>
                            Publish
                          </Button>
                        )}
                        {canWrite && !doc.checkedOutById && doc.status === "PUBLISHED" && (
                          <Button type="button" size="sm" variant="outline" onClick={() => handleAction(doc.id, "archive")}>
                            Archive
                          </Button>
                        )}
                        {canWrite && doc.status === "ARCHIVED" && (
                          <Button type="button" size="sm" onClick={() => handleAction(doc.id, "restore")}>
                            Restore
                          </Button>
                        )}
                        {canDelete && !doc.checkedOutById && doc.status !== "PUBLISHED" && (
                          <Button type="button" size="sm" variant="destructive" onClick={() => handleDelete(doc.id)}>
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
