import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const seedPath = path.join(__dirname, '../src/data/seed-warehouse.json')

const CATEGORIES = [
  'Упаковка',
  'Скотч и лента',
  'Этикетки Celloplex',
  'Этикетки Стеклоплекс',
  'Этикетки заказчика',
  'Сетка и ткань Simo',
  'Сетка и ткань Xinbei',
  'Нити и ровинг',
  'Стеклоткань прочее',
  'Брак',
  'Пропиточный состав',
  'Пигменты и красители',
  'Химия и добавки',
  'СИЗ',
  'Спецодежда',
  'Канцтовары',
  'Кухня',
  'Хозяйство и уборка',
  'Мебель и оборудование',
  'Лаборатория',
  'Аптека и страховка',
]

function cleanName(raw) {
  let n = raw
    .replace(/\s+/g, ' ')
    .replace(/\n/g, ' ')
    .replace(/\*/g, '×')
    .replace(/\s*\?\?\?\s*/g, '')
    .replace(/\s*\(шт\)\s*/gi, '')
    .replace(/\s*\(кг\)\s*/gi, '')
    .replace(/\s*кг\s*$/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  const fixes = [
    [/^паллет/i, 'Паллета'],
    [/^коробка/i, 'Коробка'],
    [/^гильза/i, 'Гильза'],
    [/^стрейч/i, 'Стрейч'],
    [/^пленка/i, 'Плёнка'],
    [/^лента/i, 'Лента'],
    [/^клипсы/i, 'Клипсы'],
    [/^бечевка/i, 'Бечёвка'],
    [/^скотч/i, 'Скотч'],
    [/^этикетки/i, 'Этикетки'],
    [/^Этикетки/, 'Этикетки'],
    [/^Групповая этикетка/i, 'Групповая этикетка'],
    [/^Сетка сур\b/i, 'Сетка суровая'],
    [/^Сетка суровая/i, 'Сетка суровая'],
    [/^Стеклоткань/i, 'Стеклоткань'],
    [/^Glass fabric/i, 'Стеклоткань Rooflex'],
    [/^Нить/i, 'Нить'],
    [/^Директ/i, 'Дirect roving'],
    [/^Direct Roving/i, 'Direct roving'],
    [/^E-glass Yarn/i, 'E-glass yarn'],
    [/^Дисперс/i, 'Дисперсия'],
    [/^дисперс/i, 'Дисперсия'],
    [/^планшетки/i, 'Блокнот'],
    [/^бумага офисная/i, 'Бумага офисная'],
    [/^файлы/i, 'Файлы'],
    [/^нож канц/i, 'Нож канцелярский'],
    [/^лезвие/i, 'Лезвия для канцелярского ножа'],
    [/^ножницы/i, 'Ножницы'],
    [/^маркер \(для доски\)/i, 'Маркер для доски'],
    [/^Маркер/i, 'Маркер'],
    [/^карандаш$/i, 'Карандаш'],
    [/^ручка/i, 'Ручка'],
    [/^КЛЕЙ/i, 'Клей'],
    [/^вода Боржоми/i, 'Вода Боржоми'],
    [/^вода дист/i, 'Вода дистиллированная'],
    [/^Вода дист/i, 'Вода дистиллированная'],
    [/^пакет для мусора/i, 'Пакеты для мусора'],
    [/^Губки/i, 'Губки'],
    [/^Удленители/i, 'Удлинители'],
    [/\(gialla\)/i, '(жёлтые)'],
    [/\bсур\b/gi, 'суровая'],
    [/\bрул\b/gi, 'рулон'],
    [/\bмт\b/gi, 'м'],
    [/\bRatl\b/gi, 'Ratl'],
    [/\bМембр\b/gi, 'Membrane'],
  ]
  for (const [re, rep] of fixes) n = n.replace(re, rep)

  // capitalize first letter if lowercase start
  if (n && n[0] === n[0].toLowerCase() && /^[а-яё]/.test(n)) {
    n = n[0].toUpperCase() + n.slice(1)
  }
  return n
}

function inferUnit(name) {
  const n = name.toLowerCase()
  if (/\(кг\)|\bкг\b|tex|кг,/.test(n) || /yarn|roving|дисперс|кальцит|крахмал|лаканил|akef|смола|репелент|пеногас|кислот/i.test(n)) {
    if (/м2|м²|\/\s*\d+\s*м2/.test(n)) return 'м²'
    return 'кг'
  }
  if (/м2|м²/.test(n)) return 'м²'
  if (/рул|рулон/.test(n)) return 'рул'
  if (/упак|уп=|\(1 уп/.test(n)) return 'уп'
  if (/л\b|1\s*л|5л|19\s*л/.test(n)) return 'л'
  return 'шт'
}

function inferCategory(name, oldCat) {
  const n = name.toLowerCase()
  const c = oldCat.toLowerCase()

  if (/брак/.test(n) || c === 'брак') return 'Брак'
  if (/celloplex|сelloplex/.test(n)) return 'Этикетки Celloplex'
  if (/стеклоплекс|stekloplex/.test(n) && !/заказчик/.test(n)) return 'Этикетки Стеклоплекс'
  if (
    /sando|global|caucasus|link|biemme|buffa|building solution|заказчик/.test(n) ||
    c.includes('заказчик')
  )
    return 'Этикетки заказчика'
  if (/скотч/.test(n)) return 'Скотч и лента'
  if (
    /паллет|коробка|гильза|бечев|стрейч|пл[её]нк|лента пвх|клипс|рукав для угол|уголк/.test(n) ||
    c === 'упаковка'
  )
    return 'Упаковка'
  if (/simo/.test(n) && /сетк|стеклоткан|стеклообои|образец/.test(n)) return 'Сетка и ткань Simo'
  if (/xinbei/.test(n) && /сетк|дисперс/.test(n)) {
    if (/дисперс|акратам/.test(n)) return 'Пропиточный состав'
    return 'Сетка и ткань Xinbei'
  }
  if (/yarn|roving|нить|ровинг|tex/.test(n)) return 'Нити и ровинг'
  if (/сетк|стеклоткан|ft mesh|крепикс|rooflex|fenix|glass fabric/.test(n)) {
    if (/simo/.test(n)) return 'Сетка и ткань Simo'
    if (/xinbei/.test(n)) return 'Сетка и ткань Xinbei'
    return 'Стеклоткань прочее'
  }
  if (
    /дисперс|ll-106|ll-145|colorcoat|кальцит|пластифик|дисперг|загустит|крахмал|куб пласт|litex|синтомер|акратам/.test(
      n,
    ) ||
    c.includes('пропит') ||
    (/xinbei/.test(c) && /дисперс/.test(n))
  )
    return 'Пропиточный состав'
  if (/лаканил|пигмент|pigmarama|colorguard|репелент/.test(n) || c.includes('pigmarama'))
    return 'Пигменты и красители'
  if (/akef|карбамид|уксус|пеногас/.test(n) || c.includes('уксус') || c.includes('пеногас'))
    return 'Химия и добавки'
  if (
    /перчатк|маск|комбинезон|фартук|очк|респиратор/.test(n) ||
    c.includes('респиратор') ||
    c.includes('очки')
  ) {
    if (/лаборатор|медицин/.test(n)) return 'Лаборатория'
    return 'СИЗ'
  }
  if (/лето спец|зима спец|спец одежд|спец обув|сапог/.test(n) || c.includes('спец'))
    return 'Спецодежда'
  if (
    /планшет|папк|бумага офис|файл|нож канц|лезви|ножниц|маркер|карандаш|ручк|степлер|скоб|стикер.*дат|органайзер|тетрад|точил|клей|дырокол|выделител|спрей.*доск|стикер белый.*сканер/.test(
      n,
    ) ||
    ['офис', 'тетрадь', 'точилка', 'степлер', 'дирокол', 'выделитель'].some((x) => c.includes(x))
  )
    return 'Канцтовары'
  if (/чай|сахар|кофе|боржоми|капсул.*кофе/.test(n) || c === 'кухня') return 'Кухня'
  if (
    /туалет|полотенц|мыло|посуды|доместос|швабр|веник|ведро|мусор|губк|щетк|скребок/.test(n) ||
    c.includes('химия') ||
    c.includes('доместос') ||
    c.includes('веник')
  )
    return 'Хозяйство и уборка'
  if (
    /стол|стул|кресл|подставк|кофемашин|karcher|весы|обогреват|настольн/.test(n) ||
    c.includes('пистолет') ||
    c.includes('обогреват') ||
    c.includes('скребок') ||
    c.includes('доска офис')
  ) {
    if (/чаш.*фольг|дистил|дермантин/.test(n)) return 'Лаборатория'
    if (/удлинит|тройник/.test(n)) return 'Мебель и оборудование'
    return 'Мебель и оборудование'
  }
  if (/аптеч|страхов|ремень.*лестниц|drop для глаз/.test(n) || c.includes('аптеч'))
    return 'Аптека и страховка'
  if (/дистил|фольг|дермантин|лаборатор/.test(n)) return 'Лаборатория'

  return 'Прочее'
}

const raw = JSON.parse(fs.readFileSync(seedPath, 'utf8'))
const items = raw.items.map((it) => {
  const name = cleanName(it.name)
  const category = inferCategory(it.name, it.category)
  const unit = inferUnit(it.name + ' ' + it.category)
  return { name, category, unit }
})

const out = {
  categories: CATEGORIES,
  items,
}

fs.writeFileSync(seedPath, JSON.stringify(out, null, 2) + '\n', 'utf8')
console.log('Fixed', items.length, 'items,', CATEGORIES.length, 'categories')

// stats
const byCat = {}
for (const i of items) byCat[i.category] = (byCat[i.category] || 0) + 1
console.log(byCat)
