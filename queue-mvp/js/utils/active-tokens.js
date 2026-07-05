const ACTIVE_KEY = "kvt-active-tokens";

export function getActiveTokenIds() {
  try {
    const raw = localStorage.getItem(ACTIVE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addActiveToken(appointmentId) {
  const ids = getActiveTokenIds();
  if (!ids.includes(appointmentId)) {
    ids.unshift(appointmentId);
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids.slice(0, 10)));
  }
}

export function removeActiveToken(appointmentId) {
  const ids = getActiveTokenIds().filter((id) => id !== appointmentId);
  localStorage.setItem(ACTIVE_KEY, JSON.stringify(ids));
}
