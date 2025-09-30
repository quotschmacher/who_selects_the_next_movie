"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type {
  WatchlogResponse,
  WatchlogItem,
  UsersResponse,
  SearchResponse,
  SearchResult,
} from "@/lib/types";

type UpdateWatchEventPayload = {
  watched_at?: string;
  picker_user_id?: number;
  title?: string;
  search_url?: string | null;
  poster_url?: string | null;
  movie_id?: string | number;
};

export default function WatchlogPage() {
  const [limit, setLimit] = useState(25);
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<WatchlogResponse>({
    queryKey: ["watchlog", limit],
    queryFn: async () => api.get(`/watchlog?limit=${limit}`) as Promise<WatchlogResponse>,
  });

  const users = useQuery<UsersResponse>({
    queryKey: ["users"],
    queryFn: async () => api.get("/users") as Promise<UsersResponse>,
  });

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState<WatchlogItem | null>(null);
  const [date, setDate] = useState("");
  const [picker, setPicker] = useState<number | null>(null);
  const [titleVal, setTitleVal] = useState("");
  const [changeMovie, setChangeMovie] = useState(false);
  const [mode, setMode] = useState("title");
  const [q, setQ] = useState("");

  const search = useQuery<SearchResponse>({
    queryKey: ["search-edit", q, mode],
    queryFn: async () =>
      api.get(`/movies/search2?q=${encodeURIComponent(q)}&mode=${mode}`) as Promise<SearchResponse>,
    enabled: changeMovie && q.length > 1,
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
    setDate(item.watched_at?.slice(0, 10) || new Date().toISOString().slice(0, 10));
    setPicker(null);
    setTitleVal(item.title || "");
    setChangeMovie(item.is_placeholder || false);
    setQ("");
    setOpen(true);
  }

  function selectMovie(movie: SearchResult) {
    if (!current) return;
    const imdbSearch = `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}`;
    const tmdbLink = String(movie.id).startsWith("tmdb:")
      ? `https://www.themoviedb.org/movie/${String(movie.id).split(":")[1]}`
      : null;
    const searchUrl = tmdbLink || imdbSearch;
    patch.mutate({
      eventId: current.id,
      payload: {
        watched_at: new Date(`${date}T00:00:00`).toISOString(),
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
        watched_at: new Date(`${date}T00:00:00`).toISOString(),
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
                {w.is_placeholder ? "Film zuordnen" : "Bearbeiten"}
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
    </div>
  );
}

