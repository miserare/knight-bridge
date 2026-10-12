export const style = `
:host{all:initial;display:block;color-scheme:light dark;font:14px/1.5 system-ui,sans-serif;color:#222b29}
*{box-sizing:border-box}.panel{margin:8px 0;padding:12px;border:1px solid #b8c9c2;border-radius:12px;background:#f6faf7;color:#222b29}
button,a.action{font:600 14px/1.3 system-ui,sans-serif;min-height:44px;border-radius:8px;border:1px solid transparent;padding:10px 14px;background:#205943;color:#fff;cursor:pointer;text-decoration:none;display:inline-flex;align-items:center;justify-content:center}
button:hover,a.action:hover{background:#143e2e}button:disabled{opacity:.6;cursor:wait}button:focus-visible,a:focus-visible{outline:3px solid #df961a;outline-offset:3px}
p{margin:8px 0 0}a{color:#205943}.eyebrow{font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;margin-bottom:6px;color:#52665e}
@media(prefers-color-scheme:dark){.panel{background:#202b27;color:#eff6f2;border-color:#53675e}a{color:#a9debd}.eyebrow{color:#b2c6bb}button{background:#99d2ad;color:#132b1e}button:hover{background:#bee3ca}}
:host([data-theme="dark"]) .panel{background:#202b27;color:#eff6f2;border-color:#53675e}:host([data-theme="dark"]) .eyebrow{color:#b2c6bb}:host([data-theme="dark"]) button{background:#99d2ad;color:#132b1e}
:host([data-theme="light"]) .panel{background:#f6faf7;color:#222b29;border-color:#b8c9c2}:host([data-theme="light"]) .eyebrow{color:#52665e}:host([data-theme="light"]) button{background:#205943;color:#fff}
:host([data-layout="floating"]){position:fixed;right:16px;bottom:16px;z-index:2147483646;width:min(320px,calc(100vw - 32px))}
`;
export function panel(
  doc: Document,
  id: string,
): {
  host: HTMLElement;
  root: ShadowRoot;
  body: HTMLElement;
  status: HTMLParagraphElement;
} {
  const host = doc.createElement("div");
  host.id = id;
  const root = host.attachShadow({ mode: "open" });
  const css = doc.createElement("style");
  css.textContent = style;
  root.append(css);
  const body = doc.createElement("section");
  body.className = "panel";
  body.setAttribute("aria-label", "Knight Bridge");
  root.append(body);
  const brand = doc.createElement("div");
  brand.className = "eyebrow";
  brand.textContent = "Knight Bridge";
  body.append(brand);
  const status = doc.createElement("p");
  status.setAttribute("role", "status");
  status.setAttribute("aria-live", "polite");
  status.setAttribute("aria-atomic", "true");
  body.append(status);
  return { host, root, body, status };
}
