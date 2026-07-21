import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthProvider } from "../providers/auth-provider";
import HomePage from "./page";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}));

describe("HomePage", () => {
  it("renders the Omniflow heading while resolving where to redirect", () => {
    render(
      <AuthProvider>
        <HomePage />
      </AuthProvider>,
    );
    expect(screen.getByRole("heading", { name: "Omniflow" })).toBeInTheDocument();
  });
});
