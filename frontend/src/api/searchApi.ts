import api, { unwrap } from "./axios";
import type { SmartSearchResponse } from "../types/search";

export const smartSearch = async (query: string): Promise<SmartSearchResponse> => {
  const response = await api.post<SmartSearchResponse>("/api/search/smart", { query });
  return unwrap(response);
};
