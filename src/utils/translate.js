/**
 * Нормализовать значение из словаря (строка или массив синонимов) в массив строк.
 * @param {string | string[] | null | undefined} value
 * @returns {string[]}
 */
export function dictionaryValueToArray(value) {
  if (value == null) return []
  if (Array.isArray(value)) return value.filter((s) => typeof s === 'string' && s.trim())
  return [String(value).trim()].filter(Boolean)
}

/**
 * Форматировать перевод для отображения: один вариант или несколько через запятую.
 * @param {string | string[] | null} translation — строка, массив синонимов или null
 * @returns {string} — строка для UI
 */
export function formatTranslation(translation) {
  const arr = Array.isArray(translation) ? translation : translation != null ? [translation] : []
  return arr.filter((s) => typeof s === 'string' && s.trim()).join(', ') || ''
}

/**
 * Получить один или несколько вариантов перевода: запрос к Google Translate с альтернативами (dt=at),
 * при недоступности — из локального словаря. Словарь может хранить строку или массив синонимов.
 * @param {string} word — слово (будет нормализовано: lowercase, без кавычек)
 * @param {Record<string, string | string[]> | null} dictionary — локальный словарь
 * @returns {Promise<string[] | null>} — массив вариантов перевода или null
 */
export async function getTranslations(word, dictionary) {
  if (!word || typeof word !== 'string') return null
  const key = word.replace(/^['"]|['"]$/g, '').toLowerCase().trim()
  if (!key) return null

  try {
    const encoded = encodeURIComponent(key)
    // dt=t — основной перевод, dt=at — альтернативные переводы по частям речи (синонимы)
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ru&dt=t&dt=at&q=${encoded}`
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, { method: 'GET', signal: controller.signal })
    clearTimeout(timeoutId)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data = await res.json()

    const variants = new Set()

    // Основной перевод: data[0][0][0]
    if (Array.isArray(data) && Array.isArray(data[0]) && data[0][0] != null && typeof data[0][0][0] === 'string') {
      variants.add(data[0][0][0].trim())
    }

    // Альтернативы по частям речи: data[1] = [ ['noun', ['вариант1','вариант2',...], ...], ['verb', [...], ...], ... ]
    if (Array.isArray(data[1])) {
      for (const block of data[1]) {
        if (Array.isArray(block) && Array.isArray(block[1])) {
          for (const v of block[1]) {
            if (typeof v === 'string' && v.trim()) variants.add(v.trim())
          }
        }
      }
    }

    if (variants.size > 0) return [...variants]
  } catch {
    // Сеть, CORS, таймаут, 429 — используем словарь
  }

  const fromDict = dictionaryValueToArray(dictionary?.[key])
  return fromDict.length > 0 ? fromDict : null
}

/**
 * Получить перевод слова (один вариант для обратной совместимости).
 * Возвращает первый вариант из getTranslations или строку из словаря.
 * @param {string} word
 * @param {Record<string, string | string[]> | null} dictionary
 * @returns {Promise<string | null>}
 */
export async function getTranslation(word, dictionary) {
  const arr = await getTranslations(word, dictionary)
  if (!arr || arr.length === 0) return null
  return arr[0]
}
