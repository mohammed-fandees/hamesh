/**
 * The Plans section, read from the server.
 *
 * Nothing about a plan is written into this page: its name, description,
 * price, discount and limits all come from `GET /v1/plans?v=3`, the same list
 * the extension shows. So a price changed in the admin panel is the price
 * here, and a page cached for a month cannot quote an old one. The answer also
 * carries where to pay; this page never shows that — paying happens in the
 * extension.
 *
 * The first card, for yourself, is the page's own: it has no price to look up.
 * While the answer is on its way the Teams cards are outlines. If it never
 * comes, or is not what we expect, the same cards are drawn without prices and
 * the section says where to find them.
 *
 * Everything the server sent is set as text, never as markup.
 */

const API_ORIGIN = 'https://api.hamesh.fandees.tech';
/** Long enough for a slow phone network; short enough not to leave outlines up. */
const TIMEOUT_MS = 8000;

const WORDS = {
  ar: {
    group: 'الفرق',
    fallbackFree: 'مجانية',
    fallbackPaid: 'مدفوعة',
    per: (days) => (days === 30 ? 'شهريًا' : `كل ${days} يومًا`),
    was: 'بدلًا من',
    sale: 'سعر مخفّض',
    percent: (n) => `خصم ${n}٪`,
    until: (date) => `حتى ${date}`,
    ownedTeams: 'فرق تملكها',
    members: 'الأعضاء في كل فريق',
    notes: 'الملاحظات في كل فريق',
    startsFree: 'تبدأ لحظة تسجيل الدخول',
    startsPaid: 'تبدأ فور قبول الدفعة',
  },
  en: {
    group: 'Teams',
    fallbackFree: 'Free',
    fallbackPaid: 'Paid',
    per: (days) => (days === 30 ? 'a month' : `every ${days} days`),
    was: 'Was',
    sale: 'Sale price',
    percent: (n) => `${n}% off`,
    until: (date) => `until ${date}`,
    ownedTeams: 'Teams you own',
    members: 'Members per team',
    notes: 'Notes per team',
    startsFree: 'Starts the moment you sign in',
    startsPaid: 'Starts once the payment is approved',
  },
};

const isInt = (n) => Number.isInteger(n);
const isText = (s) => typeof s === 'string';
const isLocalized = (v) => v !== null && typeof v === 'object' && isText(v.ar) && isText(v.en);

/** The plans in an answer, or null if it is not the shape v3 promises. */
export function readPlans(body) {
  if (!body || !Array.isArray(body.plans)) return null;
  const plans = [];
  for (const p of body.plans) {
    if (
      !p ||
      !isText(p.code) ||
      !p.price ||
      !isInt(p.price.amountMinor) ||
      p.price.amountMinor < 0 ||
      !isText(p.price.currency) ||
      !isInt(p.price.periodDays) ||
      !p.limits ||
      !isInt(p.limits.ownedTeams) ||
      !isInt(p.limits.membersPerTeam) ||
      !isInt(p.limits.notesPerTeam) ||
      !p.details ||
      !isLocalized(p.details.name) ||
      (p.details.description !== null && !isLocalized(p.details.description))
    ) {
      return null;
    }
    const d = p.discount;
    const discount =
      d && isInt(d.listAmountMinor) && isInt(d.endsAt)
        ? {
            percent: isInt(d.percent) ? d.percent : null,
            listAmountMinor: d.listAmountMinor,
            endsAt: d.endsAt,
            label: isLocalized(d.label) ? d.label : null,
          }
        : null;
    plans.push({ ...p, discount });
  }
  return plans.length ? plans : null;
}

function money(minor, currency, lang) {
  /* Nothing to pay reads as "EGP 0", not as an amount down to the piastre. */
  const digits = minor === 0 ? { minimumFractionDigits: 0, maximumFractionDigits: 0 } : {};
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency, ...digits }).format(
      minor / 100,
    );
  } catch {
    return `${(minor / 100).toFixed(2)} ${currency}`;
  }
}

const date = (ms, lang) =>
  new Intl.DateTimeFormat(lang, { dateStyle: 'medium', timeZone: 'Africa/Cairo' }).format(
    new Date(ms),
  );

/** Limits are figures to compare, written the same way in both languages. */
const count = (n) => new Intl.NumberFormat('en').format(n);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function card(name, lang, featured) {
  const node = el('article', featured ? 'tier tier--featured' : 'tier');
  const title = el('h3', 'tier__title');
  title.append(`${WORDS[lang].group} · `, el('span', 'tier__name', name));
  node.append(title);
  return node;
}

function bullets(items) {
  const list = el('ul', 'tier__list');
  list.append(...items.map((item) => el('li', '', item)));
  return list;
}

function tier(plan, lang, featured) {
  const w = WORDS[lang];
  const free = plan.price.amountMinor === 0;
  const node = card(plan.details.name[lang], lang, featured);
  node.dataset.plan = plan.code;

  if (plan.details.description) {
    node.append(el('p', 'tier__desc', plan.details.description[lang]));
  }

  const price = el('p', 'tier__price');
  price.append(el('strong', '', money(plan.price.amountMinor, plan.price.currency, lang)));
  if (!free) {
    price.append(el('span', '', w.per(plan.price.periodDays)));
    if (plan.discount) {
      const was = el('s');
      was.append(
        el('span', 'visually-hidden', `${w.was} `),
        money(plan.discount.listAmountMinor, plan.price.currency, lang),
      );
      price.append(was);
    }
  }
  node.append(price);

  if (!free && plan.discount) {
    const name =
      plan.discount.label?.[lang] ||
      (plan.discount.percent !== null ? w.percent(plan.discount.percent) : w.sale);
    node.append(el('p', 'tier__deal', `${name} · ${w.until(date(plan.discount.endsAt, lang))}`));
  }

  node.append(
    bullets([
      `${w.ownedTeams}: ${count(plan.limits.ownedTeams)}`,
      `${w.members}: ${count(plan.limits.membersPerTeam)}`,
      `${w.notes}: ${count(plan.limits.notesPerTeam)}`,
      free ? w.startsFree : w.startsPaid,
    ]),
  );
  return node;
}

/** The two Teams cards when there is nothing to quote: no price, no limit. */
function unpriced(lang) {
  const w = WORDS[lang];
  const free = card(w.fallbackFree, lang, false);
  free.append(bullets([w.startsFree]));
  const paid = card(w.fallbackPaid, lang, true);
  paid.append(bullets([w.startsPaid]));
  return [free, paid];
}

/**
 * Starts loading at once and draws whatever state it is in. `render` redraws
 * in the page's current language, for the language toggle.
 */
export function createPlans(section, { fetchImpl = fetch } = {}) {
  const list = section.querySelector('[data-plans]');
  const own = list.querySelector('[data-tier-own]');
  const unavailable = section.querySelector('[data-plans-unavailable]');
  const foot = section.querySelector('[data-plans-foot]');
  let plans = null;
  let failed = false;

  function render() {
    if (!plans && !failed) return; // the outlines in the markup stay up
    const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
    /* The outline is on the plan to move up to: the first paid one. */
    const featured = plans?.find((p) => p.price.amountMinor > 0)?.code;
    const teams = failed ? unpriced(lang) : plans.map((p) => tier(p, lang, p.code === featured));
    list.replaceChildren(own, ...teams);
    list.removeAttribute('aria-busy');
    unavailable.hidden = !failed;
    if (foot) foot.hidden = failed;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const ready = fetchImpl(`${API_ORIGIN}/v1/plans?v=3`, {
    credentials: 'omit',
    signal: controller.signal,
  })
    .then((res) => (res.ok ? res.json() : null))
    .then((body) => {
      plans = readPlans(body);
      failed = plans === null;
    })
    .catch(() => {
      failed = true;
    })
    .finally(() => {
      clearTimeout(timer);
      render();
    });

  return { render, ready };
}
