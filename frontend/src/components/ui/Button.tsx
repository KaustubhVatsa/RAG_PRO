import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";
import { useMagnetic } from "../../lib/media";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  icon?: ReactNode;
  /** Trailing icon (e.g. a chevron). */
  iconEnd?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "secondary", size = "md", icon, iconEnd, className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button ref={ref} type={type} className={`btn btn-${variant} btn-${size} ${className}`} {...rest}>
      {icon}
      {children && <span className="btn-label">{children}</span>}
      {iconEnd}
    </button>
  );
});

/** A primary call-to-action that drifts toward the pointer ("magnetic"). */
export function MagneticButton(props: ButtonProps) {
  const ref = useMagnetic<HTMLButtonElement>();
  return <Button ref={ref} {...props} className={`is-magnetic ${props.className ?? ""}`} />;
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: Size;
  variant?: Variant;
  children: ReactNode;
}

/** Square icon-only button. `label` becomes the accessible name and the native tooltip. */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, size = "md", variant = "ghost", className = "", children, type = "button", ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      aria-label={label}
      title={label}
      className={`icon-btn btn-${variant} icon-btn-${size} ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
});
