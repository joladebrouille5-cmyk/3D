// Sauvegardes locales (navigateur / WebView Android) : trois emplacements.
import { SAVE_VERSION, summary } from './career.js';

const KEY = 'generation-football.saves.v1';
export const SLOTS = [1, 2, 3];

function readAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function writeAll(all) {
  try { localStorage.setItem(KEY, JSON.stringify(all)); return true; } catch { return false; }
}

export function listSaves() {
  const all = readAll();
  return SLOTS.map((slot) => {
    const s = all[slot];
    if (!s) return { slot, empty: true };
    try { return { slot, savedAt: s.savedAt, ...summary(s.state) }; } catch { return { slot, corrupt: true }; }
  });
}
export const hasSaves = () => listSaves().some((s) => !s.empty && !s.corrupt);

export function saveCareer(slot, state) {
  const all = readAll();
  all[slot] = { savedAt: Date.now(), version: SAVE_VERSION, state };
  return writeAll(all);
}

export function loadCareer(slot) {
  const s = readAll()[slot];
  if (!s) return null;
  if (s.version !== SAVE_VERSION) throw new Error('Sauvegarde d\'une version incompatible.');
  return s.state;
}

export function deleteSave(slot) {
  const all = readAll();
  delete all[slot];
  writeAll(all);
}

export function firstFreeSlot() { return listSaves().find((s) => s.empty)?.slot ?? null; }

// ------------------------------------------------------------------ fichier de sauvegarde
// Export : un fichier JSON lisible, à garder hors du téléphone (réinstallation, nouveau téléphone).
export function exportCareer(slot) {
  const s = readAll()[slot];
  if (!s) throw new Error('Emplacement vide.');
  const sum = summary(s.state);
  const name = `generation-football-${String(sum.name ?? 'carriere').normalize('NFKD').replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase()}-${sum.season ?? ''}.json`;
  return { name, text: JSON.stringify({ app: 'generation-football', kind: 'career', version: s.version, savedAt: s.savedAt, state: s.state }) };
}

// Import : vérifie le fichier puis l'écrit dans l'emplacement choisi
export function importCareer(text, slot) {
  let d;
  try { d = JSON.parse(text); } catch { throw new Error('Ce fichier n\'est pas une sauvegarde lisible.'); }
  if (!d || d.app !== 'generation-football' || d.kind !== 'career' || !d.state) throw new Error('Ce fichier n\'est pas une sauvegarde de Génération Football.');
  if (d.version !== SAVE_VERSION) throw new Error('Sauvegarde d\'une version incompatible.');
  summary(d.state); // lève une erreur si l'état est illisible
  const all = readAll();
  all[slot] = { savedAt: Date.now(), version: d.version, state: d.state };
  if (!writeAll(all)) throw new Error('Stockage plein : supprime une sauvegarde puis recommence.');
  return summary(d.state);
}
