"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { RotationNextResponse, UsersResponse, SearchResponse, SearchResult } from "@/lib/types";

type SearchMode = "title" | "actor";
type SearchKind = "movie" | "tv";

type SelectMovieInput = {
  movie: SearchResult;
  pickerId: number;
  watchedDate: string;
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

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [mode, setMode] = useState<SearchMode>("title");
  const qc = useQueryClient();

  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQ(q), 300);
    return () => clearTimeout(handle);
  }, [q]);

  const users = useQuery<UsersResponse>({
    queryKey: ["users"],
    queryFn: () => api.get<UsersResponse>("/users"),
  });

  const nextTurn = useQuery<RotationNextResponse>({
    queryKey: ["next"],
    queryFn: () => api.get<RotationNextResponse>("/rotation/next"),
  });

  const search = useQuery<SearchResponse>({
    queryKey: ["search", debouncedQ, mode],
    queryFn: () => api.get<SearchResponse>(`/movies/search2?q=${encodeURIComponent(debouncedQ)}&mode=${mode}`),
    enabled: debouncedQ.length > 1,
  });

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(null);
  const [picker, setPicker] = useState<number | null>(null);
  const [date, setDate] = useState(() => localDateString());

  const selectMutation = useMutation({
    mutationFn: async ({ movie, pickerId, watchedDate }: SelectMovieInput) => {
      const info = resolveTmdb(movie);
      const searchUrl = info.tmdbUrl ?? info.imdbUrl;

      return api.post("/movies/select", {
        movie_id: movie.id,
        title: movie.title,
        picker_user_id: pickerId,
        watched_at: watchedDate,
        search_url: searchUrl,
        poster_url: movie.poster || null,
      });
    },
    onSuccess: () => {
      setOpen(false);
      setSelected(null);
      setPicker(null);
      setTimeout(() => {
        qc.invalidateQueries({ queryKey: ["watchlog"] });
        qc.invalidateQueries({ queryKey: ["next"] });
        qc.invalidateQueries({ queryKey: ["last5"] });
      }, 50);
    },
  });

  function handleOpen(movie: SearchResult) {
    setSelected(movie);
    const def = nextTurn.data?.next?.id ?? null;
    setPicker(def);
    setOpen(true);
  }

  const selectedInfo = selected ? resolveTmdb(selected) : null;

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold mb-3">Filmsuche</h1>
        <div className="grid sm:grid-cols-4 gap-2">
          <select className="input" value={mode} onChange={(e) => setMode(e.target.value as SearchMode)}>
            <option value="title">Titel</option>
            <option value="actor">Schauspieler</option>
          </select>
          <input
            className="input sm:col-span-3"
            placeholder="Suchbegriff…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
      </div>
      <div className="grid gap-3">
        {search.isFetching && <div className="card">Lade…</div>}
        {search.data?.results?.map((m) => {
          const info = resolveTmdb(m);
          const searchUrl = info.tmdbUrl ?? info.imdbUrl;
          return (
            <button
              key={m.id}
              className="card flex items-center gap-4 text-left"
              onClick={() => handleOpen(m)}
            >
              {m.poster && (
                <img src={m.poster} alt={m.title} className="w-16 h-24 object-cover rounded" />
              )}
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span>
                    {m.title} {m.year ? `(${m.year})` : ""}
                  </span>
                  <span className="text-xs rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                    {kindLabel(info.kind)}
                  </span>
                  <a
                    href={searchUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs underline"
                    onClick={(e) => e.stopPropagation()}
                  >
                    TMDb/IMDb
                  </a>
                </div>
                <div className="text-sm text-gray-600 line-clamp-2">{m.overview}</div>
              </div>
              <span className="btn">Auswählen</span>
            </button>
          );
        })}
      </div>

      {open && selected && selectedInfo && (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center p-4"
          onClick={() => setOpen(false)}
        >
          <div className="card max-w-lg w-full" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Titel zuordnen</h2>
            <div className="flex gap-3">
              {selected.poster && (
                <img
                  src={selected.poster}
                  alt={selected.title}
                  className="w-20 h-28 object-cover rounded"
                />
              )}
              <div className="flex-1">
                <div className="font-medium">{selected.title}</div>
                <div className="flex items-center gap-2 text-xs text-gray-600 mt-1 mb-2">
                  <span className="inline-flex rounded bg-slate-100 px-2 py-0.5 text-slate-700">
                    {kindLabel(selectedInfo.kind)}
                  </span>
                  {selected.year ? <span>{selected.year}</span> : null}
                </div>
                <div className="text-xs text-gray-600 mb-2">{selected.overview}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <select
                    className="input"
                    value={picker !== null ? String(picker) : ""}
                    onChange={(e) => setPicker(e.target.value ? Number(e.target.value) : null)}
                    required
                  >
                    <option value="">Nutzer wählen…</option>
                    {users.data?.items?.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                  <input
                    type="date"
                    className="input"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setOpen(false)}>
                Abbrechen
              </button>
              <button
                className="btn"
                disabled={picker === null || selectMutation.isPending}
                onClick={() => {
                  if (!selected || picker === null) {
                    return;
                  }
                  selectMutation.mutate({ movie: selected, pickerId: picker, watchedDate: date });
                }}
              >
                Bestätigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
