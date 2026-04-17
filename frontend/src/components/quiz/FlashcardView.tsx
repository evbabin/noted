import { useState, MouseEvent } from 'react';
import { RefreshCw } from 'lucide-react';
import { Button } from '../ui/Button';

interface FlashcardViewProps {
  question: string;
  answer: string;
  userAnswer?: string;
  onAnswer?: (answer: string) => void;
  showResults?: boolean;
  resultCorrect?: boolean;
}

export function FlashcardView({
  question,
  answer,
  userAnswer,
  onAnswer,
  showResults,
  resultCorrect,
}: FlashcardViewProps) {
  const [isFlipped, setIsFlipped] = useState(showResults || false);

  const handleFlip = () => {
    if (!showResults) {
      setIsFlipped(!isFlipped);
    }
  };

  const handleSelfAssess = (knewIt: boolean) => {
    if (onAnswer) {
      onAnswer(knewIt ? 'correct' : 'incorrect');
    }
  };

  return (
    <div className="space-y-4">
      <div
        className={`relative flex min-h-[200px] w-full flex-col items-center justify-center rounded-lg border bg-white p-6 text-center shadow-sm transition-all duration-300 dark:border-zinc-800 dark:bg-zinc-900 ${
          !showResults ? 'cursor-pointer hover:shadow-md' : ''
        }`}
        onClick={handleFlip}
      >
        {!isFlipped ? (
          <div className="space-y-4 w-full">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Front</span>
            <p className="text-lg font-medium text-gray-900 dark:text-zinc-100">{question}</p>
            {!showResults && (
              <div className="absolute bottom-4 right-4 text-gray-400 dark:text-zinc-500">
                <RefreshCw className="h-5 w-5" />
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-4 w-full">
            <span className="mb-2 block text-sm font-semibold uppercase tracking-wider text-gray-500 dark:text-zinc-400">Back</span>
            <p className="text-lg text-gray-900 dark:text-zinc-100">{answer}</p>
          </div>
        )}
      </div>

      {isFlipped && !showResults && onAnswer && (
        <div className="flex justify-center space-x-4 animate-in fade-in slide-in-from-bottom-2">
          <Button
            variant={userAnswer === 'incorrect' ? 'destructive' : 'outline'}
            onClick={(e: MouseEvent) => { e.stopPropagation(); handleSelfAssess(false); }}
          >
            Didn't know it
          </Button>
          <Button
            variant={userAnswer === 'correct' ? 'default' : 'outline'}
            onClick={(e: MouseEvent) => { e.stopPropagation(); handleSelfAssess(true); }}
            className={userAnswer === 'correct' ? 'bg-green-600 hover:bg-green-700 text-white border-transparent' : ''}
          >
            Got it right
          </Button>
        </div>
      )}
      
      {showResults && (
        <div className="flex justify-center mt-2">
          <span
            className={`font-medium ${
              userAnswer == null
                ? "text-gray-600 dark:text-zinc-400"
                : resultCorrect
                  ? "text-green-600"
                  : "text-red-600"
            }`}
          >
            {userAnswer == null
              ? "No self-assessment submitted"
              : `You marked this as: ${
                  userAnswer === "correct" ? "Knew it" : "Didn't know it"
                }`}
          </span>
        </div>
      )}
    </div>
  );
}
