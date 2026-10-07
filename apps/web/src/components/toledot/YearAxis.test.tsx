import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { YearAxis } from "./YearAxis";

afterEach(cleanup);

describe("YearAxis", () => {
  it("labels ticks through formatYear", () => {
    const { container } = render(<YearAxis from={-1500} to={-500} step={250} />);
    for (const label of ["1500 BCE", "1250 BCE", "1000 BCE", "750 BCE", "500 BCE"]) {
      expect(screen.getByText(label)).toBeTruthy();
    }
    expect(container.textContent?.match(/\d+ (BCE|CE)/g)).toHaveLength(5);
  });

  it("never renders a year-zero tick when the window crosses it", () => {
    const { container } = render(<YearAxis from={-200} to={300} step={100} />);
    expect(screen.getByText("100 BCE")).toBeTruthy();
    expect(screen.getByText("100 CE")).toBeTruthy();
    expect(screen.queryByText("0")).toBeNull();
    expect(container.textContent).not.toMatch(/(^|\D)0 (BCE|CE)/);
  });
});
