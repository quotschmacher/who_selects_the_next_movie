"use client";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, type DropResult } from "@hello-pangea/dnd";
import { api } from "@/lib/api";
import type { User, UsersResponse } from "@/lib/types";

function reorder(list: User[], startIndex: number, endIndex: number): User[] {
  const result = Array.from(list);
  const [removed] = result.splice(startIndex, 1);
  result.splice(endIndex, 0, removed);
  return result;
}

type CreateUserPayload = {
  name: string;
  email: string | null;
  avatar_url: string | null;
};

type UpdateUserPayload = {
  id: number;
  data: Partial<CreateUserPayload>;
};

export default function UsersPage() {
  const qc = useQueryClient();

  const usersQ = useQuery<UsersResponse>({
    queryKey: ["users"],
    queryFn: async () => api.get("/users") as Promise<UsersResponse>,
  });

  const [list, setList] = useState<User[]>([]);

  useEffect(() => {
    if (usersQ.data?.items) {
      setList(usersQ.data.items);
    }
  }, [usersQ.data?.items]);

  const onDragEnd = (result: DropResult) => {
    const destination = result.destination;
    if (!destination) return;
    if (destination.index === result.source.index) return;
    setList((prev) => reorder(prev, result.source.index, destination.index));
  };

  const save = useMutation({
    mutationFn: async () => api.post("/users/reorder", { order: list.map((u) => u.id) }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["next"] });
    },
  });

  const add = useMutation({
    mutationFn: async (payload: CreateUserPayload) => api.post("/users", payload),
    onSuccess: () => {
      setName("");
      setEmail("");
      setAvatar("");
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["next"] });
    },
  });

  const patch = useMutation({
    mutationFn: async ({ id, data }: UpdateUserPayload) => api.patch(`/users/${id}`, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["users"] }),
  });

  const del = useMutation({
    mutationFn: async (id: number) => api.del(`/users/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["users"] });
      qc.invalidateQueries({ queryKey: ["next"] });
    },
  });

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [avatar, setAvatar] = useState("");

  async function uploadAvatar(file: File): Promise<string> {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch(
      (process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000") + "/upload/avatar",
      { method: "POST", body: fd },
    );
    const data = await res.json();
    if (!res.ok) throw new Error(data?.detail || "upload failed");
    return data.url as string;
  }

  return (
    <div className="space-y-4">
      <div className="card">
        <h1 className="text-xl font-semibold mb-3">Nutzer</h1>
        <div className="grid sm:grid-cols-4 gap-2">
          <input className="input" placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <input
            className="input"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            className="input"
            placeholder="Avatar-URL (optional)"
            value={avatar}
            onChange={(e) => setAvatar(e.target.value)}
          />
          <button
            className="btn"
            onClick={() => add.mutate({ name, email: email || null, avatar_url: avatar || null })}
            disabled={!name.trim()}
          >
            Hinzufügen
          </button>
        </div>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Rotationsreihenfolge (Drag & Drop)</h2>
        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="users">
            {(provided) => (
              <ul className="space-y-2" ref={provided.innerRef} {...provided.droppableProps}>
                {list.map((u, i) => (
                  <Draggable key={u.id} draggableId={String(u.id)} index={i}>
                    {(prov) => (
                      <li
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        className="flex items-center justify-between p-3 border rounded-xl bg-white"
                      >
                        <div className="flex items-center gap-3">
                          {u.avatar_url ? (
                            <img src={u.avatar_url} alt={u.name} className="w-8 h-8 rounded-full object-cover" />
                          ) : (
                            <div className="w-8 h-8 rounded-full bg-gray-200" />
                          )}
                          <div>
                            <div className="font-medium">{u.name}</div>
                            <div className="text-xs text-gray-500">{u.email || ""}</div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <button
                            className="btn"
                            onClick={() => {
                              const input = document.getElementById(`file-${u.id}`) as HTMLInputElement | null;
                              input?.click();
                            }}
                          >
                            Avatar
                          </button>
                          <input
                            id={`file-${u.id}`}
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={async (e) => {
                              const file = e.target.files?.[0];
                              if (!file) return;
                              const url = await uploadAvatar(file);
                              patch.mutate({ id: u.id, data: { avatar_url: url } });
                            }}
                          />
                          <button className="btn" onClick={() => del.mutate(u.id)}>
                            Löschen
                          </button>
                        </div>
                      </li>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </ul>
            )}
          </Droppable>
        </DragDropContext>
        <div className="mt-3">
          <button className="btn" onClick={() => save.mutate()}>
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

