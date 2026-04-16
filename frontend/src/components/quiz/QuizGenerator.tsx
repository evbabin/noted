import React, { useState } from 'react';
import { isAxiosError } from 'axios';
import { useCreateQuiz, useQuizPolling } from '../../hooks/useQuiz';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Spinner } from '../ui/Spinner';
import { AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface QuizGeneratorProps {
  noteId: string;
}

export function QuizGenerator({ noteId }: QuizGeneratorProps) {
  const [title, setTitle] = useState('');
  const [numQuestions, setNumQuestions] = useState(10);
  // Tracks the quiz ID of the most recently triggered generation so we can poll it.
  // Null means no in-progress generation; setting it flips to the status view.
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null);

  const createQuiz = useCreateQuiz();
  const navigate = useNavigate();

  const { data: activeQuiz, error: pollError } = useQuizPolling(
    activeQuizId ?? '',
    !!activeQuizId
  );

  // Hide the form as soon as we have an active quiz ID — avoids a one-frame
  // flicker caused by activeQuiz being undefined before the first poll returns.
  const showForm = !activeQuizId;

  // Treat "no data yet" as still generating (covers the initial loading window
  // between setActiveQuizId and the first successful poll response).
  const isGenerating =
    !activeQuiz || activeQuiz.status === 'pending' || activeQuiz.status === 'generating';
  const isCompleted = activeQuiz?.status === 'completed';
  // Poll errors (network failures) surface the same failed UI as a FAILED status.
  const isFailed = activeQuiz?.status === 'failed' || (!activeQuiz && !!pollError);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    createQuiz.mutate(
      { noteId, data: { title: title.trim(), num_questions: numQuestions } },
      {
        onSuccess: (quiz) => {
          setActiveQuizId(quiz.id);
          setTitle('');
        },
      }
    );
  };

  return (
    <div className="rounded-lg border bg-white p-4 shadow-sm sm:p-6">
      <h3 className="text-lg font-medium text-gray-900 mb-4">Generate New Quiz</h3>

      {showForm ? (
        <div className="space-y-4">
          <form onSubmit={handleGenerate} className="flex flex-col gap-3 sm:flex-row">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Enter quiz title (e.g., 'Chapter 1 Review')"
              className="flex-1"
              data-testid="quiz-generator-title-input"
              disabled={createQuiz.isPending}
              required
            />
            <Button
              type="submit"
              data-testid="quiz-generator-submit"
              className="w-full sm:w-auto"
              disabled={createQuiz.isPending || !title.trim()}
            >
              {createQuiz.isPending && <Spinner className="w-4 h-4 mr-2" />}
              Generate
            </Button>
          </form>

          {/* Number-of-questions selector (backend range: 3–20) */}
          <div className="flex flex-col gap-2 text-sm text-gray-600 sm:flex-row sm:items-center sm:gap-3">
            <span className="whitespace-nowrap">
              Questions:{' '}
              <span className="font-semibold text-gray-900">{numQuestions}</span>
            </span>
            <div className="flex items-center gap-2 sm:flex-1">
              <span className="text-xs text-gray-400">3</span>
              <input
                type="range"
                min={3}
                max={20}
                step={1}
                value={numQuestions}
                onChange={(e) => setNumQuestions(Number(e.target.value))}
                className="flex-1 accent-blue-600"
                data-testid="quiz-generator-num-questions"
                disabled={createQuiz.isPending}
              />
              <span className="text-xs text-gray-400">20</span>
            </div>
          </div>

          {/* Creation error — e.g. rate limit exceeded (429) */}
          {createQuiz.isError && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-md">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">
                {getErrorDetail(createQuiz.error) ||
                  'Failed to start quiz generation. Please try again.'}
              </p>
            </div>
          )}
        </div>
      ) : (
        <div
          className="flex flex-col items-center py-6 text-center space-y-4"
          data-testid="quiz-generator-status"
        >
          {/* Show spinner for both the initial loading window and pending/generating states */}
          {isGenerating && !isFailed && (
            <>
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  {activeQuiz
                    ? `Generating: "${activeQuiz.title}"`
                    : 'Starting generation...'}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  This usually takes 15–30 seconds. Our AI is analyzing your
                  note&hellip;
                </p>
              </div>
            </>
          )}

          {isCompleted && (
            <>
              <CheckCircle2 className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm font-medium text-gray-900">
                  Quiz &ldquo;{activeQuiz!.title}&rdquo; generated successfully!
                </p>
              </div>
              <div className="mt-4 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button
                  data-testid="quiz-generator-take-quiz"
                  className="w-full sm:w-auto"
                  onClick={() => navigate(`/quizzes/${activeQuiz!.id}`)}
                >
                  Take Quiz Now
                </Button>
                <Button
                  variant="outline"
                  className="w-full sm:w-auto"
                  onClick={() => setActiveQuizId(null)}
                >
                  Generate Another
                </Button>
              </div>
            </>
          )}

          {isFailed && (
            <>
              <AlertCircle className="w-8 h-8 text-red-600" />
              <div>
                <p className="text-sm font-medium text-red-900">
                  Failed to generate quiz
                </p>
                <p className="text-sm text-red-600 mt-1">
                  {activeQuiz?.error_message ||
                    'An unknown error occurred during generation.'}
                </p>
              </div>
              <Button
                variant="outline"
                className="mt-4 w-full sm:w-auto"
                onClick={() => setActiveQuizId(null)}
              >
                Try Again
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  );
}

/** Safely extract a detail string from an Axios error response. */
function getErrorDetail(err: unknown): string | null {
  if (isAxiosError<{ detail?: string }>(err)) {
    const detail = err.response?.data?.detail;
    if (typeof detail === 'string') return detail;
  }
  return null;
}
