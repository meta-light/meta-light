// Example of consuming the shared workspace package `@meta-light/utils`.
// Import anything exported from packages/utils/src/index.ts. Safe to delete —
// it exists to demonstrate the shared-package wiring.
import { truncateAddress, formatUsd } from "@meta-light/utils";

export const exampleAddress = truncateAddress(
  "So11111111111111111111111111111111111111112",
);

export const examplePrice = formatUsd(1234.5);
