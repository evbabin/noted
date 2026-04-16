import { ChangeEvent } from 'react';
import { QuizQuestion } from '../../types/api';
import { FlashcardView } from './FlashcardView';
import { CheckCircle2, XCircle } from 'lucide-react';
import { Input } from '../ui/Input';

interface QuizCardProps {
  question: QuizQuestion;
  index: number;
  userAnswer?: string;
  onAnswer?: (answer: string) => void;
  showResults?: boolean;
  resultCorrect?: boolean;
}

function isAnswerCorrect(
  question: QuizQuestion,
  userAnswer?: string,
  resultCorrect?: boolean,
): boolean {
  if (typeof resultCorrect === 'boolean') {
    return resultCorrect;
  }

  if (!userAnswer) {
    return false;
  }

  const normalizedAnswer = userAnswer.trim().toLowerCase();
  if (
    question.question_type === 'flashcard' &&
    (normalizedAnswer === 'correct' || normalizedAnswer === 'incorrect')
  ) {
    return normalizedAnswer === 'correct';
  }

  return normalizedAnswer === question.correct_answer.trim().toLowerCase();
}

export function QuizCard({
  question,
  index,
  userAnswer,
  onAnswer,
  showResults,
  resultCorrect,
}: QuizCardProps) {
  const isCorrect = showResults
    ? isAnswerCorrect(question, userAnswer, resultCorrect)
    : false;

  const renderMultipleChoice = () => {
    // Backend stores MC options as { choices: string[] }, not a plain array
    const choices = question.options?.choices;
    if (!choices) return null;

    return (
      <div className="space-y-3 mt-4">
        {choices.map((option: string, i: number) => {
          let optionClass = "flex items-center space-x-3 p-4 border rounded-md transition-colors cursor-pointer w-full text-left";
          
          if (showResults) {
            if (option === question.correct_answer) {
              optionClass += " border-green-500 bg-green-50";
            } else if (option === userAnswer) {
              optionClass += " border-red-500 bg-red-50";
            } else {
              optionClass += " opacity-60 bg-gray-50";
            }
          } else if (userAnswer === option) {
            optionClass += " border-blue-500 bg-blue-50 ring-1 ring-blue-500";
          } else {
            optionClass += " hover:bg-gray-50 border-gray-200";
          }

          return (
            <label key={i} className={optionClass}>
              <input
                type="radio"
                name={`q-${question.id}`}
                value={option}
                checked={userAnswer === option}
                onChange={() => onAnswer?.(option)}
                disabled={showResults}
                className="w-4 h-4 text-blue-600 focus:ring-blue-500 border-gray-300"
              />
              <span className="font-normal text-base flex-1 text-gray-800">{option}</span>
              {showResults && option === question.correct_answer && (
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
              )}
              {showResults && option === userAnswer && option !== question.correct_answer && (
                <XCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
              )}
            </label>
          );
        })}
      </div>
    );
  };

  const renderFillInTheBlank = () => {
    return (
      <div className="mt-4 space-y-4">
        <Input
          type="text"
          placeholder="Type your answer here..."
          value={userAnswer || ''}
          onChange={(e: ChangeEvent<HTMLInputElement>) => onAnswer?.(e.target.value)}
          disabled={showResults}
          className={`text-lg p-6 w-full ${
            showResults
              ? isCorrect
                ? 'border-green-500 focus:border-green-500 focus:ring-green-500'
                : 'border-red-500 focus:border-red-500 focus:ring-red-500'
              : ''
          }`}
        />
        {showResults && !isCorrect && (
          <div className="p-4 bg-gray-50 rounded-md border border-gray-200 text-sm">
            <span className="font-semibold text-gray-700">Correct Answer: </span>
            <span className="text-green-600 font-medium">
              {question.correct_answer}
            </span>
          </div>
        )}
      </div>
    );
  };

  if (question.question_type === 'flashcard') {
    return (
      <div className="space-y-4 mb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Question {index + 1}</h3>
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-1 bg-gray-100 rounded-md">
            Flashcard
          </span>
        </div>
        <FlashcardView
          question={question.question_text}
          answer={question.correct_answer}
          userAnswer={userAnswer}
          onAnswer={onAnswer}
          showResults={showResults}
          resultCorrect={showResults ? isCorrect : undefined}
        />
        {showResults && question.explanation && (
          <div className="mt-4 p-4 bg-blue-50 rounded-md text-sm border border-blue-100">
            <p className="font-semibold mb-1 text-blue-900">Explanation:</p>
            <p className="text-blue-800">{question.explanation}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`w-full border rounded-lg p-6 bg-white shadow-sm mb-6 ${showResults ? (isCorrect ? 'border-green-200' : 'border-red-200') : 'border-gray-200'}`}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
          <span>Question {index + 1}</span>
          {showResults && (
            isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )
          )}
        </h3>
        <span className="text-xs font-medium text-gray-500 uppercase tracking-wider px-2 py-1 bg-gray-100 rounded-md">
          {question.question_type.replace(/_/g, ' ')}
        </span>
      </div>
      
      <p className="text-lg text-gray-800 mb-6">{question.question_text}</p>
      
      {question.question_type === 'multiple_choice' && renderMultipleChoice()}
      {question.question_type === 'fill_in_the_blank' && renderFillInTheBlank()}
      
      {showResults && question.explanation && (
        <div className="mt-6 p-4 bg-blue-50 rounded-md text-sm border border-blue-100">
          <p className="font-semibold mb-1 text-blue-900">Explanation:</p>
          <p className="text-blue-800">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
