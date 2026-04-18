import { expect, test, type Page } from "@playwright/test";

import { createAuthenticatedContext } from "./utils/collaboration";
import { seedQuizWorkspace } from "./utils/quiz";

/**
 * End-to-end verification for task 5.12 / 6.12.
 *
 * Runs against whichever `AI_PROVIDER` the backend is configured with. The
 * previous version of this spec asserted literal strings produced by the mock
 * provider ("Correct Answer 1", "What recall phrase…"), which does not work
 * against real providers (OpenRouter Gemma in this project). This version
 * instead inspects the DOM at each step to answer whatever question type the
 * provider returned, then confirms the flow reaches a scored review page.
 *
 * Score correctness is deliberately not asserted — the real model may or may
 * not grade our arbitrary answers as correct, and the verification objective
 * is "the pipeline works end-to-end", not "the AI is accurate".
 */

// Keep the quiz small: the verification VM only has 2 GB RAM, and the
// :free Gemma model on OpenRouter is slow. 3 questions still exercises every
// question-type branch (MC / FITB / flashcard) because the backend prompt
// asks the model to mix them roughly evenly.
const QUIZ_QUESTION_COUNT = 3;

// Generation on a free-tier model + low-mem VM can take noticeably longer
// than the 15–30 s the UI hints at, so allow generous headroom.
const GENERATION_TIMEOUT_MS = 120_000;

test.describe("quiz-flow", () => {
  test("user can generate a quiz from a note and see a scored result", async ({
    browser,
    request,
    baseURL,
  }) => {
    const frontendBaseUrl = baseURL ?? "http://localhost:5173";
    const seed = await seedQuizWorkspace(request, frontendBaseUrl);

    const ownerContext = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      seed.owner,
    );
    const page = await ownerContext.newPage();

    try {
      await page.goto(seed.noteUrl, { waitUntil: "networkidle" });
      await expect(page.getByTestId("note-title-input")).toHaveValue(
        seed.note.title,
      );

      await page.getByTestId("note-open-quizzes").click();
      await expect(page).toHaveURL(
        new RegExp(`/notes/${seed.note.id}/quizzes$`),
      );

      // Reduce question count before submitting to keep the generation short.
      // The slider is an <input type=range>, which Playwright can set via fill.
      const questionSlider = page.getByTestId("quiz-generator-num-questions");
      await questionSlider.fill(String(QUIZ_QUESTION_COUNT));

      await page
        .getByTestId("quiz-generator-title-input")
        .fill("Verification Quiz");
      await page.getByTestId("quiz-generator-submit").click();

      // Wait for generation to finish. Provider errors (e.g. rate-limit,
      // upstream 5xx) surface here — we'd rather fail loudly than swallow.
      await expect(page.getByTestId("quiz-generator-status")).toContainText(
        "generated successfully",
        { timeout: GENERATION_TIMEOUT_MS },
      );

      await page.getByTestId("quiz-generator-take-quiz").click();
      await expect(page).toHaveURL(/\/quizzes\/.+$/);

      // Answer each question until we click Submit on the last one. The
      // review page is triggered by the score summary becoming visible, so
      // that is the only ground-truth signal for "we're done taking".
      // We cap the loop to avoid infinite runs if the UI ever gets stuck.
      const maxQuestions = 25;
      for (let i = 0; i < maxQuestions; i += 1) {
        await answerCurrentQuestion(page);

        const submitButton = page.getByRole("button", { name: "Submit Quiz" });
        if (await submitButton.isVisible().catch(() => false)) {
          await submitButton.click();
          break;
        }

        await page.getByRole("button", { name: "Next" }).click();
      }

      // Scored review page confirms: answers submitted, attempt persisted,
      // and the review component rendered. We assert structure, not score.
      const summary = page.getByTestId("quiz-score-summary");
      await expect(summary).toBeVisible({ timeout: 30_000 });
      await expect(summary).toContainText("%");
      await expect(summary).toContainText(
        new RegExp(`out of \\d+ correct`),
      );
    } finally {
      await Promise.all([
        page.close().catch(() => {}),
        ownerContext.close().catch(() => {}),
      ]);
    }
  });
});

/**
 * Answers whatever question type is currently displayed on the quiz page.
 *
 * The real AI provider may return any mix of multiple-choice,
 * fill-in-the-blank, and flashcard questions — and in any order — so we
 * detect type from the DOM rather than from a pre-known schedule.
 *
 * - MC: check the first radio option. Correctness is not guaranteed.
 * - FITB: type a placeholder string.
 * - Flashcard: flip the card, then click "Got it right" (self-assessed).
 */
async function answerCurrentQuestion(page: Page): Promise<void> {
  // Multiple choice: radio inputs are scoped with name="q-<id>".
  const firstRadio = page.locator('input[type="radio"][name^="q-"]').first();
  if (await firstRadio.count()) {
    await firstRadio.check();
    return;
  }

  // Fill-in-the-blank.
  const fitbInput = page.getByPlaceholder("Type your answer here...");
  if (await fitbInput.count()) {
    await fitbInput.fill("verification answer");
    return;
  }

  // Flashcard: click the card body to flip, then click "Got it right".
  // The "Front" label is inside the flippable div and bubbles its click up.
  const flashcardFront = page.getByText("Front", { exact: true });
  if (await flashcardFront.count()) {
    await flashcardFront.click();
    await page.getByRole("button", { name: "Got it right" }).click();
    return;
  }

  throw new Error(
    "Could not identify current quiz question type (no radios, FITB input, or flashcard front found).",
  );
}
