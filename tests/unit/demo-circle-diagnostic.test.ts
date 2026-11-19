import { describe, it, expect } from "vitest";
import {
  demoCircleDiagnostic,
  DemoCircleFailure,
} from "@/lib/customer/demo-circle-diagnostic";
describe("safe completion diagnostics", () => {
  it("keeps the real SQLSTATE and schema identifiers without copying SQL, values or raw errors", () => {
    const d = demoCircleDiagnostic(
      {
        code: "23503",
        table_name: "customer_projects",
        column_name: "circle_id",
        constraint_name: "customer_projects_circle_fk",
        message: "password and private contents",
        query: "SELECT private",
        detail: "Key contains a private value",
      },
      "gifts",
    );
    expect(d).toMatchObject({
      code: "23503",
      step: "gifts",
      table: "customer_projects",
      column: "circle_id",
      constraint: "customer_projects_circle_fk",
    });
    expect(JSON.stringify(d)).not.toMatch(/password|private|SELECT/);
  });
  it("rejects arbitrary metadata values and preserves safe connection failure codes", () => {
    expect(
      demoCircleDiagnostic(
        {
          code: "postgresql://private:password@server",
          constraint_name: "unsafe value with spaces",
        },
        "connect",
      ),
    ).toMatchObject({ code: "DATABASE_ERROR", constraint: undefined });
    expect(
      demoCircleDiagnostic({ code: "CONNECT_TIMEOUT" }, "connect").code,
    ).toBe("CONNECT_TIMEOUT");
  });
  it("can be carried to an operator response without retaining a raw cause", () => {
    const error = new DemoCircleFailure(
      demoCircleDiagnostic(
        { code: "42501", message: "private server details" },
        "members",
      ),
    );
    expect(error.message).toContain("permission");
    expect(error).not.toHaveProperty("cause");
  });
});
