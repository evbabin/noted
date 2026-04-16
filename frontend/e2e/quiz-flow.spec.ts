import { expect, test } from "@playwright/test";

import { createAuthenticatedContext } from "./utils/collaboration";
import { seedQuizWorkspace } from "./utils/quiz";

/**
 * End-to-end verification for task 5.12.
 *
 * The test starts from a note, opens the quiz page from the note header,
 * generates a deterministic quiz through the mock AI provider, waits for the
 * poll-until-complete flow, submits answers across all question types, and
 * confirms that the scored review page is shown.
 */
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
      await expect(page.getByTestId("note-title-input")).toHaveValue(seed.note.title);

      await page.getByTestId("note-open-quizzes").click();
      await expect(page).toHaveURL(new RegExp(`/notes/${seed.note.id}/quizzes$`));

      await page.getByTestId("quiz-generator-title-input").fill("Verification Quiz");
      await page.getByTestId("quiz-generator-submit").click();

      await expect(page.getByTestId("quiz-generator-status")).toContainText(
        "generated successfully",
        {
          timeout: 45_000,
        },
      );

      await page.getByTestId("quiz-generator-take-quiz").click();
      await expect(page).toHaveURL(/\/quizzes\/.+$/);

      for (let questionNumber = 1; questionNumber <= 10; questionNumber += 1) {
        if (questionNumber % 3 === 1) {
          await page
            .getByText(`Correct Answer ${questionNumber}`, { exact: true })
            .click();
        } else if (questionNumber % 3 === 2) {
          await page
            .getByPlaceholder("Type your answer here...")
            .fill(`answer-${questionNumber}`);
        } else {
          await page
            .getByText(
              `What recall phrase should you use for question ${questionNumber}?`,
              {
                exact: true,
              },
            )
            .click();
          await page.getByRole("button", { name: "Got it right" }).click();
        }

        await page
          .getByRole("button", {
            name: questionNumber === 10 ? "Submit Quiz" : "Next",
          })
          .click();
      }

      await expect(page.getByTestId("quiz-score-summary")).toContainText("100%");
      await expect(page.getByTestId("quiz-score-summary")).toContainText(
        "10 out of 10 correct",
      );
    } finally {
      await Promise.all([
        page.close().catch(() => {}),
        ownerContext.close().catch(() => {}),
      ]);
    }
  });
});
