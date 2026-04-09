const API_BASE = import.meta.env.VITE_API_URL ?? "";

export async function getSignedUrl(): Promise<string> {
  const res = await fetch(`${API_BASE}/api/elevenlabs/token`);
  if (!res.ok) throw new Error("Failed to get signed URL");
  const data = await res.json();
  return data.signedUrl;
}
