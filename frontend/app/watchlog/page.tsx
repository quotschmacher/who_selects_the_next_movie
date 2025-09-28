"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useState } from "react";

export default function WatchlogPage() {
  const [limit, setLimit] = useState(25);
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["watchlog", limit], queryFn: () => api.get(`/watchlog?limit=${limit}`) });
  const users = useQuery({ queryKey: ["users"], queryFn: () => api.get("/users") });

  const [open, setOpen] = useState(false);
  const [current, setCurrent] = useState(null);
  const [date, setDate] = useState("");
  const [picker, setPicker] = useState("");
  const [titleVal, setTitleVal] = useState("");
  const [changeMovie, setChangeMovie] = useState(false);
  const [mode, setMode] = useState("title");
  const [q, setQ] = useState("");
  const search = useQuery({
    queryKey: ["search-edit", q, mode],
    queryFn: () => api.get(`/movies/search2?q=${encodeURIComponent(q)}&mode=${mode}`),
    enabled: changeMovie && q.length > 1,
  });

  const patch = useMutation({
    mutationFn: (payload) => api.patch(`/watchevents/${current.id}`, payload),
    onSuccess: () => { setOpen(false); qc.invalidateQueries({ queryKey: ["watchlog"]}); qc.invalidateQueries({ queryKey: ["last5"]}); }
  });

  const del = useMutation({
    mutationFn: (id) => api.del(`/watchevents/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["watchlog"]}); qc.invalidateQueries({ queryKey: ["last5"]}); }
  });

  function openEdit(item){
    setCurrent(item);
    setDate(item.watched_at?.slice(0,10) || new Date().toISOString().slice(0,10));
    setPicker("");
    setTitleVal(item.title || "");
    setChangeMovie(item.is_placeholder || false);
    setQ("");
    setOpen(true);
  }

  function selectMovie(m){
    const imdbSearch = `https://www.imdb.com/find/?q=${encodeURIComponent(m.title)}`;
    const tmdbLink = String(m.id).startsWith("tmdb:") ? `https://www.themoviedb.org/movie/${String(m.id).split(":")[1]}` : null;
    const searchUrl = tmdbLink || imdbSearch;
    patch.mutate({
      watched_at: new Date(date + "T00:00:00").toISOString(),
      ...(picker ? { picker_user_id: picker } : {}),
      movie_id: m.id, title: m.title, search_url: searchUrl, poster_url: m.poster || null,
    });
  }

  function saveMetaOnly(){
    patch.mutate({
      watched_at: new Date(date + "T00:00:00").toISOString(),
      ...(picker ? { picker_user_id: picker } : {}),
      ...(titleVal ? { title: titleVal } : {}),
    });
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold">Zuletzt geschaut</h1>
        <select className="input max-w-32" value={limit} onChange={(e)=>setLimit(Number(e.target.value))}>
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
              {w.poster_url ? (<img src={w.poster_url} className="w-8 h-12 object-cover rounded" alt={w.title} />) : null}
              <div>
                <span className="font-medium">{w.title}</span>
                <span className="text-sm text-gray-600 ml-2">{new Date(w.watched_at).toLocaleString()} • gewählt von {w.picker_name}</span>
                {w.search_url ? (<a className='underline ml-2 text-sm' href={w.search_url} target='_blank' rel='noreferrer'>(Link)</a>) : null}
                {w.is_placeholder ? <span className="ml-2 text-xs px-2 py-0.5 rounded bg-yellow-100 text-yellow-800">Platzhalter</span> : null}
              </div>
            </div>
            <div className="flex gap-2">
              <button className="btn" onClick={()=>openEdit(w)}>{w.is_placeholder ? "Film zuordnen" : "Bearbeiten"}</button>
              <button className="btn border-red-500 text-red-600" onClick={()=>{ if (confirm("Eintrag wirklich löschen?")) del.mutate(w.id); }}>Löschen</button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
