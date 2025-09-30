export type NextRotationUser = {
  id: number;
  name: string;
  avatar_url: string | null;
};

export type RotationNextResponse = {
  next: NextRotationUser | null;
};

export type WatchlogItem = {
  id: number;
  title: string;
  movie_id: string;
  watched_at: string;
  picker_name: string;
  search_url: string | null;
  poster_url: string | null;
  is_placeholder: boolean;
};

export type WatchlogResponse = {
  items: WatchlogItem[];
};

export type User = {
  id: number;
  name: string;
  email: string | null;
  avatar_url: string | null;
  position: number;
  created_at: string;
};

export type UsersResponse = {
  items: User[];
};

export type SearchResult = {
  id: string | number;
  title: string;
  year?: string | number | null;
  overview: string;
  poster: string | null;
};

export type SearchResponse = {
  results: SearchResult[];
};
