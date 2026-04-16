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
    <div className="max-w-3xl mx-auto space-y-8 pb-16">
      {attempt && (
        <div
          className="bg-blue-50 border border-blue-100 rounded-lg p-8 shadow-sm text-center"
          data-testid="quiz-score-summary"
        >
          <h2 className="text-2xl font-bold text-blue-900 mb-6">Quiz Results</h2>
          <div className="space-y-6">
            <div className="flex flex-col items-center justify-center space-y-2">
              <span className="text-6xl font-extrabold text-blue-600">{percentage}%</span>
              <span className="text-blue-800 font-medium text-lg">
                {attempt.correct_count} out of {attempt.total_questions} correct
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-3 max-w-md mx-auto">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-500 ease-out" 
                style={{ width: `${percentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      )}

      {!attempt && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 shadow-sm">
          <p className="text-gray-600 text-center font-medium">
            Reviewing correct answers for: <span className="text-gray-900">{quiz.title}</span>
          </p>
        </div>
      )}

      <div className="space-y-6">
        <h3 className="text-xl font-bold tracking-tight text-gray-900 px-1">Review Questions</h3>
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
