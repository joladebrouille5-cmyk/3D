// Staff / manager piloté par l'IA : un plan et des limites.
// Il passe par les mêmes commandes et la même validation que l'utilisateur.

function bestReplacement(m, team, out) {
  const bench = team.bench.map((id) => m.players[id]).filter((p) => !p.used);
  if (!bench.length) return null;
  const same = bench.filter((p) => p.role === out.role);
  const pool = same.length ? same : bench.filter((p) => (p.role === 'GK') === (out.role === 'GK'));
  if (!pool.length) return null;
  return pool.sort((a, b) => b.attrs.stamina + b.attrs.pace - (a.attrs.stamina + a.attrs.pace))[0];
}

export function runAIManager(m, teamIdx, atHalftime, injured = null) {
  if (!m.aiTeams.includes(teamIdx)) return;
  const team = m.teams[teamIdx];
  const minute = (m.period - 1) * 45 + m.periodTime / 60;
  const diff = m.score[teamIdx] - m.score[1 - teamIdx];
  const pendingSubs = team.subRequests.filter((r) => r.status === 'demandé');
  const queueSub = (out) => {
    const inn = bestReplacement(m, team, out);
    if (!inn) return false;
    if (!m.validateSub(teamIdx, out.id, inn.id).ok) return false;
    m.queueCommand({ type: 'sub', team: teamIdx, outId: out.id, inId: inn.id, source: 'staff' });
    return true;
  };

  if (injured) { queueSub(injured); return; }

  // Plan tactique selon le contexte réel du match
  const pending = team.instructions.some((i) => i.status === 'transmise');
  if (!pending) {
    let want = null;
    if (minute >= 60 && diff < 0 && (team.tactics.style !== 'direct' || team.tactics.pressing !== 'haut')) want = { style: 'direct', pressing: 'haut' };
    else if (minute >= 72 && diff > 0 && team.tactics.bloc !== 'bas') want = { bloc: 'bas', pressing: 'moyen' };
    // à domicile, un nul ne suffit pas : on pousse pour la victoire dans le dernier quart d'heure
    else if (minute >= 72 && diff === 0 && teamIdx === 0 && team.tactics.style !== 'direct') want = { style: 'direct' };
    if (want && m.validateInstruction(teamIdx, want).ok) m.queueCommand({ type: 'instruction', team: teamIdx, changes: want, source: 'staff' });
  }

  // Changements : joueurs les plus entamés, à partir de l'heure de jeu
  if (pendingSubs.length) return;
  if (!atHalftime && minute < 56) return;
  const left = m.competition.maxSubs - team.subsUsed;
  if (left <= 0) return;
  const tired = m.onPitch(teamIdx).filter((p) => p.role !== 'GK' && (p.energy < 0.68 || p.injured || (p.yellow && minute > 65 && p.role !== 'ST'))).sort((a, b) => a.energy - b.energy);
  const n = Math.min(left, minute > 75 ? 2 : 1, tired.length);
  for (let i = 0; i < n; i++) queueSub(tired[i]);
}
