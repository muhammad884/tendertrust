export type Meta = { title: string; description: string; eligibility: string };
const PREFIX = "data:application/json;base64,";

export function encodeMeta(meta: object): { uri: string; json: string } {
  const json = JSON.stringify(meta);
  const bytes = new TextEncoder().encode(json);
  let bin = "";
  bytes.forEach((b) => { bin += String.fromCharCode(b); });
  return { uri: PREFIX + btoa(bin), json };
}

export function metaOf(uri: string): Meta {
  if (uri.startsWith(PREFIX)) {
    try {
      const bin = atob(uri.slice(PREFIX.length));
      const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
      const m = JSON.parse(new TextDecoder().decode(bytes));
      return {
        title: String(m.title ?? "Untitled tender"),
        description: String(m.description ?? ""),
        eligibility: String(m.eligibility ?? ""),
      };
    } catch {
      /* fall through to the raw URI */
    }
  }
  return { title: uri, description: "", eligibility: "" };
}

export const titleOf = (uri: string) => metaOf(uri).title;
