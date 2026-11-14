// Saved progress: coins, upgrades, best results, chosen level. Kept in the browser.
// localStorage can be blocked, so the save is mirrored in window.name, which survives a reload of the same tab.
const KEY = 'powderline-save-v1';
const fresh = () => ({ coins: 0, up: {}, best: {}, level: 'norway', autostart: false });
function load() {
  try { const s = localStorage.getItem(KEY); if (s) return { ...fresh(), ...JSON.parse(s) }; } catch (e) { /* blocked */ }
  try { if (window.name && window.name.startsWith('{"pl":')) return { ...fresh(), ...JSON.parse(window.name).pl }; } catch (e) { /* not ours */ }
  return fresh();
}
export const save = load();
export function persist() {
  const s = JSON.stringify(save);
  try { localStorage.setItem(KEY, s); } catch (e) { /* blocked */ }
  try { window.name = `{"pl":${s}}`; } catch (e) { /* ignore */ }
}
export const upLevel = (id) => save.up[id] || 0;
