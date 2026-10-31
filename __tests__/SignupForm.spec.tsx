import { signup, authenticate } from "@/actions/auth.actions";
import SignupForm from "@/components/auth/SignupForm";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useRouter } from "next/navigation";

// Mock the external dependencies
vi.mock("@/actions/auth.actions", () => ({
  signup: vi.fn(),
  authenticate: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: vi.fn(),
}));

describe("SignupForm Component", () => {
  const mockPush = vi.fn();

  beforeEach(() => {
    (useRouter as any).mockReturnValue({ push: mockPush });
    render(<SignupForm />);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("renders the SignupForm component correctly", () => {
    expect(screen.queryByLabelText("Full Name")).toBeNull();
    expect(screen.queryByLabelText("Email")).toBeNull();
    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create an account/i }),
    ).toBeInTheDocument();
  });



  it("should display invalid username error when username format is incorrect", async () => {

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "invalid username" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Use letters, numbers, periods, underscores or hyphens; start with a letter or number."),
      ).toBeInTheDocument();
    });
  });

  it("should display username minimum length error", async () => {

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "a@" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Username must be at least 3 characters."),
      ).toBeInTheDocument();
    });
  });

  it("should display password minimum length error", async () => {

    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "john.doe" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "short" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));

    await waitFor(() => {
      expect(
        screen.getByText("Password must be at least 6 characters."),
      ).toBeInTheDocument();
    });
  });

  it("should display error message when signup fails", async () => {
    const errorMessage = "An account with this username already exists.";
    (signup as any).mockResolvedValueOnce({ error: errorMessage });


    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "john.doe" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
    expect(signup).toHaveBeenCalledWith({

      username: "john.doe",
      password: "password123",
    });
    expect(authenticate).not.toHaveBeenCalled();
  });

  it("should display error message when authentication fails after signup", async () => {
    const authError = "Something went wrong.";
    (signup as any).mockResolvedValueOnce({ success: true });
    (authenticate as any).mockResolvedValueOnce(authError);


    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "john.doe" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));

    await waitFor(() => {
      expect(screen.getByText(authError)).toBeInTheDocument();
    });
    expect(signup).toHaveBeenCalledWith({

      username: "john.doe",
      password: "password123",
    });
    expect(authenticate).toHaveBeenCalledWith("", expect.any(FormData));
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("submits the form successfully and redirects to dashboard", async () => {
    (signup as any).mockResolvedValueOnce({ success: true });
    (authenticate as any).mockResolvedValueOnce(null);


    fireEvent.change(screen.getByLabelText("Username"), {
      target: { value: "john.doe" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password123" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create an account/i }));

    await waitFor(() => {
      expect(signup).toHaveBeenCalledWith({

        username: "john.doe",
        password: "password123",
      });
      expect(authenticate).toHaveBeenCalledWith("", expect.any(FormData));
      expect(mockPush).toHaveBeenCalledWith("/dashboard");
    });
  });
});
