import { useRef, useState } from 'react';
import { EXECUTION_DOC_TYPES, normalizeExecutionDocType } from '../constants/campLifecycle.js';

function docsForType(docs, docType) {
  return docs.filter((doc) => normalizeExecutionDocType(doc.docType) === docType);
}

function UploadIcon() {
  return (
    <svg className="camp-execution-doc-upload-icon" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M10 3.5V12.5M10 3.5L6.5 7M10 3.5L13.5 7M4.5 12.5V14.5C4.5 15.3284 5.17157 16 6 16H14C14.8284 16 15.5 15.3284 15.5 14.5V12.5"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CampExecutionDocuments({
  docs = [],
  campId,
  onUploadDocuments,
  uploadBusy = false,
  disabled = false,
}) {
  const [otherSpecify, setOtherSpecify] = useState('');
  const [uploadHint, setUploadHint] = useState('');
  const inputRefs = useRef({});

  const uploadsEnabled = Boolean(campId && onUploadDocuments) && !disabled;

  function openPicker(docType) {
    if (!campId) {
      setUploadHint('Save the camp first, then upload documents.');
      return;
    }
    if (!onUploadDocuments || disabled || uploadBusy) return;
    if (docType === 'other' && !otherSpecify.trim()) {
      setUploadHint('Specify document type/name before uploading.');
      return;
    }
    setUploadHint('');
    inputRefs.current[docType]?.click();
  }

  function handleUpload(docType, fileList) {
    if (!fileList?.length || !onUploadDocuments) return;
    const docNote = docType === 'other' ? otherSpecify.trim() : '';
    setUploadHint('');
    onUploadDocuments(fileList, docType, docNote);
  }

  return (
    <section className="camp-lifecycle-docs camp-execution-docs-panel">
      <h3>Execution Documents</h3>

      <div className="camp-execution-doc-rows">
        {EXECUTION_DOC_TYPES.map((type) => {
          const typeDocs = docsForType(docs, type.value);
          const isUploaded = typeDocs.length > 0;
          const isGpsSelfie = type.value === 'gps_selfie';
          const isOther = type.value === 'other';
          const rowUploadLocked = disabled
            || uploadBusy
            || (uploadsEnabled && isOther && !otherSpecify.trim());
          const latestDoc = typeDocs[typeDocs.length - 1];

          return (
            <div key={type.value} className="camp-execution-doc-row">
              <div className="camp-execution-doc-row-main">
                {isOther ? (
                  <input
                    type="text"
                    className="camp-execution-doc-other-input"
                    value={otherSpecify}
                    onChange={(e) => {
                      setOtherSpecify(e.target.value);
                      if (uploadHint) setUploadHint('');
                    }}
                    disabled={disabled || uploadBusy}
                    placeholder="Specify document type/name"
                  />
                ) : (
                  <span className="camp-execution-doc-row-label">{type.label}</span>
                )}
                <input
                  ref={(node) => {
                    inputRefs.current[type.value] = node;
                  }}
                  type="file"
                  className="camp-execution-doc-upload-input"
                  multiple={!isGpsSelfie}
                  accept={isGpsSelfie ? 'image/*' : undefined}
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files?.length) handleUpload(type.value, files);
                    e.target.value = '';
                  }}
                />
                <button
                  type="button"
                  className="camp-execution-doc-upload-btn"
                  disabled={rowUploadLocked}
                  title={!campId ? 'Save the camp first to upload' : undefined}
                  onClick={() => openPicker(type.value)}
                >
                  <UploadIcon />
                  <span>{uploadBusy ? 'Uploading…' : 'Upload'}</span>
                </button>
                <span
                  className={`camp-execution-doc-tick ${isUploaded ? 'is-uploaded' : ''}`}
                  aria-label={isUploaded ? 'Uploaded' : 'Not uploaded'}
                  title={isUploaded ? (latestDoc?.fileName || 'Uploaded') : 'Not uploaded'}
                >
                  ✓
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {uploadHint ? (
        <p className="meta-text camp-execution-doc-save-hint camp-execution-doc-hint-warn">{uploadHint}</p>
      ) : !campId ? (
        <p className="meta-text camp-execution-doc-save-hint">Save the camp once to enable uploads.</p>
      ) : null}
    </section>
  );
}
