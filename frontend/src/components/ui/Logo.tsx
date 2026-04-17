import type { HTMLAttributes } from 'react';

import { cn } from '../../lib/utils';

type LogoSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

interface LogoProps extends HTMLAttributes<HTMLSpanElement> {
  size?: LogoSize;
  showWordmark?: boolean;
  tagline?: string;
  tone?: 'default' | 'invert';
}

const MARK_PX: Record<LogoSize, number> = {
  xs: 20,
  sm: 24,
  md: 32,
  lg: 40,
  xl: 56,
};

const WORD_CLASS: Record<LogoSize, string> = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-2xl',
  xl: 'text-3xl',
};

const TAGLINE_CLASS: Record<LogoSize, string> = {
  xs: 'text-[10px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-xs',
  xl: 'text-sm',
};

/**
 * Noted brand lockup. `LogoMark` renders just the glyph (for favicons, dense
 * UI chrome); `Logo` pairs it with the "Noted" wordmark and an optional
 * tagline for marketing surfaces.
 */
export function LogoMark({ size = 'md', className, ...rest }: { size?: LogoSize; className?: string } & HTMLAttributes<HTMLSpanElement>) {
  const px = MARK_PX[size];
  return (
    <span
      aria-hidden="true"
      className={cn('inline-flex shrink-0 items-center justify-center', className)}
      style={{ width: px, height: px }}
      {...rest}
    >
      <svg viewBox="0 0 40 40" width={px} height={px} xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="noted-logo-grad" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#6366f1" />
            <stop offset="100%" stopColor="#2563eb" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="10" fill="url(#noted-logo-grad)" />
        <path
          d="M12 28 V12 L26 28 V12"
          fill="none"
          stroke="#ffffff"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="30" cy="12" r="2.6" fill="#fbbf24" />
      </svg>
    </span>
  );
}

export function Logo({
  size = 'md',
  showWordmark = true,
  tagline,
  tone = 'default',
  className,
  ...rest
}: LogoProps) {
  const wordClass =
    tone === 'invert'
      ? 'text-white'
      : 'text-gray-900 dark:text-zinc-50';

  const taglineClass =
    tone === 'invert'
      ? 'text-white/70'
      : 'text-gray-500 dark:text-zinc-400';

  return (
    <span className={cn('inline-flex items-center gap-2', className)} {...rest}>
      <LogoMark size={size} />
      {showWordmark && (
        <span className="inline-flex flex-col leading-tight">
          <span
            className={cn(
              'font-semibold tracking-tight',
              WORD_CLASS[size],
              wordClass,
            )}
          >
            Noted
          </span>
          {tagline && (
            <span
              className={cn(
                'font-medium uppercase tracking-[0.14em]',
                TAGLINE_CLASS[size],
                taglineClass,
              )}
            >
              {tagline}
            </span>
          )}
        </span>
      )}
    </span>
  );
}

export default Logo;
