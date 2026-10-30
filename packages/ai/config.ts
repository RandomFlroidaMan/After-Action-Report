/** Cloud proxy secrets use AAR_ aliases because OPENAI_ bindings are platform-reserved. */
export function aiConfig(env: Record<string, string | undefined> = process.env) {
  return {
    key: env.OPENAI_API_KEY || env.AAR_OPENAI_API_KEY,
    extractionModel: env.OPENAI_EXTRACTION_MODEL || env.AAR_EXTRACTION_MODEL,
    transcriptionModel: env.OPENAI_TRANSCRIPTION_MODEL || env.AAR_TRANSCRIPTION_MODEL,
  };
}
