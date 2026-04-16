import { expect, test } from "@playwright/test";

import {
  createAuthenticatedContext,
  createNote,
  createNotebook,
  emptyDocument,
  getNote,
  registerUser,
  buildSeedUser,
} from "./utils/collaboration";
import { buildNoteUrl, getStoredAccessToken } from "./utils/app";

/**
 * Browser coverage for the workspace authoring path from section 7.3.
 *
 * The UI currently supports workspace creation but not notebook/note creation,
 * so this spec creates those follow-on resources through the backend once the
 * workspace exists, then verifies that editing note content in the browser is
 * persisted back to the API.
 */
test.describe("workspace-flow", () => {
  test("user can create a workspace and persist note content edits", async ({
    browser,
    request,
    baseURL,
  }) => {
    const frontendBaseUrl = baseURL ?? "http://localhost:5173";
    const owner = await registerUser(request, buildSeedUser("workspace-owner"));
    const context = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      owner,
    );
    const page = await context.newPage();

    try {
      const workspaceName = `Workspace Flow ${Date.now()}`;
      const workspaceDescription =
        "Created through the Playwright workspace flow";

      await page.goto(`${frontendBaseUrl}/dashboard`, {
        waitUntil: "networkidle",
      });
      await page.getByPlaceholder("Workspace name").fill(workspaceName);
      await page
        .getByPlaceholder("Description (optional)")
        .fill(workspaceDescription);
      await page.getByRole("button", { name: "Create" }).click();

      await expect(
        page.getByText(`Workspace "${workspaceName}" created`),
      ).toBeVisible();

      const workspaceLink = page.getByRole("link", {
        name: new RegExp(workspaceName),
      });
      await expect(workspaceLink).toBeVisible();

      const workspaceHref = await workspaceLink.getAttribute("href");
      const workspaceId = workspaceHref?.match(/\/workspaces\/([^/]+)$/)?.[1];
      if (!workspaceId) {
        throw new Error(
          `Could not derive workspace ID from href: ${workspaceHref}`,
        );
      }

      const accessToken = await getStoredAccessToken(page);
      const notebook = await createNotebook(request, accessToken, workspaceId, {
        title: "Workspace Flow Notebook",
      });
      const note = await createNote(request, accessToken, notebook.id, {
        title: "Workspace Flow Note",
        content: emptyDocument(),
      });

      await page.goto(buildNoteUrl(frontendBaseUrl, workspaceId, note.id), {
        waitUntil: "networkidle",
      });

      await expect(page.getByTestId("note-title-input")).toHaveValue(
        note.title,
      );
      await expect(
        page.getByTestId("collaboration-connection-badge"),
      ).toContainText("Live collaboration connected");

      const editor = page.locator(
        '[data-testid="note-editor-content"] .ProseMirror',
      );
      const contentToPersist = `Workspace flow persistence ${Date.now()}`;

      await editor.click();
      await editor.pressSequentially(contentToPersist);

      await expect
        .poll(async () => {
          const text = await editor.textContent();
          return text?.replace(/\s+/g, " ").trim() ?? "";
        })
        .toContain(contentToPersist);

      await expect
        .poll(
          async () => {
            const refreshed = await getNote(request, accessToken, note.id);
            return refreshed.content_text ?? "";
          },
          { timeout: 15_000 },
        )
        .toContain(contentToPersist);
    } finally {
      await Promise.all([
        page.close().catch(() => {}),
        context.close().catch(() => {}),
      ]);
    }
  });
});
