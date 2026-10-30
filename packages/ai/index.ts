import { z } from 'zod';
import { aiConfig } from './config';
import type { Span } from '../contracts/index';
export interface Transcriber {
  status: 'configured' | 'fixture' | 'unconfigured';
  transcribe(bytes: Uint8Array, mime: string): Promise<Span[]>;
}
export class OpenAITranscriber implements Transcriber {
  status = 'configured' as const;
  constructor(
    private key: string,
    private model: string,
  ) {}
  async transcribe(bytes: Uint8Array, mime: string): Promise<Span[]> {
    const form = new FormData();
    form.set(
      'file',
      new Blob([bytes as BlobPart], { type: mime }),
      'recording.' + (mime === 'audio/wav' ? 'wav' : 'webm'),
    );
    form.set('model', this.model);
    const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.key}` },
      body: form,
      signal: AbortSignal.timeout(120000),
    });
    if (!response.ok) throw new Error(`Transcription provider returned ${response.status}`);
    const result = z.object({ text: z.string() }).parse(await response.json());
    // Plain-text transcription has no guaranteed diarization or per-word timestamps.
    return [
      {
        id: crypto.randomUUID(),
        speaker: 'Unknown — assign speaker',
        role: 'UNKNOWN',
        text: result.text,
        startMs: 0,
        endMs: 0,
        visibility: 'PARTY',
      },
    ];
  }
}
export function transcriber(): Transcriber {
  const config = aiConfig();
  if (config.key && config.transcriptionModel)
    return new OpenAITranscriber(config.key, config.transcriptionModel);
  return {
    status: 'unconfigured',
    async transcribe() {
      throw new Error(
        'Set OPENAI_API_KEY and OPENAI_TRANSCRIPTION_MODEL for real audio transcription, or choose the labeled synthetic demo.',
      );
    },
  };
}
export interface DeliveryAdapter {
  status: 'unconfigured' | 'test';
  send(input: {
    recipient: string;
    reportId: string;
    approved: boolean;
  }): Promise<{ status: string }>;
}
export const disabledDelivery: DeliveryAdapter = {
  status: 'unconfigured',
  async send() {
    throw new Error('External delivery is unconfigured. Publish in-app instead.');
  },
};
export interface ImageAdapter {
  status: 'unconfigured';
  generate(approvedBrief: string): Promise<never>;
}
export const images: ImageAdapter = {
  status: 'unconfigured',
  async generate() {
    throw new Error(
      'Image generation requires a configured provider, cost policy and DM approval.',
    );
  },
};
