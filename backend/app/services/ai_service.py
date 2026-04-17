"""Provider-agnostic AI client for quiz generation.

Supports OpenAI (default), Gemini, and Groq. The provider is chosen via
`settings.AI_PROVIDER`; each provider talks to its own SDK but returns the
same normalized `list[dict]` shape consumed by `quiz_tasks.generate_quiz_task`.

Each returned question dict matches `QuizQuestion` model columns:
    {
        "question_type": "multiple_choice" | "fill_in_the_blank" | "flashcard",
        "question_text": str,
        "options": dict | None,         # e.g. {"choices": ["A", "B", "C", "D"]} for MC
        "correct_answer": str,
        "explanation": str | None,
    }
"""

from __future__ import annotations

import json
import logging
from typing import Any, Protocol

from fastapi import status

from app.config import Settings, get_settings
from app.exceptions import NotedException
from app.models.quiz import QuestionType

logger = logging.getLogger(__name__)


class AIServiceError(NotedException):
    status_code = status.HTTP_502_BAD_GATEWAY
    detail = "AI generation failed"


_VALID_TYPES = {qt.value for qt in QuestionType}

_QUIZ_SYSTEM_PROMPT = """You are an expert study-aid generator. You read a
student's note and create a mixed quiz that tests recall and understanding of
its content.

Produce a mix of three question types across the set:
  - multiple_choice: exactly 4 plausible options, one correct. Put options in
    `options.choices` (array of 4 strings). `correct_answer` must match one of
    the choices verbatim.
  - fill_in_the_blank: the question text contains one `___` blank.
    `correct_answer` is the missing word or short phrase. `options` is null.
  - flashcard: open-ended prompt whose `correct_answer` is the answer text the
    student should recall. `options` is null.

Every question must:
  - Be directly answerable from the note — no outside knowledge.
  - Include an `explanation` grounded in the note (one or two sentences).
  - Be self-contained (do not reference "the note" or "above").

Return ONLY a JSON object matching the requested schema. No prose, no code
fences."""


def _build_user_prompt(content: str, num_questions: int) -> str:
    return (
        f"Generate {num_questions} questions from the note below. "
        "Mix question types roughly evenly.\n\n"
        f"<note>\n{content}\n</note>"
    )


def _normalize_question(raw: dict[str, Any], index: int) -> dict[str, Any]:
    """Validate and coerce one question into the QuizQuestion column shape."""
    qtype = raw.get("question_type") or raw.get("type")
    if qtype not in _VALID_TYPES:
        raise AIServiceError(f"Question {index}: invalid question_type {qtype!r}")

    question_text = (raw.get("question_text") or raw.get("question") or "").strip()
    correct_answer = (raw.get("correct_answer") or raw.get("answer") or "").strip()
    if not question_text or not correct_answer:
        raise AIServiceError(
            f"Question {index}: missing question_text or correct_answer"
        )

    options = raw.get("options")
    if qtype == QuestionType.MULTIPLE_CHOICE.value:
        choices = None
        if isinstance(options, dict):
            choices = options.get("choices")
        elif isinstance(options, list):
            choices = options
        if not isinstance(choices, list) or len(choices) != 4:
            raise AIServiceError(
                f"Question {index}: multiple_choice requires exactly 4 options"
            )
        if correct_answer not in choices:
            raise AIServiceError(
                f"Question {index}: correct_answer must match one of the choices"
            )
        options = {"choices": [str(c) for c in choices]}
    else:
        options = None

    explanation = raw.get("explanation")
    if isinstance(explanation, str):
        explanation = explanation.strip() or None

    return {
        "question_type": qtype,
        "question_text": question_text,
        "options": options,
        "correct_answer": correct_answer,
        "explanation": explanation,
    }


def _normalize_quiz(payload: Any, num_questions: int) -> list[dict[str, Any]]:
    if isinstance(payload, dict):
        questions = payload.get("questions")
    else:
        questions = payload
    if not isinstance(questions, list) or not questions:
        raise AIServiceError("AI response did not contain a non-empty questions array")

    normalized = [_normalize_question(q, i) for i, q in enumerate(questions)]

    # Trim overruns; underruns are tolerated as long as we got something back.
    return normalized[:num_questions] if len(normalized) > num_questions else normalized


class AIProvider(Protocol):
    """Contract every provider implementation must satisfy."""

    async def generate_quiz_from_content(
        self,
        content: str,
        num_questions: int = 10,
    ) -> list[dict[str, Any]]: ...


class OpenAIProvider:
    """Uses the OpenAI Chat Completions API with guaranteed-JSON responses.

    Also serves as the base for Groq, which exposes an OpenAI-compatible API.
    """

    def __init__(self, api_key: str, model: str, base_url: str | None = None):
        if not api_key:
            raise AIServiceError("OpenAI-compatible provider requires an API key")
        from openai import AsyncOpenAI

        self._model = model
        self._client = AsyncOpenAI(api_key=api_key, base_url=base_url)

    async def generate_quiz_from_content(
        self,
        content: str,
        num_questions: int = 10,
    ) -> list[dict[str, Any]]:
        content = (content or "").strip()
        if not content:
            raise AIServiceError("Note content is empty")

        try:
            response = await self._client.chat.completions.create(
                model=self._model,
                response_format={"type": "json_object"},
                max_tokens=4096,
                messages=[
                    {"role": "system", "content": _QUIZ_SYSTEM_PROMPT},
                    {"role": "user", "content": _build_user_prompt(content, num_questions)},
                ],
            )
        except Exception as exc:
            logger.exception("OpenAI-compatible chat completion failed")
            raise AIServiceError(f"AI request failed: {exc}") from exc

        raw = response.choices[0].message.content or ""
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIServiceError(f"AI returned invalid JSON: {exc}") from exc

        return _normalize_quiz(payload, num_questions)


class GroqProvider(OpenAIProvider):
    """Groq exposes an OpenAI-compatible endpoint; reuse the OpenAI SDK."""

    def __init__(self, api_key: str, model: str):
        super().__init__(
            api_key=api_key,
            model=model,
            base_url="https://api.groq.com/openai/v1",
        )


class OpenRouterProvider(OpenAIProvider):
    """OpenRouter exposes an OpenAI-compatible endpoint; reuse the OpenAI SDK."""

    def __init__(self, api_key: str, model: str):
        super().__init__(
            api_key=api_key,
            model=model,
            base_url="https://openrouter.ai/api/v1",
        )


class GeminiProvider:
    """Google Gemini via the `google-genai` SDK.

    Uses `response_mime_type="application/json"` to force valid JSON output.
    """

    def __init__(self, api_key: str, model: str):
        if not api_key:
            raise AIServiceError("Gemini provider requires an API key")
        from google import genai  # type: ignore[import-untyped]

        self._model = model
        self._client = genai.Client(api_key=api_key)

    async def generate_quiz_from_content(
        self,
        content: str,
        num_questions: int = 10,
    ) -> list[dict[str, Any]]:
        content = (content or "").strip()
        if not content:
            raise AIServiceError("Note content is empty")

        from google.genai import types as genai_types  # type: ignore[import-untyped]

        prompt = f"{_QUIZ_SYSTEM_PROMPT}\n\n{_build_user_prompt(content, num_questions)}"

        try:
            response = await self._client.aio.models.generate_content(
                model=self._model,
                contents=prompt,
                config=genai_types.GenerateContentConfig(
                    response_mime_type="application/json",
                    max_output_tokens=4096,
                ),
            )
        except Exception as exc:
            logger.exception("Gemini generate_content failed")
            raise AIServiceError(f"AI request failed: {exc}") from exc

        raw = getattr(response, "text", None) or ""
        try:
            payload = json.loads(raw)
        except json.JSONDecodeError as exc:
            raise AIServiceError(f"AI returned invalid JSON: {exc}") from exc

        return _normalize_quiz(payload, num_questions)


class MockProvider:
    """Deterministic quiz provider used for local verification and E2E tests.

    The real providers depend on external API keys and network calls, which makes
    browser-level verification fragile. This provider stays opt-in via
    ``AI_PROVIDER=mock`` and returns a stable question set that exercises all
    supported question types.
    """

    async def generate_quiz_from_content(
        self,
        content: str,
        num_questions: int = 10,
    ) -> list[dict[str, Any]]:
        content = (content or "").strip()
        if not content:
            raise AIServiceError("Note content is empty")

        excerpt = " ".join(content.split())
        if len(excerpt) > 80:
            excerpt = f"{excerpt[:77].rstrip()}..."

        questions: list[dict[str, Any]] = []
        for index in range(max(1, num_questions)):
            number = index + 1
            question_type = (
                QuestionType.MULTIPLE_CHOICE.value
                if index % 3 == 0
                else QuestionType.FILL_IN_THE_BLANK.value
                if index % 3 == 1
                else QuestionType.FLASHCARD.value
            )

            if question_type == QuestionType.MULTIPLE_CHOICE.value:
                questions.append(
                    {
                        "question_type": question_type,
                        "question_text": (
                            f"Which deterministic answer matches question {number}?"
                        ),
                        "options": {
                            "choices": [
                                f"Correct Answer {number}",
                                f"Distractor {number}A",
                                f"Distractor {number}B",
                                f"Distractor {number}C",
                            ]
                        },
                        "correct_answer": f"Correct Answer {number}",
                        "explanation": (
                            "Mock generation keeps verification stable while still "
                            f"basing the quiz on the note excerpt: {excerpt}"
                        ),
                    }
                )
                continue

            if question_type == QuestionType.FILL_IN_THE_BLANK.value:
                questions.append(
                    {
                        "question_type": question_type,
                        "question_text": (
                            f"Type the verification token for question {number}: ___"
                        ),
                        "options": None,
                        "correct_answer": f"answer-{number}",
                        "explanation": (
                            "This deterministic blank makes the poll-and-submit flow "
                            "verifiable without an external AI dependency."
                        ),
                    }
                )
                continue

            questions.append(
                {
                    "question_type": question_type,
                    "question_text": (
                        f"What recall phrase should you use for question {number}?"
                    ),
                    "options": None,
                    "correct_answer": f"Flashcard answer {number}",
                    "explanation": (
                        "Flashcards are self-graded in the UI, so the backend stores "
                        "whether the learner marked this as known."
                    ),
                }
            )

        return _normalize_quiz({"questions": questions}, num_questions)


def get_ai_provider(settings: Settings | None = None) -> AIProvider:
    """Factory — pick the provider implementation based on settings.AI_PROVIDER."""
    settings = settings or get_settings()
    provider = (settings.AI_PROVIDER or "openai").lower()

    if provider == "openai":
        return OpenAIProvider(api_key=settings.OPENAI_API_KEY, model=settings.AI_MODEL)
    if provider == "groq":
        return GroqProvider(api_key=settings.GROQ_API_KEY, model=settings.AI_MODEL)
    if provider == "openrouter":
        return OpenRouterProvider(api_key=settings.OPENROUTER_API_KEY, model=settings.AI_MODEL)
    if provider == "gemini":
        return GeminiProvider(api_key=settings.GEMINI_API_KEY, model=settings.AI_MODEL)
    if provider == "mock":
        return MockProvider()
    raise AIServiceError(f"Unsupported AI_PROVIDER: {settings.AI_PROVIDER!r}")


async def generate_quiz_from_content(
    content: str,
    num_questions: int = 10,
    settings: Settings | None = None,
) -> list[dict[str, Any]]:
    """Module-level convenience wrapper so callers can import a single function."""
    provider = get_ai_provider(settings)
    return await provider.generate_quiz_from_content(content, num_questions=num_questions)
