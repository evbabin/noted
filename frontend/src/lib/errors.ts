import { isAxiosError } from 'axios';

import type { ApiError } from '../types/api';

export interface ErrorHandlingMeta extends Record<string, unknown> {
  errorMessage?: string;
  suppressErrorToast?: boolean;
}

interface ValidationIssue {
  loc?: unknown;
  msg?: unknown;
}

function formatValidationIssue(issue: ValidationIssue): string | null {
  if (typeof issue.msg !== 'string' || issue.msg.trim().length === 0) {
    return null;
  }

  if (!Array.isArray(issue.loc) || issue.loc.length === 0) {
    return issue.msg;
  }

  const path = issue.loc
    .map((segment) => String(segment))
    .join('.');

  return path ? `${path}: ${issue.msg}` : issue.msg;
}

export function extractErrorDetail(error: unknown): string | null {
  if (isAxiosError<ApiError>(error)) {
    const detail = error.response?.data?.detail;

    if (typeof detail === 'string' && detail.trim().length > 0) {
      return detail;
    }

    if (Array.isArray(detail)) {
      const issues = detail
        .map((issue) =>
          typeof issue === 'object' && issue !== null
            ? formatValidationIssue(issue as ValidationIssue)
            : null,
        )
        .filter((issue): issue is string => issue !== null);

      if (issues.length > 0) {
        return issues.join(', ');
      }
    }

    if (typeof error.message === 'string' && error.message.trim().length > 0) {
      return error.message;
    }
  }

  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  return null;
}

export function getErrorStatus(error: unknown): number | null {
  if (!isAxiosError(error)) {
    return null;
  }

  return error.response?.status ?? null;
}

export function isRetryableError(error: unknown): boolean {
  if (isAxiosError(error) && error.code === 'ERR_CANCELED') {
    return false;
  }

  const status = getErrorStatus(error);
  if (status === null) {
    return true;
  }

  return status === 408 || status === 429 || status >= 500;
}

export function shouldRetryRequest(
  failureCount: number,
  error: unknown,
  maxRetries = 2,
): boolean {
  return failureCount < maxRetries && isRetryableError(error);
}
