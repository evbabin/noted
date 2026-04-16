import { ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router-dom';

import { QuizGenerator } from '../components/quiz/QuizGenerator';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Spinner } from '../components/ui/Spinner';
import { useNote } from '../hooks/useNote';
import { useQuizzes } from '../hooks/useQuiz';

export function QuizPage() {
  const { noteId } = useParams<{ noteId: string }>();
  const navigate = useNavigate();

  // Fetch the note so we can show its title in the header and link back to it.
  // This route (/notes/:noteId/quizzes) doesn't include workspaceId, so we
  // can't build the full /workspaces/:wid/notes/:nid path; navigate(-1) handles
  // the back button instead.
  const { data: note } = useNote(noteId);
  const { data: quizzes, isLoading, isError } = useQuizzes(noteId ?? '');

  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-8">
      <div>
        <button
          onClick={() => navigate(-1)}
          className="mb-3 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to note
        </button>
        <h1 className="text-2xl font-bold text-gray-900">
          {note ? `Quizzes — ${note.title}` : 'Quizzes'}
        </h1>
        <p className="mt-2 text-gray-600">
          Generate a quiz based on your note&apos;s contents to test your knowledge.
        </p>
      </div>

      <QuizGenerator noteId={noteId ?? ''} />

      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Past Quizzes</h3>

        {isLoading ? (
          <div className="flex justify-center py-10">
            <Spinner className="w-6 h-6 text-blue-600" />
          </div>
        ) : isError ? (
          <p className="text-sm text-red-600 border border-red-200 bg-red-50 rounded-lg p-4">
            Failed to load quizzes. Please refresh and try again.
          </p>
        ) : quizzes && quizzes.length > 0 ? (
          <div className="space-y-3">
            {quizzes.map((quiz) => (
              <div
                key={quiz.id}
                className="flex items-center justify-between p-4 border rounded-lg bg-white shadow-sm"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <h4 className="font-medium text-gray-900 truncate">{quiz.title}</h4>
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
                  <p className="text-sm text-gray-500 mt-1">
                    {new Date(quiz.created_at).toLocaleDateString()}
                  </p>
                  {/* Show generation error details so the user knows what went wrong */}
                  {quiz.status === 'failed' && quiz.error_message && (
                    <p className="text-xs text-red-500 mt-1 truncate">
                      {quiz.error_message}
                    </p>
                  )}
                </div>
                {quiz.status === 'completed' && (
                  <Link to={`/quizzes/${quiz.id}`} className="ml-4 flex-shrink-0">
                    <Button variant="outline" size="sm">
                      Take Quiz
                    </Button>
                  </Link>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500 italic border border-dashed rounded-lg p-6 text-center">
            No quizzes generated yet. Generate your first one above!
          </p>
        )}
      </div>
    </div>
  );
}

export default QuizPage;
