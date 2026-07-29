"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Lock } from "lucide-react";
import { Badge, Button, Card, CardContent, CardHeader, CardTitle } from "@omniflow/ui";
import { ApiError, apiClient } from "../../../../../lib/api-client";
import type { ManagedDocument } from "../../../../../lib/types";
import { DocumentsSubnav } from "../../../../../components/documents/documents-subnav";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const [doc, setDoc] = useState<ManagedDocument | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!params?.id) return;
    void apiClient
      .get<ManagedDocument>(`/documents/files/${params.id}`)
      .then(setDoc)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load document"));
  }, [params?.id]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Documents</h1>
        <p className="text-sm text-muted-foreground">
          Controlled documents with version history and exclusive check-out.
        </p>
      </div>

      <DocumentsSubnav />

      <Link href="/documents/files">
        <Button type="button" variant="outline" size="sm">
          <ArrowLeft className="mr-1 h-3.5 w-3.5" />
          Back to documents
        </Button>
      </Link>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {doc === null ? (
        !error && <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                {doc.title}
                <Badge variant={doc.status === "PUBLISHED" ? "default" : "outline"}>{doc.status}</Badge>
                {doc.checkedOutBy && (
                  <span className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                    <Lock className="h-3.5 w-3.5" />
                    Checked out by {doc.checkedOutBy.firstName} {doc.checkedOutBy.lastName}
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-1 gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted-foreground">Folder</dt>
                  <dd className="text-foreground">{doc.folder?.name ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Current version</dt>
                  <dd className="text-foreground">v{doc.currentVersionNumber}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Owner</dt>
                  <dd className="text-foreground">
                    {doc.owner ? `${doc.owner.firstName} ${doc.owner.lastName}` : "—"}
                  </dd>
                </div>
                {doc.description && (
                  <div className="sm:col-span-3">
                    <dt className="text-muted-foreground">Description</dt>
                    <dd className="text-foreground">{doc.description}</dd>
                  </div>
                )}
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Version history</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="p-3 font-medium">Version</th>
                    <th className="p-3 font-medium">File</th>
                    <th className="p-3 font-medium">What changed</th>
                    <th className="p-3 font-medium">By</th>
                    <th className="p-3 font-medium">When</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.versions.map((v) => (
                    <tr key={v.id} className="border-b border-border last:border-0">
                      <td className="p-3 font-medium text-foreground">v{v.versionNumber}</td>
                      <td className="p-3 text-muted-foreground">{v.fileName}</td>
                      <td className="p-3 text-muted-foreground">{v.note ?? "—"}</td>
                      <td className="p-3 text-muted-foreground">
                        {v.createdBy ? `${v.createdBy.firstName} ${v.createdBy.lastName}` : "—"}
                      </td>
                      <td className="p-3 text-muted-foreground">{new Date(v.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
