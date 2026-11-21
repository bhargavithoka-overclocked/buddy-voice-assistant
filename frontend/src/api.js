async function request(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed (${response.status})`);
  }
  return response.status === 204 ? null : response.json();
}

export const api = {
  listConversations: () => request("/api/conversations"),
  getConversation: (id) => request(`/api/conversations/${id}`),
  renameConversation: (id, title) =>
    request(`/api/conversations/${id}`, { method: "PATCH", body: JSON.stringify({ title }) }),
  deleteConversation: (id) => request(`/api/conversations/${id}`, { method: "DELETE" }),
  getSettings: () => request("/api/settings"),
  testConnection: (provider) => request(`/api/settings/test/${provider}`, { method: "POST" }),
};

export function socketUrl() {
  const protocol = window.location.protocol === "https:" ? "wss" : "ws";
  return `${protocol}://${window.location.host}/ws`;
}
