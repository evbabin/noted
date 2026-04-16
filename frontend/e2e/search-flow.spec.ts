import { expect, test } from "@playwright/test";

import {
  buildSeedUser,
  createAuthenticatedContext,
  createNote,
  createNotebook,
  createWorkspace,
  registerUser,
  seededDocument,
} from "./utils/collaboration";
import { buildWorkspaceUrl } from "./utils/app";

/**
 * Covers the workspace search journey from section 7.3 by seeding multiple
 * notes, searching for a unique term, and asserting that selecting a result
 * navigates to the matching note page.
 */
test.describe("search-flow", () => {
  test("user can search notes and open the matching result", async ({
    browser,
    request,
    baseURL,
  }) => {
    const frontendBaseUrl = baseURL ?? "http://localhost:5173";
    const owner = await registerUser(request, buildSeedUser("search-owner"));
    const workspace = await createWorkspace(request, owner.access_token, {
      name: `Search Workspace ${Date.now()}`,
      description: "Seeded by the Playwright search flow",
    });
    const notebook = await createNotebook(
      request,
      owner.access_token,
      workspace.id,
      {
        title: "Search Notebook",
      },
    );
    const matchingNote = await createNote(
      request,
      owner.access_token,
      notebook.id,
      {
        title: "Distributed Cache Guide",
        content: seededDocument(
          "Redis cache invalidation strategy for distributed search indexing.",
        ),
      },
    );
    const otherNote = await createNote(
      request,
      owner.access_token,
      notebook.id,
      {
        title: "Quiz Review Notes",
        content: seededDocument(
          "Flashcards and active recall review patterns.",
        ),
      },
    );

    const ownerContext = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      owner,
    );
    const page = await ownerContext.newPage();

    try {
      await page.goto(buildWorkspaceUrl(frontendBaseUrl, workspace.id), {
        waitUntil: "networkidle",
      });

      await page
        .getByRole("banner")
        .getByRole("button", { name: /Search/ })
        .click();
      await expect(page.getByRole("dialog")).toBeVisible();

      await page.getByPlaceholder("Search notes…").fill("cache invalidation");

      await expect(
        page.getByRole("button", { name: /Distributed Cache Guide/ }),
      ).toBeVisible();
      await expect(page.getByText(otherNote.title)).toHaveCount(0);

      await page
        .getByRole("button", { name: /Distributed Cache Guide/ })
        .click();

      await expect(page).toHaveURL(
        new RegExp(`/workspaces/${workspace.id}/notes/${matchingNote.id}$`),
      );
      await expect(page.getByTestId("note-title-input")).toHaveValue(
        matchingNote.title,
      );
    } finally {
      await Promise.all([
        page.close().catch(() => {}),
        ownerContext.close().catch(() => {}),
      ]);
    }
  });
});
