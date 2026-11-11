// Icônes au trait (24 × 24, couleur du texte). Remplacent les emojis, dont le rendu varie selon l'appareil.
const P = {
  // navigation et match
  play: '<path d="M8 5.5v13l10.5-6.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/><rect x="13.9" y="5" width="3.6" height="14" rx="1" fill="currentColor" stroke="none"/>',
  skip: '<path d="M5 6l7 6-7 6zM12 6l7 6-7 6z" fill="currentColor" stroke="none"/>',
  replay: '<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4 4.5v3.8h3.8"/>',
  squad: '<circle cx="9" cy="8" r="3.2"/><path d="M3.5 19c.6-3.4 2.8-5.2 5.5-5.2s4.9 1.8 5.5 5.2"/><circle cx="16.6" cy="9" r="2.5"/><path d="M15.5 13.9c2.6-.2 4.5 1.4 5 4.6"/>',
  board: '<rect x="4" y="3.5" width="16" height="17" rx="2"/><path d="M9 3.5v2h6v-2"/><path d="M8 11l2 2 4-4"/><path d="M8 16.5h8"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
  auto: '<rect x="5" y="8" width="14" height="10" rx="3"/><path d="M12 8V5"/><circle cx="12" cy="4.2" r="1"/><circle cx="9.3" cy="13" r="1.1" fill="currentColor"/><circle cx="14.7" cy="13" r="1.1" fill="currentColor"/>',
  zoom: '<circle cx="10.5" cy="10.5" r="6"/><path d="M15 15l5 5"/><path d="M8 10.5h5M10.5 8v5"/>',
  help: '<circle cx="12" cy="12" r="8.5"/><path d="M9.6 9.6a2.5 2.5 0 1 1 3.3 2.4c-.6.3-.9.8-.9 1.5v.6"/><circle cx="12" cy="16.9" r=".9" fill="currentColor"/>',
  live: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M7.4 7.4a6.5 6.5 0 0 0 0 9.2M16.6 7.4a6.5 6.5 0 0 1 0 9.2"/>',
  save: '<path d="M5 4h11l3 3v13H5z"/><path d="M8 4v5h7V4"/><rect x="8" y="13" width="8" height="5" rx="1"/>',
  home: '<path d="M4 11.5L12 5l8 6.5"/><path d="M6.5 10v9.5h11V10"/><path d="M10 19.5v-5h4v5"/>',
  back: '<path d="M14.5 6l-6 6 6 6"/>',
  next: '<path d="M9.5 6l6 6-6 6"/>',
  chart: '<path d="M4 19.5h16"/><rect x="5.5" y="11" width="3" height="6.5" rx=".6"/><rect x="10.5" y="7" width="3" height="10.5" rx=".6"/><rect x="15.5" y="13" width="3" height="4.5" rx=".6"/>',
  folder: '<path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2h7a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2z"/>',
  ball: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.6l3.2 2.3-1.2 3.8h-4l-1.2-3.8z" fill="currentColor" stroke="none"/><path d="M12 3.5v4.1M15.2 9.9l4-1.3M14 13.7l2.4 3.4M10 13.7l-2.4 3.4M8.8 9.9l-4-1.3"/>',
  whistle: '<path d="M3.5 11.5a4.5 4.5 0 1 0 9 0V9.5h8V6.5H8a4.5 4.5 0 0 0-4.5 5z"/><circle cx="8" cy="11.5" r="1.4" fill="currentColor"/>',
  stadium: '<path d="M2.5 10c3-2 6.2-3 9.5-3s6.5 1 9.5 3v7c-3 1.8-6.2 2.7-9.5 2.7S5.5 18.8 2.5 17z"/><path d="M6.5 12.2c1.8-.8 3.6-1.2 5.5-1.2s3.7.4 5.5 1.2"/><path d="M5 4v4M19 4v4"/>',
  swap: '<path d="M5 8h13l-3.5-3.5"/><path d="M19 16H6l3.5 3.5"/>',
  // entraînement
  technique: '<circle cx="8.5" cy="14.5" r="4.5"/><path d="M8.5 11.3l2 1.5-.8 2.4H7.3l-.8-2.4z" fill="currentColor" stroke="none"/><path d="M15 19.5l2.5-11 2.5 11z"/><path d="M15.6 16.5h3.8"/>',
  physique: '<path d="M13 2.5L5.5 13.5h5.5l-1.5 8 8-11.5h-5.5z"/>',
  tactique: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M6.5 8l2.5 2.5M9 8l-2.5 2.5"/><circle cx="16.5" cy="15.5" r="2"/><path d="M9 14.5c2-2.5 4-3.5 6-4" stroke-dasharray="1.6 1.8"/><path d="M13.6 9.6l1.6.9-.9 1.5"/>',
  finition: '<path d="M3 18.5V7h18v11.5"/><path d="M3 11h18M3 15h18M8 7v11.5M13 7v11.5M18 7v11.5" stroke-width="1" opacity=".55"/><circle cx="15.5" cy="12.8" r="2.6" fill="currentColor" stroke="none"/>',
  defense: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.9-7.5-9.5V6z"/><path d="M9 12l2.2 2.2 4-4.4"/>',
  gardien: '<path d="M7 20.5v-6.5L4.5 9.5a1.4 1.4 0 0 1 2.4-1.4L9 11V4.8a1.4 1.4 0 0 1 2.8 0V10V3.9a1.4 1.4 0 0 1 2.8 0V10V5.2a1.4 1.4 0 0 1 2.8 0V14c0 3.2-1.4 5-3.4 6.5z"/>',
  recuperation: '<path d="M12 3v18M4.2 7.5l15.6 9M19.8 7.5l-15.6 9"/><path d="M9.6 4.6L12 6.4l2.4-1.8M9.6 19.4L12 17.6l2.4 1.8"/>',
  // hors du terrain
  ecole: '<path d="M2.5 9L12 4.5 21.5 9 12 13.5z"/><path d="M6.5 11v5c1.6 1.4 3.4 2 5.5 2s3.9-.6 5.5-2v-5"/><path d="M21.5 9v5"/>',
  video: '<rect x="3" y="5" width="18" height="12.5" rx="2"/><path d="M10 8.6v5.4l4.6-2.7z" fill="currentColor" stroke="none"/><path d="M8 20.5h8"/>',
  extra: '<path d="M6.5 8v8M17.5 8v8M3.5 10v4M20.5 10v4M6.5 12h11"/>',
  repos: '<path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10z"/>',
  sortie: '<path d="M9 18.5V6l10-2v12.5"/><circle cx="6.8" cy="18.5" r="2.2"/><circle cx="16.8" cy="16.5" r="2.2"/>',
  // choix en match
  shoot: '<path d="M3 18.5V7h18v11.5"/><path d="M3 11h18M8 7v11.5M13 7v11.5M18 7v11.5" stroke-width="1" opacity=".5"/><path d="M5 20l6.5-6.5" /><circle cx="13.6" cy="11.4" r="2" fill="currentColor" stroke="none"/>',
  through: '<path d="M4 18l5-5 3.5 3.5L20 6"/><path d="M14.5 6H20v5.5"/>',
  cross: '<path d="M4 19c3-9 9-13 16-13"/><path d="M15.5 4.5L20 6l-1.8 4.2"/>',
  forward: '<path d="M12 20V5"/><path d="M6.5 10.5L12 5l5.5 5.5"/>',
  safe: '<path d="M5 9h12l-3-3"/><path d="M19 15H7l3 3"/>',
  dribble: '<path d="M4 17c2.5 0 3-4.5 5.5-4.5s3 4.5 5.5 4.5 2.5-4.5 5-4.5"/><circle cx="18.5" cy="6.5" r="2.2"/>',
  turn: '<path d="M18 7.5H9a4.5 4.5 0 0 0 0 9h6"/><path d="M14.5 4l3.5 3.5-3.5 3.5"/>',
  shield: '<path d="M12 3l7.5 3v5.5c0 4.6-3.2 8.1-7.5 9.5-4.3-1.4-7.5-4.9-7.5-9.5V6z"/>',
  tackle: '<path d="M4 15.5h7.5l6.5 3"/><path d="M8.5 15.5l2.5-6 3 1.5"/><circle cx="18.5" cy="12.5" r="2.4"/>',
  press: '<path d="M4.5 12h11"/><path d="M11.5 7.5L16 12l-4.5 4.5"/><path d="M19.5 6v12"/>',
  cut: '<path d="M4 6l16 12"/><path d="M4 18l6.5-4.9" stroke-dasharray="2 2.2"/><path d="M13.5 10.9L20 6" stroke-dasharray="2 2.2"/>',
  pin: '<path d="M12 21s-6-5.6-6-10.5a6 6 0 0 1 12 0C18 15.4 12 21 12 21z"/><circle cx="12" cy="10.5" r="2.2"/>',
  run: '<path d="M3.5 16h5M2.5 12h4M4.5 8h4"/><path d="M11 18.5l2.5-5-3-2.5 3.5-4 3 2.5h3"/><circle cx="17" cy="4.5" r="1.8"/>',
  call: '<path d="M8 11V5.5a1.5 1.5 0 0 1 3 0V10V4a1.5 1.5 0 0 1 3 0v6V5.5a1.5 1.5 0 0 1 3 0V14c0 4-2.3 6.5-5.5 6.5-2.6 0-3.9-1.3-5.4-3.7L4.7 13.3a1.5 1.5 0 0 1 2.5-1.6z"/>',
  support: '<circle cx="7" cy="16" r="2.4"/><circle cx="17" cy="8" r="2.4"/><path d="M9 14l6-4" stroke-dasharray="2 2"/>',
  injury: '<rect x="3.5" y="8.5" width="17" height="7" rx="3.5" transform="rotate(-35 12 12)"/><path d="M10.5 10.5l3 3M13.5 10.5l-3 3"/>',
  star: '<path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.8z"/>',
  trophy: '<path d="M7.5 4.5h9v4a4.5 4.5 0 0 1-9 0z"/><path d="M7.5 6H4.5c0 2.6 1.4 4 3.4 4.3M16.5 6h3c0 2.6-1.4 4-3.4 4.3"/><path d="M12 13v4M8.5 20h7M9.5 17h5"/>',
  chat: '<path d="M4.5 5.5h15v10h-8l-4.5 3.5v-3.5H4.5z"/>',
  calendar: '<rect x="4" y="5.5" width="16" height="14" rx="2"/><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4"/>',
};

export function icon(name, size = 20, cls = '') {
  const body = P[name] ?? P.ball;
  return `<svg class="ico-svg ${cls}" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export const ICONS = Object.keys(P);
