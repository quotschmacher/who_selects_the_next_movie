"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  WatchlogResponse,
  WatchlogItem,
  UsersResponse,
  SearchResponse,
  SearchResult,
} from "@/lib/types";

type SearchMode = "title" | "actor";
type SearchKind = "movie" | "tv";

type UpdateWatchEventPayload = {
  watched_at?: string;
  picker_user_id?: number;
  title?: string;
  search_url?: string | null;
  poster_url?: string | null;
  movie_id?: string | number;
};

type TmdbInfo = {
  kind: SearchKind;
  tmdbUrl: string | null;
  imdbUrl: string;
};

function resolveTmdb(item: SearchResult): TmdbInfo {
  const raw = String(item.id ?? "");
  const parts = raw.split(":");
  const isTmdb = parts[0] === "tmdb";
  const tmdbId = isTmdb ? parts[parts.length - 1] : null;
  const typeFromId = isTmdb && parts.length >= 3 ? parts[1] : undefined;
  const derivedKind: SearchKind = item.kind ?? (typeFromId === "tv" ? "tv" : "movie");
  const tmdbUrl =
    isTmdb && tmdbId ? `https://www.themoviedb.org/${derivedKind === "tv" ? "tv" : "movie"}/${tmdbId}` : null;
  const imdbUrl = `https://www.imdb.com/find/?q=${encodeURIComponent(item.title)}`;
  return { kind: derivedKind, tmdbUrl, imdbUrl };
}

function kindLabel(kind: SearchKind): string {
  return kind === "tv" ? "Serie" : "Film";
}

function localDateString(date: Date = new Date()): string {
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 10);
}

export default function WatchlogPage() {
  const [limit, setLimit] = useState(25);
  const [mode, setMode] = useState<SearchMode>("title");
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<WatchlogItem | null>(null);
  const [date, setDate] = useState("");
  const [picker, setPicker] = useState<number | null>(null);
  const [titleVal, setTitleVal] = useState("");
  const [changeMovie, setChangeMovie] = useState(false);
  const qc = useQueryClient();

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  useEffect(() => {
    if (!changeMovie) {
      setQ("");
      setDebouncedQ("");
    }
  }, [changeMovie]);

  const { data, isLoading } = useQuery<WatchlogResponse>({
    queryKey: ["watchlog", limit],
    queryFn: () => api.get<WatchlogResponse>(`/watchlog?limit=${limit}`),
  });

  const users = useQuery<UsersResponse>({
    queryKey: ["users"],
    queryFn: () => api.get<UsersResponse>("/users"),
  });

  const search = useQuery<SearchResponse>({
    queryKey: ["search-edit", debouncedQ, mode],
    queryFn: () => api.get<SearchResponse>(`/movies/search2?q=${encodeURIComponent(debouncedQ)}&mode=${mode}`),
    enabled: changeMovie && debouncedQ.length > 1,
  });

  const patch = useMutation({
    mutationFn: async ({ eventId, payload }: { eventId: number; payload: UpdateWatchEventPayload }) =>
      api.patch(`/watchevents/${eventId}`, payload),
    onSuccess: () => {
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["watchlog"] });
      qc.invalidateQueries({ queryKey: ["last5"] });
    },
  });

  const del = useMutation({
    mutationFn: async (eventId: number) => api.del(`/watchevents/${eventId}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["watchlog"] });
      qc.invalidateQueries({ queryKey: ["last5"] });
    },
  });

  function openEdit(item: WatchlogItem) {
    setCurrent(item);
    setDate(item.watched_at?.slice(0, 10) || localDateString());
    setPicker(null);
    setTitleVal(item.title || "");
    setChangeMovie(item.is_placeholder || false);
    setQ("");
    setDebouncedQ("");
    setOpen(true);
  }

  function selectMovie(movie: SearchResult) {
    if (!current) return;
    const info = resolveTmdb(movie);
    const searchUrl = info.tmdbUrl ?? info.imdbUrl;
    patch.mutate({
      eventId: current.id,
      payload: {
        watched_at: date,
        ...(picker !== null ? { picker_user_id: picker } : {}),
        movie_id: movie.id,
        title: movie.title,
        search_url: searchUrl,
        poster_url: movie.poster || null,
      },
    });
  }

  function saveMetaOnly() {
    if (!current) return;
    patch.mutate({
      eventId: current.id,
      payload: {
        watched_at: date,
        ...(picker !== null ? { picker_user_id: picker } : {}),
        ...(titleVal ? { title: titleVal } : {}),
      },
    });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Zuletzt geschaut</h1>
        <select className="input max-w-32" value={limit} onChange={(e) => setLimit(Number(e.target.value))}>
          <option value={10}>Letzte 10</option>
          <option value={25}>Letzte 25</option>
          <option value={50}>Letzte 50</option>
          <option value={100}>Letzte 100</option>
        </select>
      </div>
      {isLoading && <div>Lade…</div>}
      <ul className="space-y-2">
        {data?.items?.map((w) => (
          <li key={w.id} className="flex justify-between items-center">
            <div className="flex items-center gap-3">
              {w.poster_url ? (
                <img src={w.poster_url} className="w-8 h-12 object-cover rounded" alt={w.title} />
              ) : null}
              <div>
                <span className="font-medium">{w.title}</span>
                <span className="text-sm text-gray-600 ml-2">
                  {new Date(w.watched_at).toLocaleString()} • gewählt von {w.picker_name}
                </span>
                {w.search_url ? (
                  <a className="underline ml-2 text-sm" href={w.search_url} target="_blank" rel="noreferrer">
                    (Link)
                  </a>
                ) : null}
                {w.is_placeholder ? (
                  <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">Platzhalter</span>
                ) : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={() => openEdit(w)}>
                {w.is_placeholder ? "Titel zuordnen" : "Bearbeiten"}
              </button>
              <button
                className="btn border-red-500 text-red-600"
                onClick={() => {
                  if (confirm("Eintrag wirklich löschen?")) {
                    del.mutate(w.id);
                  }
                }}
              >
                Löschen
              </button>
            </div>
          </li>
        ))}
      </ul>

      {open && current && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="card max-w-xl w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-3">Eintrag bearbeiten</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm">
                <span>Datum</span>
                <input type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} />
              </label>
              <label className="flex flex-col gap-1 text-sm">
                <span>Nutzer ändern (optional)</span>
                <select
                  className="input"
                  value={picker !== null ? String(picker) : ""}
                  onChange={(e) => setPicker(e.target.value ? Number(e.target.value) : null)}
                >
                  <option value="">Keine Änderung</option>
                  {users.data?.items?.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="flex flex-col gap-1 text-sm mt-2">
              <span>Titel</span>
              <input className="input" value={titleVal} onChange={(e) => setTitleVal(e.target.value)} />
            </label>
            <div className="flex items-center gap-2 mt-3">
              <input
                id="change-movie"
                type="checkbox"
                checked={changeMovie}
                onChange={(e) => setChangeMovie(e.target.checked)}
              />
              <label htmlFor="change-movie" className="text-sm">
                Neuen Titel aus Suche übernehmen
              </label>
            </div>
            {changeMovie && (
              <div className="mt-3 space-y-2">
                <div className="grid sm:grid-cols-3 gap-2">
                  <select className="input" value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
                    <option value="title">Titel</option>
                    <option value="actor">Schauspieler</option>
                  </select>
                  <input
                    className="input sm:col-span-2"
                    placeholder="Suchbegriff…"
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                  />
                </div>
                {search.isFetching && <div className="card">Lade…</div>}
                {search.data?.results?.map((m) => {
                  const info = resolveTmdb(m);
                  const link = info.tmdbUrl ?? info.imdbUrl;
                  return (
                    <button
                      key={m.id}
                      className="card flex items-center gap-3 text-left"
                      onClick={() => selectMovie(m)}
                    >
                      {m.poster && (
                        <img src={m.poster} alt={m.title} className="w-12 h-16 object-cover rounded" />
                      )}
                      <div className="flex-1">
                        <div className="font-medium flex items-center gap-2 flex-wrap">
                          <span>
                            {m.title} {m.year ? `(${m.year})` : ""}
                          </span>
                          <span className="text-xs rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                            {kindLabel(info.kind)}
                          </span>
                          <a className="text-xs underline" href={link} target="_blank" rel="noreferrer">
                            TMDb/IMDb
                          </a>
                        </div>
                        <div className="text-xs text-gray-600 line-clamp-2">{m.overview}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button className="btn" onClick={saveMetaOnly} disabled={patch.isPending}>
                Speichern
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
