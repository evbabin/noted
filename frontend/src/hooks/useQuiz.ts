import { useCallback, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createQuiz,
  getQuizzesForNote,
  getQuiz,
  submitQuizAttempt,
  getQuizAttempts,
} from '../api/quizzes';
import type { ErrorHandlingMeta } from '../lib/errors';
import {
  QuizAttemptCreateRequest,
  QuizAttemptResponse,
  QuizCreateRequest,
  QuizQuestion,
  QuizResponse,
} from '../types/api';

const quizzesErrorMeta: ErrorHandlingMeta = {
  errorMessage: 'Failed to load quizzes.',
};

const quizErrorMeta: ErrorHandlingMeta = {
  errorMessage: 'Failed to load quiz.',
};

// ---------------------------------------------------------------------------
// Server-state hooks (React Query wrappers)
// ---------------------------------------------------------------------------

export const useQuizzes = (noteId: string) => {
  return useQuery({
    queryKey: ['quizzes', noteId],
    queryFn: () => getQuizzesForNote(noteId),
    enabled: !!noteId,
    meta: quizzesErrorMeta,
  });
};

export const useQuiz = (quizId: string) => {
  return useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
    enabled: !!quizId,
    meta: quizErrorMeta,
  });
};

/**
 * Like useQuiz, but auto-refetches every 2 seconds until the quiz reaches a
 * terminal state (completed or failed). Pass shouldPoll=false to disable the
 * interval (e.g. if you just want a one-shot fetch with the shared cache key).
 */
export const useQuizPolling = (quizId: string, shouldPoll: boolean) => {
  return useQuery({
    queryKey: ['quiz', quizId],
    queryFn: () => getQuiz(quizId),
    enabled: !!quizId,
    meta: {
      errorMessage: 'Failed to refresh quiz status.',
      suppressErrorToast: true,
    },
    refetchInterval: (query) => {
      const isTerminal =
        query.state.data?.status === 'completed' ||
        query.state.data?.status === 'failed';
      return shouldPoll && !isTerminal ? 2000 : false;
    },
  });
};

export const useCreateQuiz = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ noteId, data }: { noteId: string; data: QuizCreateRequest }) =>
      createQuiz(noteId, data),
    meta: { errorMessage: 'Failed to start quiz generation.' },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quizzes', variables.noteId] });
    },
  });
};

export const useSubmitQuizAttempt = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ quizId, data }: { quizId: string; data: QuizAttemptCreateRequest }) =>
      submitQuizAttempt(quizId, data),
    meta: { errorMessage: 'Failed to submit quiz.' },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['quiz-attempts', variables.quizId] });
    },
  });
};

export const useQuizAttempts = (quizId: string) => {
  return useQuery({
    queryKey: ['quiz-attempts', quizId],
    queryFn: () => getQuizAttempts(quizId),
    enabled: !!quizId,
    meta: {
      errorMessage: 'Failed to load quiz attempts.',
    },
  });
};

// ---------------------------------------------------------------------------
// Local quiz-session state hook
// ---------------------------------------------------------------------------

/** Lifecycle phase for an active quiz session. */
export type QuizPhase = 'taking' | 'review';

export interface UseQuizSessionReturn {
  // Current position in the question list
  currentIndex: number;
  currentQuestion: QuizQuestion;
  totalQuestions: number;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  /**
   * (currentIndex + 1) / totalQuestions — drives the progress bar width.
   * Always in [0, 1].
   */
  progressFraction: number;

  // Per-question answers collected so far
  answers: Record<string, string>;
  /** Shortcut for answers[currentQuestion.id] */
  currentAnswer: string | undefined;
  /** How many distinct questions have been answered at least once */
  answeredCount: number;

  // Actions
  setAnswer: (answer: string) => void;
  goToNext: () => void;
  goToPrev: () => void;

  // Submission
  phase: QuizPhase;
  attempt: QuizAttemptResponse | null;
  isSubmitting: boolean;
  submitError: Error | null;
  submitQuiz: () => Promise<void>;
  /** Reset to the start so the user can retake without remounting. */
  resetSession: () => void;
}

/**
 * Manages all client-side state for an interactive quiz session.
 *
 * Designed to be called once the quiz data is available (i.e. after
 * `useQuiz` resolves). The caller owns the phase transitions:
 *
 *   taking  →  (submitQuiz)  →  review
 *   review  →  (resetSession) →  taking
 *
 * Score computation is done server-side; `attempt` holds the result once
 * submitted.
 */
export function useQuizSession(quiz: QuizResponse): UseQuizSessionReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  // answers maps question_id → user's response string
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [phase, setPhase] = useState<QuizPhase>('taking');
  const [attempt, setAttempt] = useState<QuizAttemptResponse | null>(null);

  const submitMutation = useSubmitQuizAttempt();

  const questions = quiz.questions;
  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];
  const isFirstQuestion = currentIndex === 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  // Record the user's answer for the currently visible question.
  // For MC this is called once on click; for FITB on every keystroke.
  const setAnswer = useCallback(
    (answer: string) => {
      if (!currentQuestion) return;
      setAnswers((prev) => ({ ...prev, [currentQuestion.id]: answer }));
    },
    [currentQuestion],
  );

  const goToNext = useCallback(() => {
    setCurrentIndex((i) => Math.min(i + 1, totalQuestions - 1));
  }, [totalQuestions]);

  const goToPrev = useCallback(() => {
    setCurrentIndex((i) => Math.max(i - 1, 0));
  }, []);

  /**
   * POST the collected answers to the API. On success, transitions to the
   * 'review' phase with the attempt data. On error, stays in 'taking' so the
   * user can retry; submitMutation.error carries the reason.
   */
  const submitQuiz = useCallback(async () => {
    try {
      const result = await submitMutation.mutateAsync({
        quizId: quiz.id,
        data: { answers },
      });
      setAttempt(result);
      setPhase('review');
    } catch {
      // submitMutation.error is populated; phase remains 'taking' so the UI
      // can display an inline error and let the user retry.
    }
  }, [quiz.id, answers, submitMutation]);

  /** Wipe all session state so the user can retake the same quiz. */
  const resetSession = useCallback(() => {
    setCurrentIndex(0);
    setAnswers({});
    setPhase('taking');
    setAttempt(null);
    submitMutation.reset();
  }, [submitMutation]);

  return {
    currentIndex,
    currentQuestion,
    totalQuestions,
    isFirstQuestion,
    isLastQuestion,
    progressFraction: totalQuestions > 0 ? (currentIndex + 1) / totalQuestions : 0,
    answers,
    currentAnswer: currentQuestion ? answers[currentQuestion.id] : undefined,
    answeredCount: Object.keys(answers).length,
    setAnswer,
    goToNext,
    goToPrev,
    phase,
    attempt,
    isSubmitting: submitMutation.isPending,
    submitError: submitMutation.error as Error | null,
    submitQuiz,
    resetSession,
  };
}
