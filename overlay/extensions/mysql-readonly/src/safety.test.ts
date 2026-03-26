import { describe, expect, it } from "vitest";
import { MysqlReadonlyError } from "./errors.js";
import { assertReadonlySql, extractReferencedTables } from "./safety.js";

describe("assertReadonlySql", () => {
  it("accepts select statements", () => {
    expect(assertReadonlySql("SELECT * FROM orders LIMIT 10;")).toBe(
      "SELECT * FROM orders LIMIT 10",
    );
  });

  it("accepts show statements", () => {
    expect(assertReadonlySql("SHOW TABLES")).toBe("SHOW TABLES");
  });

  it("rejects write statements", () => {
    expect(() => assertReadonlySql("DELETE FROM orders")).toThrowError(
      new MysqlReadonlyError(
        "mysql_readonly only allows SELECT, SHOW, DESCRIBE, DESC, EXPLAIN, or WITH queries",
      ),
    );
  });

  it("rejects forbidden keywords inside with queries", () => {
    expect(() => assertReadonlySql("WITH t AS (SELECT 1) UPDATE orders SET id = 1")).toThrow(
      "mysql_readonly rejected forbidden keyword: UPDATE",
    );
  });

  it("rejects comments and multiple statements", () => {
    expect(() => assertReadonlySql("SELECT 1; SELECT 2")).toThrow(
      "Multiple SQL statements are not allowed in mysql_readonly",
    );
    expect(() => assertReadonlySql("SELECT 1 -- hi")).toThrow(
      "SQL comments are not allowed in mysql_readonly",
    );
  });
});

describe("extractReferencedTables", () => {
  it("extracts referenced tables from from and join clauses", () => {
    expect(
      extractReferencedTables(
        "SELECT o.id FROM orders o JOIN `users` u ON u.id = o.user_id JOIN app.audit_log a ON a.user_id = u.id",
      ),
    ).toEqual(["orders", "users", "audit_log"]);
  });
});
