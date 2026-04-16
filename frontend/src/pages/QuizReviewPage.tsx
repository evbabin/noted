import { Link, useParams } from 'react-router-dom';
import { AlertCircle, ArrowLeft } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { QuizCard } from '../components/quiz/QuizCard';
import { QuizReview } from '../components/quiz/QuizReview';
import { QuizResponse } from '../types/api';
import { useQuiz, useQuizSession } from '../hooks/useQuiz';

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
        <div className="flex justify-end">
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
        <div className="flex justify-between text-sm text-gray-500">
          <span>
            Question <span className="font-medium text-gray-900">{currentIndex + 1}</span>{' '}
            of {totalQuestions}
          </span>
          <span className="text-gray-400">
            {answeredCount} / {totalQuestions} answered
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
          <div
            className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
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
        <div className="flex items-center gap-2 rounded-md bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>Failed to submit quiz. Please try again.</span>
        </div>
      )}

      {/* Prev / Next / Submit navigation */}
      <div className="flex justify-between items-center pt-2">
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
  const { data: quiz, isLoading, error } = useQuiz(quizId ?? '');

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Spinner className="w-8 h-8 text-blue-600" />
      </div>
    );
  }

  if (error || !quiz) {
    return (
      <div className="p-6 text-center text-red-600">
        Failed to load quiz. Please try again.
      </div>
    );
  }

  // Guard: quiz might not be completed (e.g. user navigates here directly
  // while generation is still in progress).
  if (quiz.status !== 'completed' || quiz.questions.length === 0) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center space-y-4">
        <p className="text-gray-600">
          {quiz.status === 'failed'
            ? 'Quiz generation failed. Please go back and try again.'
            : 'Quiz is not ready yet — please wait for generation to complete.'}
        </p>
        <Link
          to={`/notes/${quiz.note_id}/quizzes`}
          className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:underline"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quizzes
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10 space-y-6">
      {/* Page header */}
      <div className="flex items-center gap-4">
        <Link
          to={`/notes/${quiz.note_id}/quizzes`}
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Quizzes
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
      </div>

      <QuizSession quiz={quiz} />
    </div>
  );
}

export default QuizReviewPage;
