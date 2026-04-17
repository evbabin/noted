import { Spinner } from './Spinner';
import { cn } from '../../lib/utils';

interface LoadingStateProps {
  title?: string;
  message?: string;
  className?: string;
  compact?: boolean;
}

export function LoadingState({
  title = 'Loading…',
  message,
  className,
  compact = false,
}: LoadingStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-white text-center shadow-sm dark:border-zinc-800 dark:bg-zinc-900',
        compact ? 'gap-2 px-4 py-5' : 'gap-3 px-6 py-10 sm:px-8 sm:py-14',
        className,
      )}
    >
      <Spinner className={compact ? 'h-5 w-5 text-blue-600' : 'h-8 w-8 text-blue-600'} />
      <div className="space-y-1">
        <p
          className={cn(
            'font-medium text-gray-900 dark:text-zinc-100',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {title}
        </p>
        {message && (
          <p
            className={cn(
              'text-gray-500 dark:text-zinc-400',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {message}
          </p>
        )}
      </div>
    </div>
  );
}

export default LoadingState;
