export interface TripComment {
  userId: string;
  username: string;
  text: string;
  createdAt: string;
}

export interface Trip {
  _id: string;
  title: string;
  content: string;
  images: string[];
  userId: string;
  score?: number;
  likes: string[];
  comments: TripComment[];
  createdAt?: string;
  updatedAt?: string;
}

export interface SmartSearchResponse {
  answer: string;
  sources: Trip[];
}
