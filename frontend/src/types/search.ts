export interface Trip {
  _id: string;
  title: string;
  content: string;
  images: string[];
  userId: string;
  score?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface SmartSearchResponse {
  answer: string;
  sources: Trip[];
}
