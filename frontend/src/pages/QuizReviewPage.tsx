import { useParams } from 'react-router-dom';

export function QuizReviewPage() {
  const { quizId } = useParams();
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-xl font-semibold text-gray-900">Quiz {quizId}</h1>
      <p className="mt-2 text-gray-600">Interactive quiz review coming in Phase 5.</p>
    </div>
  );
}

export default QuizReviewPage;
