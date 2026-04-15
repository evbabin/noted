import { test, expect } from "@playwright/test";

import {
  createAuthenticatedContext,
  expectPresenceUsers,
  expectRemoteCursorVisible,
  seedCollaborationWorkspace,
} from "./utils/collaboration";

/**
 * Browser-level collaboration verification for task 4.11.
 *
 * This spec uses two fully isolated browser contexts so auth state, websocket
 * sessions, and local editor stores behave like two separate users in two tabs.
 * The setup seeds a shared workspace/note through the backend API, then both
 * users open the same note and verify:
 * - websocket collaboration connects for both users
 * - presence reflects both collaborators
 * - content typed in one context appears in the other
 * - remote cursor UI becomes visible after caret movement
 */
test.describe("collaboration-flow", () => {
  test("two browser contexts see synced content, presence, and remote cursor state", async ({
    browser,
    request,
    baseURL,
  }) => {
    const frontendBaseUrl = baseURL ?? "http://localhost:5173";

    const seed = await seedCollaborationWorkspace(request, frontendBaseUrl);

    const ownerContext = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      seed.owner,
    );
    const collaboratorContext = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      seed.collaborator,
    );

    const ownerPage = await ownerContext.newPage();
    const collaboratorPage = await collaboratorContext.newPage();

    try {
      await collaboratorPage.goto(seed.noteUrl, { waitUntil: "networkidle" });

      await expect(
        collaboratorPage.getByTestId("collaboration-connection-badge"),
      ).toContainText("Live collaboration connected");
      await expect(
        collaboratorPage.getByTestId("note-title-input"),
      ).toHaveValue(seed.note.title);
      await expect(
        collaboratorPage.getByTestId("note-editor-content"),
      ).toBeVisible();
      await expectPresenceUsers(collaboratorPage, [
        seed.collaborator.user.display_name,
      ]);

      await ownerPage.goto(seed.noteUrl, { waitUntil: "networkidle" });

      await Promise.all([
        expect(
          ownerPage.getByTestId("collaboration-connection-badge"),
        ).toContainText("Live collaboration connected"),
        expect(
          collaboratorPage.getByTestId("collaboration-connection-badge"),
        ).toContainText("Live collaboration connected"),
      ]);

      await Promise.all([
        expect(ownerPage.getByTestId("note-title-input")).toHaveValue(
          seed.note.title,
        ),
        expect(collaboratorPage.getByTestId("note-title-input")).toHaveValue(
          seed.note.title,
        ),
      ]);

      await Promise.all([
        expect(ownerPage.getByTestId("note-editor-content")).toBeVisible(),
        expect(
          collaboratorPage.getByTestId("note-editor-content"),
        ).toBeVisible(),
      ]);

      await expectPresenceUsers(ownerPage, [
        seed.owner.user.display_name,
        seed.collaborator.user.display_name,
      ]);
      await expectPresenceUsers(collaboratorPage, [
        seed.owner.user.display_name,
        seed.collaborator.user.display_name,
      ]);

      const ownerEditor = ownerPage.locator(
        '[data-testid="note-editor-content"] .ProseMirror',
      );
      const collaboratorEditor = collaboratorPage.locator(
        '[data-testid="note-editor-content"] .ProseMirror',
      );

      await ownerEditor.click();
      await ownerEditor.press("End");

      await expectRemoteCursorVisible(collaboratorPage, seed.owner.user.id);

      const collaborationText = ` Hello from ${seed.owner.user.display_name}`;
      await ownerEditor.pressSequentially(collaborationText);

      await expect
        .poll(async () => {
          const text = await ownerEditor.textContent();
          return text?.replace(/\s+/g, " ").trim() ?? "";
        })
        .toContain(`Hello from ${seed.owner.user.display_name}`);

      await expect
        .poll(async () => {
          const text = await collaboratorEditor.textContent();
          return text?.replace(/\s+/g, " ").trim() ?? "";
        })
        .toContain(`Hello from ${seed.owner.user.display_name}`);

      const replyText = ` Reply from ${seed.collaborator.user.display_name}`;
      await collaboratorEditor.click();
      await collaboratorEditor.press("End");
      await collaboratorEditor.pressSequentially(replyText);

      await expectRemoteCursorVisible(ownerPage, seed.collaborator.user.id);

      await expect
        .poll(async () => {
          const text = await collaboratorEditor.textContent();
          return text?.replace(/\s+/g, " ").trim() ?? "";
        })
        .toContain(`Reply from ${seed.collaborator.user.display_name}`);

      await expect
        .poll(async () => {
          const text = await ownerEditor.textContent();
          return text?.replace(/\s+/g, " ").trim() ?? "";
        })
        .toContain(`Reply from ${seed.collaborator.user.display_name}`);
    } finally {
      await Promise.all([
        ownerPage.close().catch(() => {}),
        collaboratorPage.close().catch(() => {}),
      ]);

      await Promise.all([
        ownerContext.close().catch(() => {}),
        collaboratorContext.close().catch(() => {}),
      ]);
    }
  });
});
