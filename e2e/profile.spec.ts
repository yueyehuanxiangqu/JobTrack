import { type Page } from "@playwright/test";
import {
  test,
  expect,
  uniqueName,
  type CleanupRegistry,
} from "./fixtures";

async function createResume(
  page: Page,
  title: string,
  cleanup: CleanupRegistry,
) {
  await page.getByRole("button", { name: "New", exact: true }).click();
  await page.getByRole("menuitem", { name: "Add New Resume" }).click();
  await page.getByPlaceholder("Ex: Full Stack Developer").fill(title);
  await page.getByRole("button", { name: "Save" }).click();
  cleanup.resume(title);
}

test.describe("Profile page", () => {
  test("should create a new resume", async ({ page, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    await page.getByRole("link", { name: "Profile" }).click();
    await createResume(page, resumeTitle, cleanup);
    // Reload-after-create/delete is a client fetch; under parallel e2e load
    // the dev server can take longer than the default 10s to reflect it.
    await expect(page.locator("tbody")).toContainText(resumeTitle, {
      timeout: 20000,
    });
    await deleteResume(page, resumeTitle);
    // Assert on the persistent outcome (row removed) rather than the toast,
    // which auto-dismisses after 5s and can vanish before the poll under load.
    await expect(page.locator("tbody")).not.toContainText(resumeTitle, {
      timeout: 20000,
    });
  });

  test("should edit the resume title", async ({ page, baseURL, cleanup }) => {
    const resumeTitle = uniqueName("Test Resume");
    const editedTitle = uniqueName("Test Resume edited");
    // Register the edited title too, since it's what the row becomes on success.
    cleanup.resume(editedTitle);
    await page.getByRole("link", { name: "Profile" }).click();
    await expect(page).toHaveURL(baseURL + "/dashboard/profile");
    await createResume(page, resumeTitle, cleanup);

    const cells = page.getByText(new RegExp(resumeTitle, "i"));
    await expect(cells.first()).toBeVisible();
    await page
      .getByRole("row", { name: resumeTitle })
      .getByTestId("document-actions-menu-btn")
      .first()
      .click();
    await page.getByRole("menuitem", { name: /Edit Resume Title/ }).click();
    await page.getByPlaceholder("Ex: Full Stack Developer").fill(editedTitle);
    await page.getByRole("dialog").getByRole("button", { name: "Save" }).click();
    await expect(page.locator("tbody")).toContainText(editedTitle);
  });
});

async function deleteResume(page: Page, title: string) {
  await page.getByRole("link", { name: "Profile" }).click();
  await page.waitForLoadState("networkidle");
  const row = page.getByRole("row", { name: new RegExp(title, "i") }).first();
  await row.waitFor({ state: "visible", timeout: 10000 });
  await row.getByTestId("document-actions-menu-btn").click({ force: true });
  await page.getByRole("menuitem", { name: "Delete" }).click({ force: true });
  await expect(page.getByRole("alertdialog")).toContainText(
    "Are you sure you want to delete this resume?",
  );
  await page.getByRole("button", { name: "Delete" }).click({ force: true });
}
