import { describe, expect, it } from "vitest";
import {
  CALC_MODEL_MULTIPLIERS,
  calcClamp,
  calcConvertCurrency,
  calcMonthlyCost,
  calcToNumber,
} from "../calc.js";

describe("calcConvertCurrency", () => {
  it("is identity for USD to USD", () => {
    expect(calcConvertCurrency(100, "USD", "USD")).toBe(100);
  });

  it("round-trips through the base currency", () => {
    const eur = calcConvertCurrency(100, "USD", "EUR");
    expect(calcConvertCurrency(eur, "EUR", "USD")).toBeCloseTo(100, 10);
  });

  it("falls back to USD for unknown codes", () => {
    expect(calcConvertCurrency(50, "XXX", "EUR")).toBe(
      calcConvertCurrency(50, "USD", "EUR"),
    );
  });
});

describe("calcMonthlyCost", () => {
  const row = (overrides = {}) => ({
    qty: 2,
    units: 730,
    price: 0.05,
    discount: 0,
    model: "on-demand",
    ...overrides,
  });

  it("multiplies qty × units × price at full rate", () => {
    expect(calcMonthlyCost(row(), CALC_MODEL_MULTIPLIERS)).toBeCloseTo(73);
  });

  it("applies the model multiplier", () => {
    expect(calcMonthlyCost(row({ model: "spot" }), CALC_MODEL_MULTIPLIERS)).toBeCloseTo(73 * 0.35);
  });

  it("applies percentage discounts", () => {
    expect(calcMonthlyCost(row({ discount: 25 }), CALC_MODEL_MULTIPLIERS)).toBeCloseTo(73 * 0.75);
  });

  it("treats unknown models as full price", () => {
    expect(calcMonthlyCost(row({ model: "quantum" }), CALC_MODEL_MULTIPLIERS)).toBeCloseTo(73);
  });
});

describe("calcToNumber / calcClamp", () => {
  it("falls back on garbage input", () => {
    expect(calcToNumber("abc", 5)).toBe(5);
    expect(calcToNumber(null)).toBe(0);
  });

  it("clamps into range", () => {
    expect(calcClamp(12, 0, 100)).toBe(12);
    expect(calcClamp(-1, 0, 100)).toBe(0);
    expect(calcClamp(101, 0, 100)).toBe(100);
  });
});
