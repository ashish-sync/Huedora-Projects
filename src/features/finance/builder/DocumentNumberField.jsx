import { useAuth } from '../../../shared/auth.jsx';
import { documentNumberExample } from '../documentNumbering.js';

/**
 * Official numbers are assigned on approve. Admins may type a PREFIXFY/MM/SEQ
 * override before approval; uniqueness is enforced on the server.
 */
export default function DocumentNumberField({
  value,
  onChange,
  documentType,
  documentCode,
  dateIso,
  issued = false,
  className = 'ib-input ib-input--mono',
}) {
  const { isAdmin } = useAuth();
  const admin = Boolean(isAdmin?.());
  const example = documentNumberExample(documentType, dateIso, documentCode);
  const editable = admin && !issued && typeof onChange === 'function';

  return (
    <input
      className={className}
      value={value || ''}
      readOnly={!editable}
      onChange={editable ? (e) => onChange(e.target.value) : undefined}
      placeholder={editable ? `Optional · e.g. ${example}` : 'Assigned on approval'}
      title={
        issued
          ? 'Use Correct document number to change an issued number'
          : editable
            ? `Admins may enter ${example} before approval. Leave blank to auto-assign. Duplicates are rejected.`
            : 'Document number is assigned when the document is approved'
      }
    />
  );
}
