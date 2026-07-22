import { importApi } from '../campOpsApi.js';

export async function downloadCampSampleFile() {
  const response = await importApi.downloadSample();
  const blob = response.data;
  if (!(blob instanceof Blob)) {
    throw new Error('Invalid sample file response');
  }
  if (blob.type && blob.type.includes('application/json')) {
    const json = JSON.parse(await blob.text());
    throw new Error(json.message || json.error?.message || 'Failed to download sample file');
  }
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'camp-import-sample.xlsx';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}
