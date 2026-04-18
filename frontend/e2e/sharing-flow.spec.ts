import { expect, test } from "@playwright/test";

import {
  buildSeedUser,
  createAuthenticatedContext,
  createNote,
  createNotebook,
  createWorkspace,
  getNote,
  registerUser,
  seededDocument,
} from "./utils/collaboration";
import { buildNoteUrl, buildWorkspaceUrl } from "./utils/app";

/**
 * Covers the sharing flow from section 7.3: an owner invites an existing user,
 * the invited user sees the workspace, and changing their role unlocks note
 * editing that was previously blocked.
 */
test.describe("sharing-flow", () => {
  test("owner can invite a member and role changes affect note editing", async ({
    browser,
    request,
    baseURL,
  }) => {
    const frontendBaseUrl = baseURL ?? "http://localhost:5173";
    const owner = await registerUser(request, buildSeedUser("sharing-owner"));
    const invitedMember = await registerUser(
      request,
      buildSeedUser("sharing-member"),
    );
    const workspace = await createWorkspace(request, owner.access_token, {
      name: `Sharing Workspace ${Date.now()}`,
      description: "Seeded by the Playwright sharing flow",
    });
    const notebook = await createNotebook(
      request,
      owner.access_token,
      workspace.id,
      {
        title: "Shared Notebook",
      },
    );
    const note = await createNote(request, owner.access_token, notebook.id, {
      title: "Role Controlled Note",
      content: seededDocument(
        "Shared note content for role transition testing.",
      ),
    });

    const ownerContext = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      owner,
    );
    const memberContext = await createAuthenticatedContext(
      browser,
      frontendBaseUrl,
      invitedMember,
    );
    const ownerPage = await ownerContext.newPage();
    const memberPage = await memberContext.newPage();

    try {
      await ownerPage.goto(buildWorkspaceUrl(frontendBaseUrl, workspace.id), {
        waitUntil: "networkidle",
      });

      await ownerPage
        .getByPlaceholder("Invite by email")
        .fill(invitedMember.user.email);
      await ownerPage.getByRole("button", { name: "Invite member" }).click();

      const roleSelect = ownerPage.getByLabel(
        `Change role for ${invitedMember.user.display_name}`,
      );
      await expect(roleSelect).toBeVisible();

      await memberPage.goto(`${frontendBaseUrl}/dashboard`, {
        waitUntil: "networkidle",
      });
      await expect(
        memberPage.getByRole("link", { name: new RegExp(workspace.name) }),
      ).toBeVisible();

      await memberPage.goto(
        buildNoteUrl(frontendBaseUrl, workspace.id, note.id),
        { waitUntil: "networkidle" },
      );
      await expect(memberPage.getByTestId("note-title-input")).toHaveValue(
        note.title,
      );

      const blockedTitle = `${note.title} viewer attempt`;
      await memberPage.getByTestId("note-title-input").fill(blockedTitle);
      await memberPage.getByTestId("note-title-input").blur();

      // The SaveIndicator surfaces any failed autosave as "Save failed" — the
      // viewer role the member starts with rejects the title update with 403
      // and the indicator flips to the error label.
      await expect(memberPage.getByText("Save failed")).toBeVisible();

      await roleSelect.selectOption("editor");
      await expect(roleSelect).toHaveValue("editor");

      await memberPage.reload({ waitUntil: "networkidle" });

      const savedTitle = `Editor title ${Date.now()}`;
      await memberPage.getByTestId("note-title-input").fill(savedTitle);
      await memberPage.getByTestId("note-title-input").blur();

      await expect
        .poll(
          async () => {
            const refreshed = await getNote(
              request,
              owner.access_token,
              note.id,
            );
            return refreshed.title;
          },
          { timeout: 15_000 },
        )
        .toBe(savedTitle);
    } finally {
      await Promise.all([
        ownerPage.close().catch(() => {}),
        memberPage.close().catch(() => {}),
      ]);

      await Promise.all([
        ownerContext.close().catch(() => {}),
        memberContext.close().catch(() => {}),
      ]);
    }
  });
});
