// Mirrors the resource shapes in API_DESIGN.md.

export interface Collection {
  id: string;
  name: string;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}

export interface Bookmark {
  id: string;
  url: string;
  title: string;
  notes: string | null;
  collectionId: string | null;
  ownerId: string;
  createdAt: string;
  updatedAt: string;
}
