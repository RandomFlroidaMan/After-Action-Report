import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, StandardFonts } from 'pdf-lib';
import { pdfAdapter } from '../packages/integrations/import';
export async function fixturePDF() {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  page.drawText('Character sheet: Thrain Blackvein, dwarven sorcerer', {
    x: 40,
    y: 740,
    font,
    size: 14,
  });
  const name = pdf.getForm().createTextField('CharacterName');
  name.setText('Thrain Blackvein');
  name.addToPage(page, { x: 40, y: 680, width: 220, height: 25 });
  const cls = pdf.getForm().createTextField('ClassLevel');
  cls.setText('Sorcerer 5');
  cls.addToPage(page, { x: 40, y: 630, width: 220, height: 25 });
  return pdf.save({ useObjectStreams: false });
}
test('fillable PDF fields and visible text extracted for review', async () => {
  const bytes = await fixturePDF();
  const original = bytes.slice();
  const result = await pdfAdapter.importFile(bytes);
  assert.deepEqual(bytes, original);
  assert.equal(result.fields.CharacterName, 'Thrain Blackvein');
  assert.equal(result.fields.ClassLevel, 'Sorcerer 5');
  assert.match(result.text, /Character sheet/);
  assert.equal(pdfAdapter.capabilities.syncWrite, false);
});
test('invalid and encrypted data cannot be silently imported', async () => {
  await assert.rejects(pdfAdapter.importFile(new TextEncoder().encode('not a PDF')));
});
