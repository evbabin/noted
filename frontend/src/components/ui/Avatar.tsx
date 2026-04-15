import { useMemo, useState } from "react";

interface AvatarProps {
  /**
   * Optional image URL for the avatar. When the image is missing or fails to
   * load, the component falls back to initials so the UI still has a stable
   * collaborator identity marker.
   */
  src?: string | null;
  /**
   * Human-readable name used to derive initials and accessibility labels.
   */
  name?: string | null;
  /**
   * Square avatar size in pixels.
   */
  size?: number;
  /**
   * Optional Tailwind / utility classes for layout overrides.
   */
  className?: string;
  /**
   * Optional background color override. This is useful for collaborator UIs
   * where each user already has an assigned presence color.
   */
  backgroundColor?: string;
  /**
   * Optional border color override. This lets collaborator UIs show a stable
   * user color even when the avatar renders an image instead of initials.
   */
  borderColor?: string;
  /**
   * Optional text color override for the initials fallback.
   */
  textColor?: string;
}

const DEFAULT_BACKGROUND = "#e5e7eb";
const DEFAULT_TEXT = "#374151";

/**
 * Build short, readable initials from a display name. We keep this logic
 * centralized so avatar fallbacks stay consistent across the app.
 */
function getInitials(name?: string | null): string {
  if (!name) {
    return "?";
  }

  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/**
 * Generate a deterministic soft background color when the caller does not
 * provide one. This keeps initials avatars visually distinct without forcing
 * every caller to supply custom colors.
 */
function colorFromName(name?: string | null): string {
  if (!name) {
    return DEFAULT_BACKGROUND;
  }

  let hash = 0;
  for (let index = 0; index < name.length; index += 1) {
    hash = name.charCodeAt(index) + ((hash << 5) - hash);
  }

  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 88%)`;
}

function joinClasses(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export function Avatar({
  src,
  name,
  size = 36,
  className,
  backgroundColor,
  borderColor,
  textColor = DEFAULT_TEXT,
}: AvatarProps) {
  const [imageFailed, setImageFailed] = useState(false);

  const initials = useMemo(() => getInitials(name), [name]);
  const fallbackBackground = useMemo(
    () => backgroundColor ?? colorFromName(name) ?? DEFAULT_BACKGROUND,
    [backgroundColor, name],
  );

  const showImage = Boolean(src) && !imageFailed;

  return (
    <span
      className={joinClasses(
        "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full border border-black/5",
        className,
      )}
      style={{
        width: size,
        height: size,
        backgroundColor: showImage ? undefined : fallbackBackground,
        color: textColor,
        borderColor,
      }}
      title={name ?? "Avatar"}
      aria-label={name ?? "Avatar"}
    >
      {showImage ? (
        <img
          src={src ?? undefined}
          alt={name ? `${name} avatar` : "Avatar"}
          className="h-full w-full object-cover"
          onError={() => {
            // Broken or expired avatar URLs should degrade gracefully to the
            // initials fallback instead of leaving an empty UI shell.
            setImageFailed(true);
          }}
        />
      ) : (
        <span
          className="font-medium uppercase"
          style={{
            fontSize: Math.max(12, Math.floor(size * 0.38)),
            lineHeight: 1,
          }}
          aria-hidden="true"
        >
          {initials}
        </span>
      )}
    </span>
  );
}

export default Avatar;
