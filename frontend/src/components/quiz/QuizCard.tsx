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
          let optionClass =
            'flex w-full cursor-pointer items-center space-x-3 rounded-md border p-4 text-left transition-colors';
          
          if (showResults) {
            if (option === question.correct_answer) {
              optionClass += ' border-green-500 bg-green-50 dark:bg-green-950/30';
            } else if (option === userAnswer) {
              optionClass += ' border-red-500 bg-red-50 dark:bg-red-950/30';
            } else {
              optionClass += ' bg-gray-50 opacity-60 dark:bg-zinc-950';
            }
          } else if (userAnswer === option) {
            optionClass += ' border-blue-500 bg-blue-50 ring-1 ring-blue-500 dark:bg-blue-500/10';
          } else {
            optionClass += ' border-gray-200 hover:bg-gray-50 dark:border-zinc-800 dark:hover:bg-zinc-800';
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
                className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-zinc-700"
              />
              <span className="flex-1 text-base font-normal text-gray-800 dark:text-zinc-200">{option}</span>
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
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm dark:border-zinc-800 dark:bg-zinc-950">
            <span className="font-semibold text-gray-700 dark:text-zinc-300">Correct Answer: </span>
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">Question {index + 1}</h3>
          <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
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
          <div className="mt-4 rounded-md border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="mb-1 font-semibold text-blue-900 dark:text-blue-200">Explanation:</p>
            <p className="text-blue-800 dark:text-blue-100">{question.explanation}</p>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`mb-6 w-full rounded-lg border bg-white p-6 shadow-sm dark:bg-zinc-900 ${showResults ? (isCorrect ? 'border-green-200 dark:border-green-500/30' : 'border-red-200 dark:border-red-500/30') : 'border-gray-200 dark:border-zinc-800'}`}>
      <div className="mb-4 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 dark:text-zinc-100">
          <span>Question {index + 1}</span>
          {showResults && (
            isCorrect ? (
              <CheckCircle2 className="h-5 w-5 text-green-500" />
            ) : (
              <XCircle className="h-5 w-5 text-red-500" />
            )
          )}
        </h3>
        <span className="rounded-md bg-gray-100 px-2 py-1 text-xs font-medium uppercase tracking-wider text-gray-500 dark:bg-zinc-800 dark:text-zinc-400">
          {question.question_type.replace(/_/g, ' ')}
        </span>
      </div>
      
      <p className="mb-6 text-lg text-gray-800 dark:text-zinc-200">{question.question_text}</p>
      
      {question.question_type === 'multiple_choice' && renderMultipleChoice()}
      {question.question_type === 'fill_in_the_blank' && renderFillInTheBlank()}
      
      {showResults && question.explanation && (
        <div className="mt-6 rounded-md border border-blue-100 bg-blue-50 p-4 text-sm dark:border-blue-500/20 dark:bg-blue-500/10">
          <p className="mb-1 font-semibold text-blue-900 dark:text-blue-200">Explanation:</p>
          <p className="text-blue-800 dark:text-blue-100">{question.explanation}</p>
        </div>
      )}
    </div>
  );
}
