import { Link, useLocation, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { Spinner } from '../components/ui/Spinner';
import { AppShell } from '../components/layout/AppShell';
import { QuizCard } from '../components/quiz/QuizCard';
import { QuizReview } from '../components/quiz/QuizReview';
import { QuizResponse } from '../types/api';
import { useQuiz, useQuizSession } from '../hooks/useQuiz';
import { useWorkspace } from '../hooks/useWorkspace';

// ---------------------------------------------------------------------------
// Inner component: owns the session hook and renders the active phase.
// Kept separate from QuizReviewPage so that useQuizSession is only called
// after the quiz data has loaded (hooks must be called unconditionally but
// the quiz object must exist before the session can start).
// ---------------------------------------------------------------------------

function QuizSession({ quiz }: { quiz: QuizResponse }) {
  const {
    currentIndex,
    currentQuestion,
    totalQuestions,
    isFirstQuestion,
    isLastQuestion,
    progressFraction,
    answeredCount,
    currentAnswer,
    setAnswer,
    goToNext,
    goToPrev,
    phase,
    attempt,
    isSubmitting,
    submitError,
    submitQuiz,
    resetSession,
  } = useQuizSession(quiz);

  // ── Review phase: show scored results + retake option ───────────────────
  if (phase === 'review' && attempt) {
    return (
      <div className="space-y-6">
        <div className="flex justify-start sm:justify-end">
          <Button variant="outline" size="sm" onClick={resetSession}>
            Retake Quiz
          </Button>
        </div>
        <QuizReview quiz={quiz} questions={quiz.questions} attempt={attempt} />
      </div>
    );
  }

  // ── Taking phase: one question at a time with progress + navigation ─────
  return (
    <div className="space-y-6">
      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex flex-col gap-1 text-sm text-gray-500 dark:text-zinc-400 sm:flex-row sm:items-center sm:justify-between">
          <span>
            Question{' '}
            <span className="font-semibold text-gray-900 dark:text-zinc-100">
              {currentIndex + 1}
            </span>{' '}
            of {totalQuestions}
          </span>
          <span className="text-gray-400 dark:text-zinc-500">
            {answeredCount} / {totalQuestions} answered
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-zinc-800">
          <div
            className="h-1.5 rounded-full bg-brand-gradient transition-all duration-300 ease-out"
            style={{ width: `${progressFraction * 100}%` }}
          />
        </div>
      </div>

      {/* Active question card (interactive — answers not revealed yet) */}
      <QuizCard
        question={currentQuestion}
        index={currentIndex}
        userAnswer={currentAnswer}
        onAnswer={setAnswer}
        showResults={false}
      />

      {/* Inline submission error */}
      {submitError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
        >
          <AlertCircle className="h-4 w-4 flex-shrink-0" />
          <span>Failed to submit quiz. Please try again.</span>
        </div>
      )}

      {/* Prev / Next / Submit navigation */}
      <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="outline"
          onClick={goToPrev}
          disabled={isFirstQuestion || isSubmitting}
        >
          Previous
        </Button>

        {isLastQuestion ? (
          <Button onClick={submitQuiz} disabled={isSubmitting}>
            {isSubmitting && <Spinner className="w-4 h-4 mr-2" />}
            Submit Quiz
          </Button>
        ) : (
          <Button onClick={goToNext} disabled={isSubmitting}>
            Next
          </Button>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page component: loads quiz data, guards edge cases, renders QuizSession.
// ---------------------------------------------------------------------------

export function QuizReviewPage() {
  const { quizId } = useParams();
  const { state } = useLocation();
  const workspaceId: string | undefined = state?.workspaceId;
  const noteIdFromState: string | undefined = state?.noteId;

  const { data: quiz, isLoading, error } = useQuiz(quizId ?? '');
  const { data: workspace } = useWorkspace(workspaceId);

  // Prefer noteId from state; fall back to quiz.note_id once loaded.
  const noteId = noteIdFromState ?? quiz?.note_id;
  const quizListUrl = noteId ? `/notes/${noteId}/quizzes` : '/dashboard';
  const quizListState = workspaceId ? { workspaceId, noteId } : undefined;

  const wrap = (node: React.ReactNode) =>
    workspaceId ? (
      <AppShell workspaceId={workspaceId} workspaceName={workspace?.name}>
        {node}
      </AppShell>
    ) : (
      <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">{node}</div>
    );

  if (isLoading) {
    return wrap(
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <LoadingState
          title="Loading quiz…"
          message="Fetching questions and the latest attempt history."
        />
      </div>,
    );
  }

  if (error || !quiz) {
    return wrap(
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <EmptyState
          title="Quiz unavailable"
          description="We couldn't load this quiz right now. Please go back and try again."
          action={
            <Link
              to={quizListUrl}
              state={quizListState}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Quizzes
            </Link>
          }
        />
      </div>,
    );
  }

  // Guard: quiz might not be completed (e.g. user navigates here directly
  // while generation is still in progress).
  if (quiz.status !== 'completed' || quiz.questions.length === 0) {
    return wrap(
      <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-10">
        <EmptyState
          title={quiz.status === 'failed' ? 'Quiz generation failed' : 'Quiz is not ready yet'}
          description={
            quiz.status === 'failed'
              ? 'Generation did not complete successfully. Return to the quiz list and try again.'
              : 'This quiz is still being generated. Return to the quiz list and check back in a moment.'
          }
          action={
            <Link
              to={quizListUrl}
              state={quizListState}
              className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Quizzes
            </Link>
          }
        />
      </div>,
    );
  }

  return wrap(
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      {/* Page header */}
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:gap-4">
        <Link
          to={quizListUrl}
          state={quizListState}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 transition-colors hover:text-gray-900 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quizzes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">{quiz.title}</h1>
      </div>

      <QuizSession quiz={quiz} />
    </div>,
  );
}

export default QuizReviewPage;
