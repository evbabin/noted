import { useParams } from 'react-router-dom';

export function QuizPage() {
  const { noteId } = useParams();
  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Quizzes for note {noteId}</h1>
      <p className="mt-2 text-gray-600">Quiz list + generation trigger coming in Phase 5.</p>
    </div>
  );
}

export default QuizPage;
