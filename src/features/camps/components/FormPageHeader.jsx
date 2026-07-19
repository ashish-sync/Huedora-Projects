import { useNavigate } from 'react-router-dom';

export function FormPageHeader({ title, backTo, onBack }) {
  const navigate = useNavigate();

  function handleBack() {
    if (onBack) {
      onBack();
      return;
    }
    if (backTo) {
      navigate(backTo);
      return;
    }
    navigate(-1);
  }

  return (
    <div className="form-page-header">
      <button type="button" className="btn btn-secondary btn-sm form-back-btn" onClick={handleBack}>
        ← Back
      </button>
      {title && <h3>{title}</h3>}
    </div>
  );
}
