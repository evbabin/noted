import client from './client';
import {
  QuizCreateRequest,
  QuizSummary,
  QuizResponse,
  QuizAttemptCreateRequest,
  QuizAttemptResponse,
} from '../types/api';

export const createQuiz = async (noteId: string, data: QuizCreateRequest): Promise<QuizSummary> => {
  const response = await client.post(`/notes/${noteId}/quizzes`, data);
  return response.data;
};

export const getQuizzesForNote = async (noteId: string): Promise<QuizSummary[]> => {
  const response = await client.get(`/notes/${noteId}/quizzes`);
  return response.data;
};

export const getQuiz = async (quizId: string): Promise<QuizResponse> => {
  const response = await client.get(`/quizzes/${quizId}`);
  return response.data;
};

export const submitQuizAttempt = async (
  quizId: string,
  data: QuizAttemptCreateRequest
): Promise<QuizAttemptResponse> => {
  const response = await client.post(`/quizzes/${quizId}/attempts`, data);
  return response.data;
};

export const getQuizAttempts = async (quizId: string): Promise<QuizAttemptResponse[]> => {
  const response = await client.get(`/quizzes/${quizId}/attempts`);
  return response.data;
};
