// Écussons générés : un écusson valide et stable pour chaque club, couleurs réelles si connues.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CLUBS } from '../src/career/clubs.js';
import { crestSVG, clubColors, initials } from '../src/ui/crest.js';

test('chaque club du catalogue a un écusson SVG valide et stable', () => {
  for (const c of CLUBS) {
    const svg = crestSVG(c, 40);
    assert.match(svg, /^<svg[\s\S]*<\/svg>$/);
    assert.equal(svg, crestSVG(c, 40), `écusson stable pour ${c.id}`);
    assert.ok(initials(c.name).length >= 1);
  }
});

test('couleurs réelles des clubs connus, déterministes sinon', () => {
  assert.equal(clubColors('rc-lens').primary, '#e10600');
  assert.equal(clubColors('fc-nantes').primary, '#ffe000');
  assert.equal(clubColors('rc-lens-U17').primary, '#e10600', 'même couleurs pour les équipes de jeunes du club');
  const x = clubColors('club-inconnu');
  assert.deepEqual(x, clubColors('club-inconnu'));
  assert.equal(initials('Paris Saint-Germain'), 'PSG');
});
