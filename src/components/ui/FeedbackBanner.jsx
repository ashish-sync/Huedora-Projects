/**
 * Unified inline feedback — use instead of ad-hoc error-banner / am-banner / rp-toast.
 */
const VARIANT_CLASS = {
  error: 'feedback-banner is-error',
  success: 'feedback-banner is-success',
  info: 'feedback-banner is-info',
  warning: 'feedback-banner is-warning',
};

export default function FeedbackBanner({ variant = 'error', children, className = '' }) {
  if (!children) return null;
  const role = variant === 'error' || variant === 'warning' ? 'alert' : 'status';
  return (
    <div className={`${VARIANT_CLASS[variant] || VARIANT_CLASS.error} ${className}`.trim()} role={role}>
      {children}
    </div>
  );
}

export function PageAlerts({ items = [], className = '' }) {
  const visible = items.filter((item) => item?.message);
  if (!visible.length) return null;
  return (
    <div className={`page-alerts${className ? ` ${className}` : ''}`}>
      {visible.map((item) => (
        <FeedbackBanner key={item.key || `${item.variant}-${item.message}`} variant={item.variant} className={item.className}>
          {item.message}
        </FeedbackBanner>
      ))}
    </div>
  );
}

/** Drop-in for legacy error + info/success message pairs (replaces am-banner toggles). */
export function FeedbackAlerts({
  error = '',
  message = '',
  success = '',
  info = '',
  warning = '',
  className = '',
}) {
  return (
    <PageAlerts
      items={[
        error && { variant: 'error', message: error, className },
        success && { variant: 'success', message: success, className },
        warning && { variant: 'warning', message: warning, className },
        info && { variant: 'info', message: info, className },
        message && !error && !success && !warning && !info && { variant: 'info', message, className },
      ].filter(Boolean)}
    />
  );
}
