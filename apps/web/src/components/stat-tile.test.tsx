import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UserCheck } from "lucide-react";
import { StatTile } from "./stat-tile";

describe("StatTile", () => {
  it("renders the label and value", () => {
    render(<StatTile label="Active users" value={42} icon={UserCheck} />);
    expect(screen.getByText("Active users")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
  });

  it("renders a placeholder value while loading", () => {
    render(<StatTile label="Branches" value="—" icon={UserCheck} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });
});
