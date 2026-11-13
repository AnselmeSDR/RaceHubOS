// Presentation only: firmware bytes, API payloads and technical reports stay unchanged.
export const LANGUAGES = Object.freeze(["de", "en", "fr"]);
export function resolveLanguage(value) {
  const language = String(value || "de")
    .toLowerCase()
    .split(/[-_]/)[0];
  return LANGUAGES.includes(language) ? language : "de";
}
export function translate(message, dictionary) {
  const raw = String(message);
  const key = raw.trim().replace(/\s+/g, " ");
  if (Object.hasOwn(dictionary, key))
    return (
      raw.slice(0, raw.length - raw.trimStart().length) +
      dictionary[key] +
      raw.slice(raw.trimEnd().length)
    );
  // Parameter validation errors append numeric addresses/ranges to fixed fragments.
  let result = raw;
  for (const fragment of Object.keys(dictionary).sort(
    (a, b) => b.length - a.length,
  )) {
    if (fragment.length > 8 && raw.includes(fragment))
      result = result.replace(fragment, dictionary[fragment]);
  }
  return result;
}
const inBrowser = typeof document !== "undefined";
export const language = resolveLanguage(
  inBrowser ? new URL(location.href).searchParams.get("lang") : "de",
);
const dictionary = inBrowser
  ? await (
      await fetch(new URL(`./locales/${language}.json`, import.meta.url))
    ).json()
  : {};
export const t = (message) => translate(message, dictionary);
if (inBrowser) {
  document.documentElement.lang = language;
  const walker = document.createTreeWalker(
    document.documentElement,
    NodeFilter.SHOW_TEXT,
  );
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    if (!node.parentElement.closest("style, script, code"))
      node.textContent = t(node.textContent);
  }
  for (const element of document.querySelectorAll(
    "[aria-label], [placeholder]",
  ))
    for (const attribute of ["aria-label", "placeholder"])
      if (element.hasAttribute(attribute))
        element.setAttribute(attribute, t(element.getAttribute(attribute)));
  const select = document.getElementById("workshopLanguage");
  select.value = language;
  select.addEventListener("change", () => {
    const url = new URL(location.href);
    url.searchParams.set("lang", resolveLanguage(select.value));
    location.assign(url);
  });
}
