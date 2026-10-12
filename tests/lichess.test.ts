import { it, expect } from "vitest";
import { importForm, prepareForm, signedOut } from "../src/lichess/import-form";
it("prepares only the observed native import form without submitting", () => {
  document.body.innerHTML =
    '<form action="/import" method="post"><textarea name="pgn"></textarea><input name="analyse" type="checkbox"><button type="submit">Import game</button></form>';
  const form = importForm(document);
  if (!form) throw new Error();
  let submits = 0;
  form.form.addEventListener("submit", () => submits++);
  prepareForm(form, "1. e4 *", true);
  expect(form.pgn.value).toBe("1. e4 *");
  expect(form.analyse.checked).toBe(true);
  expect(submits).toBe(0);
});
it("detects signed-out UI and fails closed on selector changes", () => {
  document.body.innerHTML =
    '<a href="/login?referrer=/paste">Sign in</a><form action="https://evil.test/import" method="post"></form>';
  expect(signedOut(document)).toBe(true);
  expect(importForm(document)).toBeUndefined();
});
