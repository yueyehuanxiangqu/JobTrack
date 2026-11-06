import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import Header from "@/components/Header";
import { SidebarProvider } from "@/context/SidebarContext";

vi.mock("@/hooks/useAppVersion", () => ({ useAppVersion: () => ({ updateAvailable: false }) }));

it("exposes every core route and account settings/logout in the narrow navigation", async () => {
  const user = userEvent.setup();
  render(
    <SidebarProvider initialExpanded>
        {await Header({ user: { id: "layout-user", username: "layout.user", name: "Layout User", email: "" }, signOutAction: vi.fn() })}
    </SidebarProvider>,
  );
  await user.click(screen.getByRole("button", { name: "Toggle Menu" }));
  const menu = screen.getByRole("dialog", { name: "Navigation Menu" });
  expect(within(menu).queryByRole("link", { name: "Activities" })).not.toBeInTheDocument();
  expect(within(menu).getByRole("link", { name: "JobTrack" }).querySelector("img"))
    .toHaveAttribute("src", "/images/jobtrack-logo.svg");
  for (const [name, route] of [["Dashboard", "/dashboard"], ["Jobs", "/dashboard/myjobs"],
    ["Interviews", "/dashboard/interviews"], ["Tasks", "/dashboard/tasks"]]) {
    expect(within(menu).getByRole("link", { name })).toHaveAttribute("href", route);
  }
  await user.click(within(menu).getByRole("button", { name: "User menu" }));
  expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute("href", "/dashboard/settings");
  expect(screen.getByRole("menuitem", { name: "Logout" })).toBeInTheDocument();
});
