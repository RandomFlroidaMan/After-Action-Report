import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveAction, transition, type ActionContext } from '../packages/rules/index';
import type { ActionState, Span } from '../packages/contracts/index';
const resource = { id: 'slot-level-3', delta: -1, verified: true };
const present = { actorId: 'thrain', spell: 'Fireball', modality: 'present' as const };
const cases: {
  name: string;
  text: string;
  context: Partial<ActionContext>;
  state: ActionState;
  proposed: number;
}[] = [
  {
    name: '1 shouted cast without response',
    text: "I didn't ask how big the room was, I said I CAST FIREBALL!",
    context: {},
    state: 'DECLARED',
    proposed: 0,
  },
  {
    name: '2 hypothetical',
    text: 'If I cast Fireball here, would it hit everyone?',
    context: { declaration: { ...present, modality: 'hypothetical' } },
    state: 'HYPOTHETICAL',
    proposed: 0,
  },
  {
    name: '3 DM declines',
    text: 'I cast Fireball. No, you cannot see the target.',
    context: { dmRuling: 'rejected' },
    state: 'REJECTED',
    proposed: 0,
  },
  {
    name: '4 confirmed damage',
    text: 'I cast Fireball. Roll damage. 32. Goblins burn.',
    context: { dmRuling: 'confirmed', damage: 32, resource },
    state: 'RESOLVED_SUCCESS',
    proposed: 1,
  },
  {
    name: '5 superseded',
    text: "I'll cast Fireball—actually no, I use a cantrip.",
    context: { declaration: { ...present, superseded: true } },
    state: 'SUPERSEDED',
    proposed: 0,
  },
  {
    name: '6 declined question',
    text: 'Do you want to cast Fireball? No.',
    context: { declaration: { ...present, modality: 'question' } },
    state: 'HYPOTHETICAL',
    proposed: 0,
  },
  {
    name: '7 attack misses',
    text: 'I attack. Nat 1. You miss.',
    context: {
      declaration: { ...present, spell: undefined },
      dmRuling: 'confirmed',
      outcome: 'failure',
    },
    state: 'RESOLVED_FAILURE',
    proposed: 0,
  },
  {
    name: '8 tavern joke',
    text: 'I nuke the tavern with Fireball. [laughter]',
    context: { declaration: { ...present, modality: 'joke' } },
    state: 'HYPOTHETICAL',
    proposed: 0,
  },
  {
    name: '9 Revivify actual valued diamond',
    text: 'I cast Revivify. Confirmed; consume the 300 gp diamond.',
    context: {
      declaration: { ...present, spell: 'Revivify' },
      dmRuling: 'confirmed',
      resource: { id: 'diamond-300gp', delta: -1, verified: true },
    },
    state: 'RESOLVED_SUCCESS',
    proposed: 1,
  },
  {
    name: '10 telemetry conflict',
    text: 'Fireball; VTT reports Ray of Frost.',
    context: { dmRuling: 'confirmed', vttSpell: 'Ray of Frost', resource },
    state: 'REVIEW_REQUIRED',
    proposed: 0,
  },
  {
    name: '11 damage before declaration',
    text: '32 damage!',
    context: { declaration: undefined, damage: 32 },
    state: 'AMBIGUOUS',
    proposed: 0,
  },
  {
    name: '12 immunity does not erase cast',
    text: 'Fireball confirmed; zero damage, immune.',
    context: { dmRuling: 'confirmed', outcome: 'immune', resource },
    state: 'RESOLVED_SUCCESS',
    proposed: 1,
  },
  {
    name: '13 historical quote',
    text: 'Last session I said I cast Fireball.',
    context: { declaration: { ...present, modality: 'history' } },
    state: 'HYPOTHETICAL',
    proposed: 0,
  },
  {
    name: '14 retcon',
    text: 'DM: retcon last turn.',
    context: { dmRuling: 'retcon' },
    state: 'REVIEW_REQUIRED',
    proposed: 0,
  },
  {
    name: '15 overlapping similar names',
    text: '[Thrain/Thane overlap] I cast…',
    context: { attributionUncertain: true, resource, dmRuling: 'confirmed' },
    state: 'AMBIGUOUS',
    proposed: 0,
  },
  {
    name: '16 unassigned roll',
    text: 'A 19 on that roll.',
    context: { declaration: undefined },
    state: 'AMBIGUOUS',
    proposed: 0,
  },
  {
    name: '17 material override',
    text: 'DM: the component is not consumed.',
    context: { dmRuling: 'no-component', resource },
    state: 'RESOLVED_SUCCESS',
    proposed: 0,
  },
  {
    name: '18 battle cry distinct from mechanics',
    text: 'ATTONE! Inflict Wounds hits and kills.',
    context: {
      declaration: { actorId: 'cleric', spell: 'Inflict Wounds', modality: 'present' },
      dmRuling: 'confirmed',
    },
    state: 'RESOLVED_SUCCESS',
    proposed: 0,
  },
  {
    name: '19 confirmed recovery',
    text: 'DM: long rest complete; restore two slots.',
    context: { dmRuling: 'rest', resource: { ...resource, delta: 2 } },
    state: 'RESOLVED_SUCCESS',
    proposed: 1,
  },
  {
    name: '20 NPC recollection',
    text: 'NPC: I saw a Fireball last week.',
    context: { declaration: { ...present, modality: 'history' } },
    state: 'HYPOTHETICAL',
    proposed: 0,
  },
];
for (const fixture of cases)
  test(fixture.name, () => {
    for (const text of [
      fixture.text,
      fixture.text.toUpperCase(),
      fixture.text.replaceAll('.', '!'),
    ]) {
      const spans: Span[] = [
        {
          id: 'source-1',
          speaker: 'Thrain',
          role: 'PLAYER',
          text,
          startMs: 1000,
          endMs: 5000,
          visibility: 'PARTY',
        },
      ];
      const result = resolveAction({ spans, declaration: present, ...fixture.context });
      assert.equal(result.state, fixture.state);
      assert.equal(result.proposedResources.length, fixture.proposed);
      assert.deepEqual(result.committedResources, []);
      assert.equal(
        result.actorId,
        fixture.context.declaration === undefined && Object.hasOwn(fixture.context, 'declaration')
          ? null
          : (fixture.context.declaration?.actorId ?? 'thrain'),
      );
      assert.deepEqual(result.evidenceIds, ['source-1']);
      assert.equal(result.timeline[0].speaker, 'Thrain');
      assert.equal(result.visibility, 'PARTY');
      assert.ok(result.reason);
      assert.equal(result.reviewRequired, true);
    }
  });
test('private input propagates private action scope', () => {
  const r = resolveAction({
    spans: [
      {
        id: 'secret',
        text: 'private',
        speaker: 'DM',
        role: 'DM',
        startMs: 0,
        endMs: 1,
        visibility: 'DM',
      },
    ],
  });
  assert.equal(r.visibility, 'DM');
});
test('legal state edges and illegal terminal edges', () => {
  assert.equal(transition('DECLARED', 'ACKNOWLEDGED'), 'ACKNOWLEDGED');
  assert.throws(() => transition('REJECTED', 'RESOLVED_SUCCESS'), /Illegal/);
});
test('uncorroborated or unverified resources never proposed', () => {
  assert.equal(
    resolveAction({ spans: [], declaration: present, resource }).proposedResources.length,
    0,
  );
  assert.equal(
    resolveAction({
      spans: [],
      declaration: present,
      dmRuling: 'confirmed',
      resource: { ...resource, verified: false },
    }).proposedResources.length,
    0,
  );
});
