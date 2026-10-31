import { type Locator, type Page } from "@playwright/test";
import {
  test,
  expect,
  createNewJob,
  uniqueName,
} from "./fixtures";

// selectOrCreate with an exact label: its substring match also hits the
// "Filter by role" select and the "Contacts" tabpanel. Same popover-close wait.
async function pick(
  page: Page,
  scope: Locator | Page,
  label: string,
  placeholder: string,
  value: string,
) {
  await scope.getByLabel(label, { exact: true }).click();
  const input = page.getByPlaceholder(placeholder);
  await input.fill(value);
  const createOption = page.getByText(`Create: ${value}`);
  const existingOption = page.getByRole("option", { name: value, exact: true });
  await expect(createOption.or(existingOption).first()).toBeVisible();
  if (await existingOption.isVisible()) {
    await existingOption.click();
  } else {
    await createOption.click();
  }
  await expect(input).not.toBeVisible({ timeout: 15000 });
}

async function openJobContactsTab(page: Page, jobId: string) {
  await page.goto(`/dashboard/myjobs/${jobId}?tab=contacts`);
}

test.describe("Job Contacts tab", () => {

  test("creates a new contact from the typed name and links it", async ({
    page,
    cleanup,
  }) => {
    const name = uniqueName("Casey Rowe");
    const role = uniqueName("Recruiter Role");
    const jobText = uniqueName("contact new job");

    const jobId = await createNewJob(page, jobText, cleanup);
    await openJobContactsTab(page, jobId);
    await page.getByRole("button", { name: "Add Contact" }).click();

    // The picker has no create path; what's typed carries into the dialog
    await page.getByLabel("Contact", { exact: true }).click();
    await page.getByPlaceholder("Search contact").fill(name);
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "New contact" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Name", { exact: true })).toHaveValue(name);
    await dialog.getByRole("button", { name: "Save" }).click();
    cleanup.contact(name);
    await expect(dialog).not.toBeVisible();
    await expect(page.getByLabel("Contact", { exact: true })).toContainText(
      name,
    );

    await pick(page, page, "Role", "Create or Search role", role);
    cleanup.contactRole(role);
    await page.getByRole("button", { name: "Save", exact: true }).click();

    const link = page.getByRole("listitem").filter({ hasText: name });
    await expect(link).toContainText(role);
  });
});

test.describe("Company Contacts tab", () => {
  test("adds a contact with the company prefilled", async ({
    page,
    cleanup,
  }) => {
    const company = uniqueName("Contacts Tab Company");
    const name = uniqueName("Robin Vale");

    await page.goto("/dashboard/admin");
    await page.getByTestId("add-company-btn").click();
    await page.getByLabel("Company Name").fill(company);
    await page.getByRole("button", { name: /save/i }).click();
    cleanup.company(company);
    await expect(page.getByRole("dialog")).not.toBeVisible();

    await page.getByPlaceholder("Search companies...").fill(company);
    await page.getByRole("link", { name: company, exact: true }).click();
    await expect(page).toHaveURL(/\/dashboard\/admin\/companies\//);

    await page.getByRole("tab", { name: "Contacts" }).click();
    await expect(page.getByText("No contacts at this company yet")).toBeVisible();
    await page.getByRole("button", { name: "Add Contact" }).click();

    const dialog = page.getByRole("dialog");
    await expect(dialog.getByLabel("Company", { exact: true })).toContainText(
      company,
    );
    await dialog.getByLabel("Name", { exact: true }).fill(name);
    await dialog.getByRole("button", { name: "Save" }).click();
    cleanup.contact(name);
    await expect(dialog).not.toBeVisible();

    await expect(page.getByText("Works here")).toBeVisible();
    await expect(page.getByRole("row").filter({ hasText: name })).toBeVisible();
  });
});
