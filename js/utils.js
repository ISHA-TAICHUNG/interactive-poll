// ============================================================
//  Shared Utilities — 所有頁面共用的工具函式
// ============================================================

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function showToast(message, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3000);
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str || ''));
  return d.innerHTML;
}
