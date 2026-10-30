import { test } from 'node:test';
import assert from 'node:assert/strict';
import { aiConfig } from '../packages/ai/config';
test('cloud secret aliases enable extraction without reserved OPENAI_ bindings', () => {
  assert.deepEqual(
    aiConfig({
      AAR_OPENAI_API_KEY: 'fixture-not-a-real-key',
      AAR_EXTRACTION_MODEL: 'gpt-4.1-mini',
    }),
    {
      key: 'fixture-not-a-real-key',
      extractionModel: 'gpt-4.1-mini',
      transcriptionModel: undefined,
    },
  );
});
test('standard local OpenAI configuration takes precedence over aliases', () => {
  const config = aiConfig({
    OPENAI_API_KEY: 'local-fixture',
    AAR_OPENAI_API_KEY: 'cloud-fixture',
    OPENAI_EXTRACTION_MODEL: 'local-model',
    AAR_EXTRACTION_MODEL: 'cloud-model',
  });
  assert.equal(config.key, 'local-fixture');
  assert.equal(config.extractionModel, 'local-model');
});
test('missing credentials remain unconfigured rather than using fabricated keys', () => {
  assert.equal(aiConfig({ AAR_EXTRACTION_MODEL: 'gpt-4.1-mini' }).key, undefined);
});
