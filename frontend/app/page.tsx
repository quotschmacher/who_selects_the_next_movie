"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import Link from "next/link";
import type { RotationNextResponse, WatchlogResponse } from "@/lib/types";

export default function Page() {
  const qc = useQueryClient();
  const nextTurn = useQuery<RotationNextResponse>({ queryKey: ["next"], queryFn: () => api.get<RotationNextResponse>("/rotation/next") });
  const last5 = useQuery<WatchlogResponse>({ queryKey: ["last5"], queryFn: () => api.get<WatchlogResponse>("/watchlog?limit=5") });
  const confirmMutation = useMutation({
    mutationFn: () => api.post("/rotation/confirm", {}),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["next"]}); qc.invalidateQueries({ queryKey: ["watchlog"]}); qc.invalidateQueries({ queryKey: ["last5"]}); }
  });

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="card">
        <h1 className="text-2xl font-semibold mb-2">Willkommen 🍿</h1>
        <p className="text-sm text-gray-600 mb-3">Lokal gehostet, keine Logins.</p>
        <div className="mt-4 flex gap-3">
          <Link className="btn" href="/search">Zur Suche</Link>
          <Link className="btn" href="/watchlog">Zum Watchlog</Link>
          <Link className="btn" href="/users">Nutzer verwalten</Link>
        </div>
      </div>
      <div className="card flex items-center gap-4">
        <div className="flex-1">
          <h2 className="text-xl font-semibold mb-1">Wer ist als Nächstes dran?</h2>
          {nextTurn.isLoading && <div>Lade…</div>}
          {!nextTurn.isLoading && !nextTurn.data?.next && <div>Keine Nutzer angelegt.</div>}
          {nextTurn.data?.next && (
            <div className="flex items-center gap-3 mt-1">
              {nextTurn.data.next.avatar_url
                ? <img src={nextTurn.data.next.avatar_url} alt={nextTurn.data.next.name} className="w-10 h-10 rounded-full object-cover" />
                : <div className="w-10 h-10 rounded-full bg-gray-200" />}
              <span className="text-lg">{nextTurn.data.next.name}</span>
            </div>
          )}
          <p className="text-xs text-gray-500 mt-2">Rotation basiert auf Reihenfolge & letztem Event.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link href="/search" className="btn">Jetzt auswählen</Link>
          <button className="btn" disabled={!nextTurn.data?.next || confirmMutation.isPending} onClick={()=>confirmMutation.mutate()}>
            Jetzt dran bestätigen
          </button>
        </div>
      </div>
      <div className="card md:col-span-2">
        <h2 className="text-xl font-semibold mb-3">Letzte 5 Filme</h2>
        {last5.isLoading && <div>Lade…</div>}
        <div className="grid sm:grid-cols-5 gap-3">
          {last5.data?.items?.map((w)=>(
            <div key={w.id} className="flex sm:flex-col items-center gap-3">
              {w.poster_url ? <img src={w.poster_url} alt={w.title} className="w-16 h-24 sm:w-full sm:h-40 object-cover rounded" /> : <div className="w-16 h-24 sm:w-full sm:h-40 rounded bg-gray-200" />}
              <div className="text-sm text-center sm:text-left">
                <div className="font-medium">{w.title}</div>
                <div className="text-xs text-gray-600">{new Date(w.watched_at).toLocaleDateString()} • {w.picker_name}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

