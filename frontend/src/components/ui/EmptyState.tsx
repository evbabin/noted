import type { ReactNode } from 'react';
import { Inbox } from 'lucide-react';

import { cn } from '../../lib/utils';

interface EmptyStateProps {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
  compact = false,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'rounded-xl border border-dashed border-gray-300 bg-white text-center dark:border-zinc-700 dark:bg-zinc-900',
        compact ? 'px-4 py-5' : 'px-6 py-10 sm:px-8 sm:py-14',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto flex items-center justify-center rounded-full bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-400',
          compact ? 'mb-3 h-10 w-10' : 'mb-4 h-12 w-12',
        )}
      >
        {icon ?? <Inbox className={compact ? 'h-5 w-5' : 'h-6 w-6'} />}
      </div>
      <div className="space-y-1">
        <p
          className={cn(
            'font-medium text-gray-900 dark:text-zinc-100',
            compact ? 'text-sm' : 'text-base',
          )}
        >
          {title}
        </p>
        {description && (
          <p
            className={cn(
              'mx-auto max-w-md text-gray-500 dark:text-zinc-400',
              compact ? 'text-xs' : 'text-sm',
            )}
          >
            {description}
          </p>
        )}
      </div>
      {action && <div className={compact ? 'mt-3' : 'mt-5'}>{action}</div>}
    </div>
  );
}

export default EmptyState;
