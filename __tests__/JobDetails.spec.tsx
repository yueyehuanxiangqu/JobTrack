import JobDetails from "@/components/myjobs/JobDetails";
import { JobResponse,Tag } from "@/models/job.model";
import { render,screen,within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

// The active tab lives in the URL, so a click only calls router.replace —
// what the user sees next comes from the re-render with the new params.
const router = {
  back: vi.fn(),
  push: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
};
let searchParams = new URLSearchParams();
const onTab = (tab: string) => {
  searchParams = new URLSearchParams(`tab=${tab}`);
};

vi.mock("next/navigation", () => ({
  useRouter: () => router,
  useSearchParams: () => searchParams,
  usePathname: () => "/dashboard/myjobs/job-1",
}));

const chat = {
  open: vi.fn(),
  clear: vi.fn().mockResolvedValue(undefined),
  sendMessage: vi.fn(),
  approvalPending: false,
};

vi.mock("@/components/agent/AgentChatProvider", () => ({
  useAgentChat: () => chat,
}));

vi.mock("@/components/myjobs/NotesSection", () => ({
  NotesSection: () => <div data-testid="notes-section" />,
}));

vi.mock("@/components/TipTapContentViewer", () => ({
  TipTapContentViewer: () => null,
}));

vi.mock("@/components/automations/MatchDetails", () => ({
  MatchDetails: () => <div data-testid="match-details" />,
}));

vi.mock("@/components/profile/DownloadFileButton", () => ({
  DownloadFileButton: () => null,
}));

vi.mock("@/actions/contact.actions", () => ({
  getAllContacts: vi.fn().mockResolvedValue([]),
  getJobContacts: vi.fn().mockResolvedValue([]),
  addJobContact: vi.fn(),
  removeJobContact: vi.fn(),
  createContact: vi.fn(),
  updateContact: vi.fn(),
}));

vi.mock("@/actions/contactRole.actions", () => ({
  getAllContactRoles: vi.fn().mockResolvedValue([]),
  createContactRole: vi.fn(),
}));

vi.mock("@/components/CircularScore", () => ({
  CircularScore: ({ score }: { score: number }) => (
    <div data-testid="circular-score">{score}%</div>
  ),
}));

vi.mock("@/actions/jobStage.actions", () => ({
  getJobStages: vi.fn().mockResolvedValue([]),
  setPrepQuestionAsked: vi.fn(),
  removeStagePrepQuestion: vi.fn(),
  unlinkStageInterviewer: vi.fn(),
  setStageNotes: vi.fn(),
  addJobStage: vi.fn(),
  updateJobStage: vi.fn(),
}));

const makeStage = (id: string, label: string, over: any = {}) => ({
  id,
  jobId: "job-1",
  stageTypeId: `t-${id}`,
  occurredAt: new Date(2026, 8, 3),
  isCurrent: false,
  outcome: null,
  notes: null,
  durationMins: null,
  format: null,
  location: null,
  createdAt: new Date(2026, 8, 1),
  updatedAt: new Date(2026, 8, 1),
  StageType: {
    id: `t-${id}`,
    label,
    value: label.toLowerCase(),
    statusId: "s1",
    sortOrder: 0,
    Status: { id: "s1", label, value: "applied" },
  },
  interviewers: [],
  prepQuestions: [],
  ...over,
});

const stageA = makeStage("stage-a", "Applied", {
  occurredAt: new Date(2026, 8, 1),
});
const stageB = makeStage("stage-b", "Interview", { isCurrent: true });

const baseProps = {
  jobStatuses: [],
  companies: [],
  titles: [],
  locations: [],
  sources: [],
  tags: [],
  stageTypes: [],
};

const makeJob = (overrides: Partial<JobResponse> = {}): JobResponse => ({
  id: "job-1",
  userId: "user-1",
  JobTitle: {
    id: "t1",
    label: "Frontend Developer",
    value: "frontend developer",
    createdBy: "user-1",
  },
  Company: {
    id: "c1",
    label: "Acme Corp",
    value: "acme corp",
    createdBy: "user-1",
  },
  Status: { id: "s1", label: "Applied", value: "applied" },
  Location: { id: "l1", label: "Remote", value: "remote", createdBy: "user-1" },
  JobSource: {
    id: "src1",
    label: "LinkedIn",
    value: "linkedin",
    createdBy: "user-1",
  },
  jobType: "FT",
  createdAt: new Date("2025-01-01"),
  appliedDate: new Date("2025-01-15"),
  dueDate: new Date("2099-12-31"), // far future — not expired
  salaryRange: "100,000 - 110,000",
  description: "<p>Job description</p>",
  jobUrl: "",
  applied: true,
  tags: [],
  ...overrides,
});

describe("JobDetails – skill badges", () => {
  it("renders skill badges for all tags on the job", () => {
    const tags: Tag[] = [
      { id: "tag-1", label: "React", value: "react", createdBy: "user-1" },
      {
        id: "tag-2",
        label: "TypeScript",
        value: "typescript",
        createdBy: "user-1",
      },
      { id: "tag-3", label: "Node.js", value: "node.js", createdBy: "user-1" },
    ];
    render(<JobDetails {...baseProps} job={makeJob({ tags })} />);

    expect(screen.getByText("React")).toBeInTheDocument();
    expect(screen.getByText("TypeScript")).toBeInTheDocument();
    expect(screen.getByText("Node.js")).toBeInTheDocument();
  });

  it("renders no tag badges when the job has no tags", () => {
    render(<JobDetails {...baseProps} job={makeJob({ tags: [] })} />);

    // Verify tag area is simply absent; badges for these labels shouldn't exist
    expect(screen.queryByText("React")).not.toBeInTheDocument();
    expect(screen.queryByText("TypeScript")).not.toBeInTheDocument();
  });

  it("renders no tag badges when tags property is undefined", () => {
    const job = makeJob();
    delete job.tags;
    render(<JobDetails {...baseProps} job={job} />);

    // Should render without crashing and show no skill badges
    expect(screen.getByText("Frontend Developer")).toBeInTheDocument();
  });

  it("renders a single skill badge correctly", () => {
    const tags: Tag[] = [
      { id: "tag-1", label: "GraphQL", value: "graphql", createdBy: "user-1" },
    ];
    render(<JobDetails {...baseProps} job={makeJob({ tags })} />);

    expect(screen.getByText("GraphQL")).toBeInTheDocument();
  });

  it("renders each tag label exactly once", () => {
    const tags: Tag[] = [
      { id: "tag-1", label: "React", value: "react", createdBy: "user-1" },
      { id: "tag-2", label: "Vue", value: "vue", createdBy: "user-1" },
    ];
    render(<JobDetails {...baseProps} job={makeJob({ tags })} />);

    // getAllByText returns an array; each label should appear exactly once in the badge area
    expect(screen.getAllByText("React")).toHaveLength(1);
    expect(screen.getAllByText("Vue")).toHaveLength(1);
  });
});

describe("JobDetails – linked resume", () => {
  it("links to a built resume that has no uploaded file", () => {
    render(
      <JobDetails
        {...baseProps}
        job={makeJob({
          resumeId: "resume-1",
          Resume: { id: "resume-1", title: "Senior Engineer Resume" },
        })}
      />
    );

    expect(
      screen.getByRole("link", { name: /Senior Engineer Resume/ })
    ).toHaveAttribute("href", "/dashboard/profile/resume/resume-1");
  });
});

// The status is derived from the current stage, so it must be read from the
// stage list the timeline already refetches — a mirrored copy went stale on
// every stage add, edit and delete, and seeded Edit Job with the old status.
describe("JobDetails – status from the current stage", () => {
  const statusBadge = () =>
    within(screen.getByText("Status").parentElement!).getAllByText(
      /Applied|Interview/,
    )[0];

  it("shows the current stage's status, not the one on the job prop", () => {
    render(
      <JobDetails
        {...baseProps}
        job={makeJob({ stages: [stageA, stageB] })}
      />,
    );

    expect(statusBadge()).toHaveTextContent("Interview");
  });

  it("keeps the job's own status when the job has no stages", () => {
    render(<JobDetails {...baseProps} job={makeJob({ stages: [] })} />);

    expect(statusBadge()).toHaveTextContent("Applied");
  });
});

describe("JobDetails – tabs", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chat.approvalPending = false;
    searchParams = new URLSearchParams();
  });

  // The bar must not shift between jobs, so all four core tabs are always present.
  it("renders the four core tabs without AI actions", () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    expect(screen.getByRole("tab", { name: /job summary/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /contacts/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /timeline/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /notes/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Contacts" })).toBeInTheDocument();
  });

  it("renders a Timeline tab right after Description, with a stage count", () => {
    render(
      <JobDetails {...baseProps} job={makeJob({ stages: [stageA, stageB] })} />,
    );

    const tabs = screen.getAllByRole("tab").map((t) => t.textContent);
    const descriptionAt = tabs.findIndex((t) => t?.startsWith("Job Summary"));
    const timelineAt = tabs.findIndex((t) => t?.startsWith("Timeline"));

    expect(timelineAt).toBe(descriptionAt + 1);
    expect(screen.getByRole("tab", { name: /Timeline/ })).toHaveTextContent("2");
  });

  it("shows an empty state for a job with no stages, keeping its status visible", () => {
    onTab("timeline");
    render(<JobDetails {...baseProps} job={makeJob({ stages: [] })} />);

    expect(screen.getByText(/No stages recorded/i)).toBeInTheDocument();
    expect(screen.getByTestId("timeline-add-stage-btn")).toBeInTheDocument();
  });

  // Escape first: an open Radix menu is modal, so the second trigger would
  // sit under a pointer-events:none layer.
  it("keeps only one status control, in the Update Status menu", async () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    await userEvent.click(screen.getByTestId("job-details-actions-menu-btn"));
    expect(screen.queryByRole("menuitem", { name: /Change status/ })).toBeNull();
    await userEvent.keyboard("{Escape}");

    await userEvent.click(screen.getByTestId("update-status-menu-btn"));
    expect(
      screen.getByRole("menuitem", { name: /Change status/ }),
    ).toBeInTheDocument();
  });

  it("opens on the Description tab", () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    expect(screen.getByRole("tab", { name: /job summary/i })).toHaveAttribute(
      "data-state",
      "active",
    );
  });

  it("puts the picked tab in the URL so a refresh lands on it", async () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    await userEvent.click(screen.getByRole("tab", { name: /contacts/i }));
    expect(router.replace).toHaveBeenCalledWith("?tab=contacts", { scroll: false });
  });

  // It stays mounted on every tab so the ⋮ → Add a Note trigger and the count
  // badge keep working; the panel's own inactive state is what hides it.
  it("keeps the notes section mounted while another tab is showing", () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    expect(screen.getByTestId("notes-section")).toBeInTheDocument();
    expect(
      screen.getByTestId("notes-section").closest("[data-state]"),
    ).toHaveAttribute("data-state", "inactive");
  });

});

describe("JobDetails – company link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chat.approvalPending = false;
    searchParams = new URLSearchParams();
  });

  it("links the company in the header to its details page", () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    expect(screen.getByRole("link", { name: "Acme Corp" })).toHaveAttribute(
      "href",
      "/dashboard/admin/companies/c1",
    );
  });

  it("keeps the dot-separated subtitle reading the same", () => {
    render(<JobDetails {...baseProps} job={makeJob()} />);

    expect(
      screen.getByRole("link", { name: "Acme Corp" }).parentElement,
    ).toHaveTextContent("Acme Corp · Remote · Full-time");
  });
});
