import { describe, expect, test } from "vitest";
import { parseEther } from "viem";
import { formatTokenAmount, formatPercentage } from "@/plugins/delegates/utils/formatting";

describe("formatTokenAmount", () => {
  test("formats zero amount cleanly", () => {
    const result = formatTokenAmount(0n);
    expect(result.formatted).toBe("0");
    expect(result.full).toBe("0");
  });

  test("adds decimal places for small amounts < 1 token", () => {
    const halfToken = parseEther("0.5");
    const result = formatTokenAmount(halfToken);
    expect(result.formatted).toBe("0.50");
    expect(result.full).toBe("0.5");
  });

  test("displays bound for amounts below minimum decimal threshold", () => {
    const tinyAmount = parseEther("0.005");
    const result = formatTokenAmount(tinyAmount);
    expect(result.formatted).toBe("<0.01");
    expect(result.full).toBe("0.005");
  });

  test("adds decimal places for amounts between 1 and 1000", () => {
    const amount = parseEther("12.345");
    const result = formatTokenAmount(amount);
    expect(result.formatted).toBe("12.35");
    expect(result.full).toBe("12.345");

    const roundAmount = parseEther("500");
    const resultRound = formatTokenAmount(roundAmount);
    expect(resultRound.formatted).toBe("500.00");
    expect(resultRound.full).toBe("500");
  });

  test("formats thousands with k and decimal precision", () => {
    const amount = parseEther("1234.56");
    const result = formatTokenAmount(amount);
    expect(result.formatted).toBe("1.23k");
    expect(result.full).toBe("1,234.56");
  });

  test("formats millions with M and decimal precision", () => {
    const amount = parseEther("1500000.75");
    const result = formatTokenAmount(amount);
    expect(result.formatted).toBe("1.50M");
    expect(result.full).toBe("1,500,000.75");
  });

  test("supports custom decimal precision parameter", () => {
    const amount = parseEther("1.23456");
    const result = formatTokenAmount(amount, 3);
    expect(result.formatted).toBe("1.235");
    expect(result.full).toBe("1.2346");
  });

  test("retains exact decimal in full for tiny nonzero amounts below 4 decimal places", () => {
    const oneWei = 1n;
    const resultWei = formatTokenAmount(oneWei);
    expect(resultWei.formatted).toBe("<0.01");
    expect(resultWei.full).toBe("0.000000000000000001");

    const tinyAmount = parseEther("0.00001");
    const resultTiny = formatTokenAmount(tinyAmount);
    expect(resultTiny.formatted).toBe("<0.01");
    expect(resultTiny.full).toBe("0.00001");
  });
});

describe("formatPercentage", () => {
  test("returns 0% when total is zero", () => {
    expect(formatPercentage(10n, 0n)).toBe("0%");
  });

  test("returns <1% for tiny non-zero percentages", () => {
    expect(formatPercentage(1n, 10000n)).toBe("<1%");
  });

  test("rounds normal percentages", () => {
    expect(formatPercentage(50n, 100n)).toBe("50%");
    expect(formatPercentage(33n, 100n)).toBe("33%");
  });
});
