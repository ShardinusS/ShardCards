// utils.js - Centralized utility functions
export function escapeHtml(text) {
  if (text == null) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function safeImageUrl(url) {
  if (typeof url !== 'string') return '';
  const t = url.trim();
  if (t.startsWith('data:image/')) return t;
  if (/^https?:\/\//i.test(t)) return t;
  return '';
}

export function debounce(fn, delay = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function generateId() {
  return crypto.randomUUID();
}

export function formatDate(timestamp) {
  if (!timestamp) return '';
  return new Date(timestamp).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

export function formatInterval(minutes) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.round(minutes / 60)}h`;
  return `${Math.round(minutes / 1440)} jour${minutes > 1440 ? 's' : ''}`;
}

export function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}