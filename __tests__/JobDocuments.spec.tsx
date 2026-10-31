import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import JobDocuments from "@/components/myjobs/JobDocuments";

const initial = [{ kind: "CV", fileName: "原有.pdf", size: 123, uploadedAt: "2026-10-31T01:00:00Z" }, { kind: "COVER_LETTER", fileName: "letter.docx", size: 234, uploadedAt: "2026-10-31T01:00:00Z" }];
afterEach(() => { vi.unstubAllGlobals(); });
it("requires confirmation before removing a slot and leaves the other document visible", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ documents: initial }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ documents: initial.slice(1) }) });
  vi.stubGlobal("fetch", fetcher);
  render(<JobDocuments jobId="job-a" />);
  await screen.findByText("原有.pdf");
  await userEvent.click(screen.getByRole("button", { name: "Delete CV" }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
  expect(fetcher).toHaveBeenCalledTimes(1);
  await userEvent.click(screen.getByRole("button", { name: "Delete CV" }));
  await userEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete" }));
  await waitFor(() => expect(screen.queryByText("原有.pdf")).not.toBeInTheDocument());
  expect(screen.getByText("letter.docx")).toBeVisible();
  expect(fetcher).toHaveBeenLastCalledWith("/api/jobs/job-a/documents/CV", { method: "DELETE" });
});
it("keeps the old filename and selection on failure, then supports an explicit retry", async () => {
  const fetcher = vi.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ documents: initial }) })
    .mockResolvedValueOnce({ ok: false, json: async () => ({ error: "Disk is full." }) })
    .mockResolvedValueOnce({ ok: true, json: async () => ({ documents: [{ ...initial[0], fileName: "新.pdf", uploadedAt: "2026-10-31T02:00:00Z" }, initial[1]] }) });
  vi.stubGlobal("fetch", fetcher);
  render(<JobDocuments jobId="job-a" />);
  await screen.findByText("原有.pdf");
  await userEvent.upload(screen.getByLabelText("Replace CV"), new File(["test"], "新.pdf", { type: "application/pdf" }));
  await userEvent.click(screen.getByRole("button", { name: "Replace CV" }));
  expect(await screen.findByRole("alert")).toHaveTextContent("Disk is full");
  expect(screen.getByText("原有.pdf")).toBeVisible();
  expect(screen.getByText("Selected: 新.pdf")).toBeVisible();
  await userEvent.click(screen.getByRole("button", { name: "Replace CV" }));
  expect(await screen.findByText("新.pdf", { exact: true })).toBeVisible();
  expect(screen.queryByText("原有.pdf")).not.toBeInTheDocument();
});
