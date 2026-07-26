import { BRAND_LOGO_ALT, BRAND_LOGO_SRC } from '../shared/brandAssets.js';

export default function BrandLogo({
  className = '',
  size = 40,
  alt = BRAND_LOGO_ALT,
  ...props
}) {
  return (
    <img
      src={BRAND_LOGO_SRC}
      alt={alt}
      className={`brand-logo${className ? ` ${className}` : ''}`}
      width={size}
      height={size}
      loading="eager"
      decoding="async"
      {...props}
    />
  );
}
