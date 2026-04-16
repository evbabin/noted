import { expect, type Page } from "@playwright/test";

import type { SeedUser } from "./collaboration";

const ACCESS_TOKEN_KEY = "access_token";

export async function registerViaUi(page: Page, user: SeedUser): Promise<void> {
  await page.goto("/register", { waitUntil: "networkidle" });

  await page.getByLabel("Display name").fill(user.displayName);
  await page.getByLabel("Email").fill(user.email);
  await page
    .getByRole("textbox", { name: /^Password/ })
    .first()
    .fill(user.password);
  await page.getByLabel("Confirm password").fill(user.password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function loginViaUi(page: Page, user: SeedUser): Promise<void> {
  await page.goto("/login", { waitUntil: "networkidle" });

  await page.getByLabel("Email").fill(user.email);
  await page.getByLabel("Password").fill(user.password);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/dashboard$/);
}

export async function getStoredAccessToken(page: Page): Promise<string> {
  const accessToken = await page.evaluate((accessKey) => {
    return window.localStorage.getItem(accessKey);
  }, ACCESS_TOKEN_KEY);

  if (!accessToken) {
    throw new Error("Expected an access token in localStorage");
  }

  return accessToken;
}

export function buildWorkspaceUrl(
  frontendBaseUrl: string,
  workspaceId: string,
): string {
  return `${trimTrailingSlash(frontendBaseUrl)}/workspaces/${workspaceId}`;
}

export function buildNoteUrl(
  frontendBaseUrl: string,
  workspaceId: string,
  noteId: string,
): string {
  return `${buildWorkspaceUrl(frontendBaseUrl, workspaceId)}/notes/${noteId}`;
}

function trimTrailingSlash(value: string): string {
  return value.replace(/\/+$/, "");
}
