import { QuizResponse, QuizAttemptResponse, QuizQuestion } from '../../types/api';
import { QuizCard } from './QuizCard';

interface QuizReviewProps {
  quiz: QuizResponse;
  questions: QuizQuestion[];
  attempt?: QuizAttemptResponse;
}

export function QuizReview({ quiz, questions, attempt }: QuizReviewProps) {
  const percentage = attempt 
    ? Math.round((attempt.correct_count / attempt.total_questions) * 100)
    : null;

  return (
    <div className="mx-auto max-w-3xl space-y-8 pb-16">
      {attempt && (
        <div
          className="relative overflow-hidden rounded-2xl border border-brand-200 bg-brand-50 p-8 text-center shadow-sm dark:border-brand-500/30 dark:bg-brand-500/10"
          data-testid="quiz-score-summary"
        >
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-brand-gradient opacity-20 blur-3xl"
          />
          <div className="relative">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-brand-700 dark:text-brand-200">
              Quiz results
            </h2>
            <div className="mt-4 flex flex-col items-center justify-center space-y-2">
              <span className="bg-brand-gradient bg-clip-text text-6xl font-extrabold tracking-tight text-transparent">
                {percentage}%
              </span>
              <span className="text-base font-medium text-brand-900 dark:text-brand-100">
                {attempt.correct_count} out of {attempt.total_questions} correct
              </span>
            </div>
            <div className="mx-auto mt-6 h-3 w-full max-w-md overflow-hidden rounded-full bg-white/70 dark:bg-brand-500/20">
              <div
                className="h-3 rounded-full bg-brand-gradient transition-all duration-500 ease-out"
                style={{ width: `${percentage}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {!attempt && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-center font-medium text-gray-600 dark:text-zinc-300">
            Reviewing correct answers for: <span className="text-gray-900 dark:text-zinc-100">{quiz.title}</span>
          </p>
        </div>
      )}

      <div className="space-y-6">
        <h3 className="px-1 text-xl font-bold tracking-tight text-gray-900 dark:text-zinc-100">Review Questions</h3>
        {questions.map((question: QuizQuestion, index: number) => {
          const attemptAnswer = attempt?.answers[question.id];
          const userAnswer = attemptAnswer?.answer;
          
          return (
            <QuizCard
              key={question.id}
              question={question}
              index={index}
              userAnswer={userAnswer}
              resultCorrect={attemptAnswer?.correct}
              showResults={true}
            />
          );
        })}
      </div>
    </div>
  );
}
