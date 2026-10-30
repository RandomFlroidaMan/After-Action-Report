import { PDFDocument, PDFTextField, PDFCheckBox } from 'pdf-lib';
export interface CharacterSourceAdapter {
  capabilities: {
    importFile: boolean;
    importStructured: boolean;
    validate: boolean;
    syncRead: boolean;
    syncWrite: boolean;
  };
  importFile(
    bytes: Uint8Array,
  ): Promise<{ fields: Record<string, string>; text: string; warnings: string[] }>;
}
export const pdfAdapter: CharacterSourceAdapter = {
  capabilities: {
    importFile: true,
    importStructured: false,
    validate: true,
    syncRead: false,
    syncWrite: false,
  },
  async importFile(bytes) {
    const pdf = await PDFDocument.load(bytes, { ignoreEncryption: false });
    if (pdf.getPageCount() > 30) throw new Error('Maximum 30 PDF pages');
    const fields: Record<string, string> = {};
    for (const field of pdf.getForm().getFields()) {
      if (field instanceof PDFTextField) fields[field.getName()] = field.getText() ?? '';
      else if (field instanceof PDFCheckBox) fields[field.getName()] = String(field.isChecked());
    }
    // PDF.js loads native graphics support. Keep it out of authentication and
    // other requests that share this adapter's route module.
    const { PDFParse } = await import('pdf-parse');
    const parser = new PDFParse({ data: bytes.slice() });
    let text = '';
    try {
      text = (await parser.getText()).text;
    } finally {
      await parser.destroy();
    }
    return {
      fields,
      text: text.slice(0, 30000),
      warnings: [
        'All parsed fields require review. No spell slots or inventory are changed by import.',
        'Scanned sheets require manual entry; OCR is not configured.',
      ],
    };
  },
};
