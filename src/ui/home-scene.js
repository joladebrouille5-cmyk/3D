// Décor vivant de l'accueil : un vrai match (IA contre IA) joué en direct par le moteur,
// sur un terrain incliné en perspective sous les projecteurs. Purement décoratif.
import { Match } from '../engine/match.js';
import { SIM } from '../engine/config.js';
import { PitchRenderer } from './render.js';
import { clubById, buildTeamSquad, leagueFor } from '../career/clubs.js';

const RIVALS = ['olympique-de-marseille', 'paris-saint-germain', 'olympique-lyonnais', 'as-monaco', 'losc-lille', 'rc-lens', 'stade-rennais', 'fc-nantes'];
let scene = null;

function squad(club) { return buildTeamSquad(club, 'Pro', 2026, leagueFor(club, 'Pro')); }
function snap(m) { return { p: m.players.map((p) => [p.x, p.y]), b: [m.ball.x, m.ball.y, m.ball.z] }; }

export function startHomeScene(canvas, clubId = null) {
  stopHomeScene();
  if (!canvas) return;
  const a = clubById(clubId) ?? clubById('fc-nantes');
  const b = clubById(RIVALS.find((id) => id !== a.id && clubById(id)));
  let m;
  try {
    m = new Match({ home: squad(a), away: squad(b), seed: `accueil-${Math.floor(Date.now() / 60000)}`, userTeam: null, aiTeams: [0, 1] });
  } catch { return; }
  for (let i = 0; i < 260; i++) m.step(); // le jeu est déjà lancé quand le rideau se lève
  const renderer = new PitchRenderer(canvas, { maxDpr: 1.5 });
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ro = new ResizeObserver(() => renderer.resize());
  ro.observe(canvas);
  const st = { m, renderer, prev: snap(m), acc: 0, last: 0, raf: 0, ro, stopped: false };
  const frame = (now) => {
    if (st.stopped) return;
    const dt = Math.min(0.1, (now - (st.last || now)) / 1000); st.last = now;
    if (!reduce && !document.hidden) {
      st.acc += dt;
      while (st.acc >= SIM.dt) { st.prev = snap(m); m.step(); st.acc -= SIM.dt; }
    }
    const k = reduce ? 1 : Math.min(1, st.acc / SIM.dt);
    const players = m.players.map((p, i) => {
      const [px, py] = st.prev.p[i];
      return { ...p, x: Number.isFinite(px) ? px + (p.x - px) * k : p.x, y: Number.isFinite(py) ? py + (p.y - py) * k : p.y };
    });
    const [bx, by, bz] = st.prev.b;
    const ball = { x: bx + (m.ball.x - bx) * k, y: by + (m.ball.y - by) * k, z: bz + (m.ball.z - bz) * k };
    renderer.follow(ball.x * 0.6 + 52.5 * 0.4, ball.y * 0.5 + 34 * 0.5, 1.45, 0.03);
    renderer.draw({ teams: m.teams.map((t) => ({ ...t })), players, ball, ownerId: m.ball.owner });
    if (m.phase === 'fulltime') { startHomeScene(canvas, clubId); return; }
    st.raf = requestAnimationFrame(frame);
  };
  st.raf = requestAnimationFrame(frame);
  scene = st;
}

export function stopHomeScene() {
  if (!scene) return;
  scene.stopped = true;
  cancelAnimationFrame(scene.raf);
  scene.ro.disconnect();
  scene = null;
}
