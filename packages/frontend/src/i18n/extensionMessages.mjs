// UI-only formatter shared with tests; never modifies stored user data.
export function extensionTranslator(dictionary, render) {
  const escape = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const patterns = Object.keys(dictionary)
    .filter((key) => key.includes('{{'))
    .map((key) => ({
      key,
      names: [...key.matchAll(/{{(\w+)}}/g)].map((match) => match[1]),
      regex: new RegExp(
        '^' +
          key
            .split(/{{\w+}}/)
            .map(escape)
            .join('([\\s\\S]*?)') +
          '$'
      ),
    }))
  function translate(text, values = {}) {
    if (typeof text !== 'string') return text
    if (Object.hasOwn(dictionary, text)) return render(text, values)
    for (const { key, names, regex } of patterns) {
      const match = text.match(regex)
      if (match) return render(key, Object.fromEntries(names.map((name, index) => [name, translate(match[index + 1])])))
    }
    return text
  }
  return translate
}
