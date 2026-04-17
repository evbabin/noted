import { BrainCircuit } from 'lucide-react';
import { Link, useLocation, useParams } from 'react-router-dom';

import { AppShell } from '../components/layout/AppShell';
import { QuizGenerator } from '../components/quiz/QuizGenerator';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { LoadingState } from '../components/ui/LoadingState';
import { useNote } from '../hooks/useNote';
import { useQuizzes } from '../hooks/useQuiz';
import { useWorkspace } from '../hooks/useWorkspace';

export function QuizPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const { state } = useLocation();
  const workspaceId: string | undefined = state?.workspaceId;

  const { data: note } = useNote(noteId);
  const { data: workspace } = useWorkspace(workspaceId);
  const { data: quizzes, isLoading, isError, refetch } = useQuizzes(noteId ?? '');

  const noteUrl = workspaceId && noteId
    ? `/workspaces/${workspaceId}/notes/${noteId}`
    : '/dashboard';

  const content = (
    <div className="mx-auto max-w-4xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
      <div>
        <Link
          to={noteUrl}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-gray-500 transition hover:text-brand-600 dark:text-zinc-400 dark:hover:text-brand-300"
        >
          ← Back to note
        </Link>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-gradient text-white shadow-sm">
            <BrainCircuit className="h-5 w-5" />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand-600 dark:text-brand-300">
              AI quizzes
            </p>
            <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100 sm:text-3xl">
              {note ? note.title : 'Quizzes'}
            </h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-gray-600 dark:text-zinc-300">
          Generate a quiz from this note&apos;s content to test your recall. Each quiz mixes
          multiple choice, fill-in-the-blank, and flashcards.
        </p>
      </div>

      <QuizGenerator noteId={noteId ?? ''} />

      <div>
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.16em] text-gray-500 dark:text-zinc-400">
          Past quizzes
        </h3>

        {isLoading ? (
          <LoadingState
            title="Loading quizzes…"
            message="Fetching previous quiz runs for this note."
          />
        ) : isError ? (
          <div
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-950/40 dark:text-red-300"
          >
            Failed to load quizzes.{' '}
            <button
              type="button"
              onClick={() => refetch()}
              className="font-medium underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        ) : quizzes && quizzes.length > 0 ? (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex flex-col gap-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm transition hover:border-brand-300 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-brand-500/40 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-3">
                    <h4 className="truncate font-semibold text-gray-900 dark:text-zinc-100">
                      {quiz.title}
                    </h4>
                    <Badge
                      variant={
                        quiz.status === 'completed'
                          ? 'success'
                          : quiz.status === 'failed'
                            ? 'destructive'
                            : 'secondary'
                      }
                    >
                      {quiz.status}
                    </Badge>
                  </div>
                  <p className="mt-1 text-sm text-gray-500 dark:text-zinc-400">
                    Created {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                  {quiz.status === 'failed' && quiz.error_message && (
                    <p className="mt-1 truncate text-xs text-red-500 dark:text-red-300">
                      {quiz.error_message}
                    </p>
                  )}
                </div>
                {quiz.status === 'completed' && (
                  <Link
                    to={`/quizzes/${quiz.id}`}
                    state={{ workspaceId, noteId }}
                    className="w-full flex-shrink-0 sm:ml-4 sm:w-auto"
                  >
                    <Button variant="outline" size="sm" className="w-full sm:w-auto">
                      Take quiz
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<BrainCircuit className="h-6 w-6" />}
            title="No quizzes generated yet"
            description="Generate your first quiz above to turn this note into an active recall session."
          />
        )}
      </div>
    </div>
  );

  if (workspaceId) {
    return (
      <AppShell workspaceId={workspaceId} workspaceName={workspace?.name}>
        {content}
      </AppShell>
    );
  }

  return <div className="min-h-screen bg-gray-50 dark:bg-zinc-950">{content}</div>;
}

export default QuizPage;
