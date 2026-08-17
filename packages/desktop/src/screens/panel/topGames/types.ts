export type TopGameItem = {
  _id?: string;
  Name?: string;
  gameName?: string;
  gameId?: string;
  providerName?: string;
  provider?: { name?: string; id?: string };
  description?: string;
  category?: string;
  subCategory?: string;
  status?: boolean;
  images?: Array<{ type?: string; url?: string }>;
  imagePath?: string;
  createdOn?: string | { $date?: string };
  updatedOn?: string | { $date?: string };
};

export type TopGamesDoc = {
  _id?: string;
  percent?: number;
  startAmount?: number;
  endAmount?: number;
  status?: boolean;
  type?: string;
  data?: Record<string, TopGameItem[]>;
};

export type GameRow = TopGameItem & {
  _categoryKey: string;
  _position: number;
};

export type DeleteTarget = {
  category: string;
  position: number;
  name: string;
};

export type StatusTarget = {
  /** Omitted when updating from the All filter (updates across categories). */
  category?: string;
  gameId: string;
  status: boolean;
  name: string;
};

export type AddGameByIdPayload = {
  gameId: string;
  providerName: string;
  category: string;
  position: number;
};

export type AddGameDetailsPayload = AddGameByIdPayload & {
  gameName: string;
  imagePath: string;
};

export type AddGameObjectPayload = {
  category: string;
  position: number;
  game: TopGameItem & Record<string, unknown>;
};

export type CatalogGame = {
  gameId: string;
  gameName: string;
  providerName: string;
};
