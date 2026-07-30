/** Inline validation message below a form control. */
export default function FieldError({ message }) {
  if (!message) return null;
  return <small className="field-error">{message}</small>;
}
