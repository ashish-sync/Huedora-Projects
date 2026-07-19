import { clientMasterApi } from '../campOpsApi.js';

export const PROGRAM_PDF_MAX_BYTES = 5 * 1024 * 1024;

export function validateProgramPdfFile(file) {
  if (!file) return '';
  if (file.type && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    return 'Only PDF files are allowed';
  }
  if (file.size > PROGRAM_PDF_MAX_BYTES) {
    return 'PDF must be 5 MB or smaller';
  }
  return '';
}

export function getProgramDocumentMeta(record) {
  const doc = record?.programDocument;
  if (!doc?.storedName) return null;
  return {
    fileName: doc.fileName || 'program-document.pdf',
    fileSize: doc.fileSize || 0,
    uploadedAt: doc.uploadedAt || null,
  };
}

async function parseBlobErrorPayload(data) {
  if (!(data instanceof Blob)) {
    return {
      message: data?.message || 'Failed to open program document',
      documentCleared: Boolean(data?.documentCleared),
      record: data?.data || null,
    };
  }

  try {
    const text = await data.text();
    const json = JSON.parse(text);
    return {
      message: json.message || 'Failed to open program document',
      documentCleared: Boolean(json.documentCleared),
      record: json.data || null,
    };
  } catch {
    return {
      message: 'Failed to open program document',
      documentCleared: false,
      record: null,
    };
  }
}

export async function openProgramDocument(programId) {
  try {
    const response = await clientMasterApi.downloadDocument(programId);
    const blob = response.data;

    if (blob instanceof Blob && blob.type?.includes('application/json')) {
      const parsed = await parseBlobErrorPayload(blob);
      const error = new Error(parsed.message);
      error.documentCleared = parsed.documentCleared;
      error.record = parsed.record;
      throw error;
    }

    const url = window.URL.createObjectURL(new Blob([blob], { type: 'application/pdf' }));
    window.open(url, '_blank', 'noopener,noreferrer');
    window.setTimeout(() => window.URL.revokeObjectURL(url), 60000);
    return { opened: true };
  } catch (err) {
    if (err.documentCleared != null) {
      throw err;
    }

    const parsed = await parseBlobErrorPayload(err.response?.data);
    const error = new Error(parsed.message || err.message || 'Failed to open program document');
    error.documentCleared = parsed.documentCleared;
    error.record = parsed.record;
    throw error;
  }
}
