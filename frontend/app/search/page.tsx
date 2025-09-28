"use client";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [mode, setMode] = useState("title");
  const qc = useQueryClient();
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users") });
  const nextTurn = useQuery({ queryKey: ["next"], queryFn: () => api.get("/rotation/next") });

  const search = useQuery({
    queryKey: ["search", q, mode],
    queryFn: () => api.get(`/movies/search2?q=${encodeURIComponent(q)}&mode=${mode}`),
    enabled: q.length > 1,
  });

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState(null);
  const [picker, setPicker] = useState("");
  const [date, setDate] = useState(new Date().toISOString().slice(0,10));

  const selectMutation = useMutation({
    mutationFn: (movie) => api.post(`/movies/select`, {
      movie_id: movie.id,
      title: movie.title,
      picker_user_id: picker,
      watched_at: new Date(date + "T00:00:00").toISOString(),
      search_url: (String(movie.id).startsWith("tmdb:")
        ? `https://www.themoviedb.org/movie/${String(movie.id).split(":")[1]}`
        : `https://www.imdb.com/find/?q=${encodeURIComponent(movie.title)}`),
      poster_url: movie.poster || null,
    }),
    onSuccess: () => {
      setOpen(false);
      setSelected(null);
      setPicker("");
      setTimeout(()=>{
        qc.invalidateQueries({ queryKey: ["watchlog"] });
        qc.invalidateQueries({ queryKey: ["next"] });
        qc.invalidateQueries({ queryKey: ["last5"] });
      }, 50);
    }
  });

  function handleOpen(m){
    setSelected(m);
    const def = nextTurn.data?.next?.id;
    setPicker(def || "");
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold mb-3">Filmsuche</h1>
        <div className="grid sm:grid-cols-4 gap-2">
          <select className="input" value={mode} onChange={(e)=>setMode(e.target.value)}>
            <option value="title">Titel</option>
            <option value="actor">Schauspieler</option>
          </select>
          <input className="input sm:col-span-3" placeholder="Suchbegriff…" value={q} onChange={(e)=>setQ(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-3">
        {search.isFetching && <div className="card">Lade…</div>}
        {search.data?.results?.map((m) => {
          const imdbSearch = `https://www.imdb.com/find/?q=${encodeURIComponent(m.title)}`;
          const tmdbLink = String(m.id).startsWith("tmdb:") ? `https://www.themoviedb.org/movie/${String(m.id).split(":")[1]}` : null;
          const searchUrl = tmdbLink || imdbSearch;
          return (
            <button key={m.id} className="card flex items-center gap-4 text-left" onClick={()=>handleOpen(m)}>
              {m.poster && <img src={m.poster} alt={m.title} className="w-16 h-24 object-cover rounded" />}
              <div className="flex-1">
                <div className="font-medium flex items-center gap-2">
                  <span>{m.title} {m.year ? `(${m.year})` : ""}</span>
                  <a href={searchUrl} target="_blank" rel="noreferrer" className="text-xs underline" onClick={(e)=>e.stopPropagation()}>TMDb/IMDb</a>
                </div>
                <div className="text-sm text-gray-600 line-clamp-2">{m.overview}</div>
              </div>
              <span className="btn">Auswählen</span>
            </button>
          )
        })}
      </div>

      {open && selected && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4" onClick={()=>setOpen(false)}>
          <div className="card max-w-lg w-full" onClick={(e)=>e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-2">Film zuordnen</h2>
            <div className="flex gap-3">
              {selected.poster && <img src={selected.poster} alt={selected.title} className="w-20 h-28 object-cover rounded" />}
              <div className="flex-1">
                <div className="font-medium">{selected.title}</div>
                <div className="text-xs text-gray-600 mb-2">{selected.overview}</div>
                <div className="grid sm:grid-cols-2 gap-2">
                  <select className="input" value={picker} onChange={(e)=>setPicker(e.target.value ? Number(e.target.value) : "")} required>
                    <option value="">Nutzer wählen…</option>
                    {users.data?.items?.map((u)=>(<option key={u.id} value={u.id}>{u.name}</option>))}
                  </select>
                  <input type="date" className="input" value={date} onChange={(e)=>setDate(e.target.value)} />
                </div>
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={()=>setOpen(false)}>Abbrechen</button>
              <button className="btn" disabled={!picker} onClick={()=>selectMutation.mutate(selected)}>Bestätigen</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
