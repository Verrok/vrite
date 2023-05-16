const navigateAndReload = (path: string): void => {
  window.location.replace(path);
};
const escapeHTML = (input: string): string => {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

export { navigateAndReload, escapeHTML };