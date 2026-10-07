"use client";
import { useEffect, useState } from "react";
interface DownloadEntry { id: string; profile_name: string; kind: string; file_name: string; created_at: string }
export function DownloadsSection() {
  const [page, setPage] = useState(0);
  const [revision, setRevision] = useState(0);
  const [data, setData] = useState<{ entries: DownloadEntry[]; total: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/admin/downloads?page=${page}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "Unable to load downloads.");
        if (!controller.signal.aborted) { setData(result); setError(null); }
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : "Unable to load downloads.");
      } finally { if (!controller.signal.aborted) setLoading(false); }
    }
    void load();
    return () => controller.abort();
  }, [page, revision]);
  function navigate(next: number) { setLoading(true); setPage(next); }
  return <div className="space-y-3">
    <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Download activity</h3><button disabled={loading} className="text-xs underline disabled:opacity-50" onClick={() => { setLoading(true); setRevision(value => value + 1); }}>Refresh</button></div>
    <p className="text-xs text-muted-foreground">Resume and export download requests. Previews are excluded. Saving the file is not confirmed.</p>
    {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : loading ? <p className="text-sm text-muted-foreground">Loading downloads…</p> : <>
      <div className="overflow-x-auto rounded-xl border border-border/50"><table className="w-full text-left text-xs">
        <thead className="bg-muted/40"><tr>{["User", "File", "Type", "When"].map(label => <th key={label} className="p-3 font-medium">{label}</th>)}</tr></thead>
        <tbody>{data?.entries.map(entry => <tr key={entry.id} className="border-t border-border/40"><td className="p-3">{entry.profile_name}</td><td className="break-all p-3">{entry.file_name}</td><td className="p-3">{entry.kind === "resume" ? "Resume" : "Export"}</td><td className="whitespace-nowrap p-3">{new Date(entry.created_at).toLocaleString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</td></tr>)}
        {!data?.entries.length && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">No downloads recorded yet.</td></tr>}</tbody>
      </table></div>
      <div className="flex items-center justify-between text-xs text-muted-foreground"><span>{data?.total ?? 0} requests · Page {page + 1}</span><div className="flex gap-3"><button disabled={page === 0} className="disabled:opacity-50" onClick={() => navigate(page - 1)}>Previous</button><button disabled={(page + 1) * 25 >= (data?.total ?? 0)} className="disabled:opacity-50" onClick={() => navigate(page + 1)}>Next</button></div></div>
    </>}
  </div>;
}
