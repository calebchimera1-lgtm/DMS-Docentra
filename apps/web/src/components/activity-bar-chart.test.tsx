import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ActivityBarChart } from "./activity-bar-chart";

describe("ActivityBarChart", () => {
  it("renders a bar with a human-readable label and count per action", () => {
    render(<ActivityBarChart data={[{ action: "LOGIN", count: 4 }, { action: "CREATE", count: 1 }]} />);
    expect(screen.getByText("Login")).toBeInTheDocument();
    expect(screen.getByText("Create")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("shows an empty state when there is no activity", () => {
    render(<ActivityBarChart data={[]} />);
    expect(screen.getByText(/no activity/i)).toBeInTheDocument();
  });
});
