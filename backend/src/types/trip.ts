export interface Trip {
  _id: string;
  title: string;
  content: string;
  images: string[];
  userId: string;
  vector?: number[];
  score?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SmartSearchRequest {
  query: string;
}

export interface SmartSearchResponse {
  answer: string;
  sources: Trip[];
}
