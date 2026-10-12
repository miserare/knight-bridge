export type ImportForm = {
  form: HTMLFormElement;
  pgn: HTMLTextAreaElement;
  analyse: HTMLInputElement;
  submit: HTMLButtonElement;
};
export function importForm(doc: Document): ImportForm | undefined {
  const form = doc.querySelector<HTMLFormElement>(
    'form[action="/import"][method="post"]',
  );
  const pgn = form?.querySelector<HTMLTextAreaElement>('textarea[name="pgn"]');
  const analyse = form?.querySelector<HTMLInputElement>(
    'input[name="analyse"][type="checkbox"]',
  );
  const submit = form?.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  return form && pgn && analyse && submit
    ? { form, pgn, analyse, submit }
    : undefined;
}
export function signedOut(doc: Document): boolean {
  return !!doc.querySelector('a[href^="/login"],a[href^="/signup"]');
}
export function prepareForm(
  form: ImportForm,
  pgn: string,
  requestAnalysis: boolean,
): void {
  form.pgn.value = pgn;
  form.pgn.dispatchEvent(new Event("input", { bubbles: true }));
  form.pgn.dispatchEvent(new Event("change", { bubbles: true }));
  form.analyse.checked = requestAnalysis;
  form.analyse.dispatchEvent(new Event("change", { bubbles: true }));
}
