// Decode JWT to extract userId
export const decodeToken = (token: string): { userId: string } | null => {
  try {
    const payload = token.split('.')[1];
    const decoded = JSON.parse(atob(payload));
    return { userId: decoded.userId };
  } catch {
    return null;
  }
};
