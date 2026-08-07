const API_TOKEN = import.meta.env.VITE_API_TOKEN;
const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

export const authHeaders = {
  "Content-Type": "application/json",
  "Authorization": `Token ${API_TOKEN}`
};

export async function fetchViolations() {
  const res = await fetch(`${API_BASE}/violations/`, { headers: authHeaders });

  if (!res.ok) throw new Error("Failed to fetch violations");

  const data = await res.json();
  return data.results ?? data;
}