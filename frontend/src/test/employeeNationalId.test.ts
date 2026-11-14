import { describe, it, expect } from "vitest";
import {
  analyzeNationalId,
  validateNationalId,
  findNationalIdConflict,
  GOVERNORATE_NAMES,
} from "@/features/hr/utils/nationalId";

describe("analyzeNationalId", () => {
  it("accepts an empty value as 'not recorded'", () => {
    const result = analyzeNationalId("");
    expect(result.error).toBeNull();
    expect(result.info).toBeNull();
  });

  it("reads a valid id and decodes birth date and governorate", () => {
    // C=3 (2000s) YY=00 MM=01 DD=01, governorate 01 القاهرة, serial 2345.
    const result = analyzeNationalId("30001010123451");
    expect(result.error).toBeNull();
    expect(result.info?.birthDate).toBe("2000-01-01");
    expect(result.info?.governorateCode).toBe("01");
    expect(result.info?.governorateName).toBe("القاهرة");
  });

  it("reads an Arabic-Indic id like its English form", () => {
    const result = analyzeNationalId("٣٠٠٠١٠١٠١٢٣٤٥١");
    expect(result.error).toBeNull();
    expect(result.info?.birthDate).toBe("2000-01-01");
  });

  it("rejects a 13-digit id — 14 is the length, not a suggestion", () => {
    // The actual value stored by employee 1 on this machine.
    expect(validateNationalId("3000259548542")).toMatch(/14/);
  });

  it("rejects an id whose embedded date does not exist", () => {
    // The actual value stored by employee 2: day 84.
    expect(validateNationalId("30005849342594")).toMatch(/تاريخ ميلاد/);
  });

  it("rejects an impossible month, not just an impossible day", () => {
    expect(validateNationalId("30011310123451")).toMatch(/تاريخ ميلاد/);
  });

  it("requires the century digit to be 2 or 3", () => {
    // 4 would place the birth in the 2100s.
    expect(validateNationalId("40001010123451")).toMatch(/2 أو 3/);
    expect(validateNationalId("10001010123451")).toMatch(/2 أو 3/);
  });

  it("accepts pre-2000 births (century 2 → 1900s)", () => {
    const result = analyzeNationalId("28501010123451");
    expect(result.error).toBeNull();
    expect(result.info?.birthDate).toBe("1985-01-01");
  });

  it("maps the born-abroad code 88", () => {
    const result = analyzeNationalId("30001018823451");
    expect(result.info?.governorateName).toBe("خارج الجمهورية");
  });

  it("accepts a governorate code without a known name, and says so", () => {
    const result = analyzeNationalId("30001013023451");
    expect(result.error).toBeNull();
    expect(result.info?.governorateName).toBe("محافظة 30");
  });

  it("rejects a governorate code outside 01–35 and 88", () => {
    expect(validateNationalId("30001019923451")).toMatch(/محافظة/);
  });

  it("knows the canonical governorate names", () => {
    expect(GOVERNORATE_NAMES["01"]).toBe("القاهرة");
    expect(GOVERNORATE_NAMES["14"]).toBe("الجيزة");
  });
});

describe("findNationalIdConflict", () => {
  const roster = [
    { id: 1, fullName: "أحمد عادل", nationalId: "30001010123451" },
    { id: 2, fullName: "محمد سامي", nationalId: "28501010123452" },
  ];

  it("finds a holder even when the id is typed in Arabic numerals", () => {
    const conflict = findNationalIdConflict("٣٠٠٠١٠١٠١٢٣٤٥١", roster);
    expect(conflict?.id).toBe(1);
    expect(conflict?.name).toBe("أحمد عادل");
  });

  it("skips the employee being edited", () => {
    expect(findNationalIdConflict("30001010123451", roster, 1)).toBeNull();
    expect(findNationalIdConflict("30001010123451", roster, "1")).toBeNull();
  });

  it("returns null for empty input without scanning", () => {
    expect(findNationalIdConflict("", roster)).toBeNull();
  });
});
