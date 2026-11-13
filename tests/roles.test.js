// Chaque poste peut être choisi : concurrent direct, titularisation et match fonctionnent.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as C from '../src/career/career.js';

test('tous les postes ont un concurrent direct et une place dans le onze', () => {
  for (const role of Object.keys(C.ROLES)) {
    const st = C.createCareer({ firstName: 'A', lastName: 'B', role, clubId: 'rc-lens', seed: `poste-${role}` });
    const f = C.selectionForecast(st);
    assert.ok(f.rival && f.rival.name, `concurrent pour ${role}`);
    while (st.phase !== 'matchday' || st.matchday.bye) {
      if (st.phase === 'week') C.submitWeek(st, { focus: 'technique', intensity: 'normale', offpitch: 'video' });
      else if (st.phase === 'event') C.resolveEvent(st, 0);
      else if (st.phase === 'month_review') C.closeMonthReview(st);
      else C.applyMatchResult(st, C.resultWithoutUser(st));
    }
    st.matchday.selection = 'titulaire';
    const s = C.matchSetup(st);
    const team = s.userTeam === 0 ? s.home : s.away;
    assert.ok(team.starters.some((p) => p.isUser), `${role} titulaire dans le onze`);
  }
});
