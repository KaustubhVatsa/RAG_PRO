import { useTheme } from "../../lib/theme";
import { IconMoon, IconSun } from "../icons";

/** A switch (role="switch") with a springy knob that carries the sun/moon icon. */
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const dark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark theme"
      title={dark ? "Switch to light theme" : "Switch to dark theme"}
      className="theme-toggle"
      onClick={toggle}
    >
      <span className="theme-toggle-knob" aria-hidden="true">
        {dark ? <IconMoon size={13} /> : <IconSun size={13} />}
      </span>
    </button>
  );
}
