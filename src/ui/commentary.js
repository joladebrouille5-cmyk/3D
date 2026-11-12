// Commentaire audio : les temps forts du match lus à voix haute, en français.
// Application Android : synthèse vocale du téléphone (pont GFAndroid.speak) ; navigateur : speechSynthesis.
const KEY = 'generation-football.commentary';
export function commentaryOn() { try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; } }
export function setCommentary(on) { try { localStorage.setItem(KEY, on ? 'on' : 'off'); } catch { /* stockage indisponible */ } if (!on) stop(); }
export const commentaryAvailable = () => !!(window.GFAndroid?.speak || window.speechSynthesis);

let last = 0;
function stop() {
  try { if (window.GFAndroid?.stopSpeaking) window.GFAndroid.stopSpeaking(); else window.speechSynthesis?.cancel(); } catch { /* indisponible */ }
}
// `urgent` : coupe la phrase en cours (but, carton rouge)
export function say(text, urgent = false) {
  if (!commentaryOn() || !text) return;
  const now = Date.now();
  if (!urgent && now - last < 4000) return; // pas de bavardage : une phrase toutes les quatre secondes au plus
  last = now;
  try {
    if (window.GFAndroid?.speak) { window.GFAndroid.speak(text, urgent); return; }
    const s = window.speechSynthesis;
    if (!s) return;
    if (urgent) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR'; u.rate = 1.08;
    s.speak(u);
  } catch { /* synthèse indisponible */ }
}

const pick = (arr, seed) => arr[Math.abs(seed) % arr.length];
const surname = (n) => String(n ?? '').split(' ').slice(-1)[0];
// Phrase pour un événement du moteur (ou null)
export function commentFor(ev, m, userId = null) {
  const team = (i) => m.teams[i]?.name ?? '';
  const pl = (id) => (id != null ? m.players[id] : null);
  const score = `${m.teams[0].short} ${m.score[0]}, ${m.teams[1].short} ${m.score[1]}`;
  const n = ev.tick ?? 0;
  switch (ev.type) {
    case 'coup_envoi': return { text: pick(['C\'est parti !', 'Coup d\'envoi !', 'Le match commence !'], n) };
    case 'but': {
      const p = pl(ev.player);
      if (ev.own) return { text: `Contre son camp ! ${score}.`, urgent: true };
      if (p && p.id === userId) return { text: pick([`Et c'est ${surname(p.name)} ! Quel but !`, `${surname(p.name)} ! Il l'a fait !`, `But ! ${surname(p.name)} fait exploser le stade !`], n) + ` ${score}.`, urgent: true };
      return { text: `But ! ${p ? surname(p.name) : team(ev.team)} ! ${score}.`, urgent: true };
    }
    case 'penalty': return { text: 'Penalty !', urgent: true };
    case 'arret': return (ev.xg ?? 0) >= 0.2 || /captée/.test(ev.text ?? '') === false ? { text: pick([`Quel arrêt de ${surname(pl(ev.player)?.name)} !`, `${surname(pl(ev.player)?.name)} est décisif !`, 'Superbe parade !'], n) } : null;
    case 'tir_rate': return (ev.xg ?? 0) >= 0.3 ? { text: pick(['Oh ! C\'était l\'occasion !', 'Incroyable, il la manque !', 'À côté ! Quelle occasion !'], n) } : null;
    case 'carton': return ev.card === 'red' ? { text: `Carton rouge pour ${surname(pl(ev.player)?.name)} !`, urgent: true } : null;
    case 'mi_temps': return { text: `C'est la mi-temps. ${score}.` };
    case 'fin': return { text: `C'est terminé ! ${score}.`, urgent: true };
    default: return null;
  }
}
