import { expect, test } from "@playwright/test";

import { registerViaUi, loginViaUi } from "./utils/app";
import { buildSeedUser } from "./utils/collaboration";

/**
 * Covers the core authentication journey from section 7.3: a new user can
 * register, reach the protected dashboard, sign out, and log back in.
 */
test.describe("auth-flow", () => {
  test("user can register, sign out, and log back in", async ({ page }) => {
    const user = buildSeedUser("auth-user");

    await registerViaUi(page, user);

    await expect(
      page.getByRole("heading", { name: "Your workspaces" }),
    ).toBeVisible();
    await expect(page.getByText("No workspaces yet")).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    await loginViaUi(page, user);

    await expect(
      page.getByRole("heading", { name: "Your workspaces" }),
    ).toBeVisible();
  });
});
