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
 * While the answer is on its way the two cards are outlines of their own size.
 * If it never comes, or is not what we expect, the section says where the
 * plans are instead of guessing at them.
 *
 * Everything the server sent is set as text, never as markup.
 */

const API_ORIGIN = 'https://api.hamesh.fandees.tech';
const STORE_URL =
  'https://chromewebstore.google.com/detail/hamesh-%E2%80%94-%D9%87%D8%A7%D9%85%D8%B4/giajamkkehcoienhhlcfgcckahjjbgnc';
/** Long enough for a slow phone network; short enough not to leave outlines up. */
const TIMEOUT_MS = 8000;

const WORDS = {
  ar: {
    free: 'مجانًا',
    renews: (days) => (days === 30 ? 'تتجدد كل شهر' : `تتجدد كل ${days} يومًا`),
    per: (days) => (days === 30 ? 'شهريًا' : `كل ${days} يومًا`),
    was: 'بدلًا من',
    sale: 'سعر مخفّض',
    percent: (n) => `خصم ${n}٪`,
    until: (date) => `حتى ${date}`,
    start: 'تبدأ بها تلقائيًا',
    ownedTeams: 'فرق تملكها',
    members: 'الأعضاء في كل فريق',
    notes: 'الملاحظات في كل فريق',
    ctaFree: 'أضِفه إلى Chrome وابدأ ↗',
    ctaPaid: 'أضِفه إلى Chrome ↗',
    howFree: 'بلا بطاقة، وبلا تجربة تنتهي.',
    howPaid: 'تشترك من داخل الإضافة: الإعدادات ← الخطة.',
  },
  en: {
    free: 'Free',
    renews: (days) => (days === 30 ? 'renews every month' : `renews every ${days} days`),
    per: (days) => (days === 30 ? 'a month' : `every ${days} days`),
    was: 'Was',
    sale: 'Sale price',
    percent: (n) => `${n}% off`,
    until: (date) => `until ${date}`,
    start: 'Where everyone starts',
    ownedTeams: 'Teams you own',
    members: 'Members per team',
    notes: 'Notes per team',
    ctaFree: 'Add to Chrome and begin ↗',
    ctaPaid: 'Add to Chrome ↗',
    howFree: 'No card, and no trial that runs out.',
    howPaid: 'Subscribe inside the extension: Settings → Plan.',
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
  try {
    return new Intl.NumberFormat(lang, { style: 'currency', currency }).format(minor / 100);
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

function tier(plan, lang, isDefault) {
  const w = WORDS[lang];
  const free = plan.price.amountMinor === 0;
  const card = el('article', isDefault ? 'tier tier--default' : 'tier');
  card.dataset.plan = plan.code;

  const top = el('div', 'tier__top');
  top.append(el('h3', 'tier__name', plan.details.name[lang]));
  if (isDefault) top.append(el('span', 'tier__chip', w.start));
  card.append(top);

  if (plan.details.description) {
    card.append(el('p', 'tier__desc', plan.details.description[lang]));
  }

  const price = el('p', 'tier__price');
  if (free) {
    price.append(el('strong', '', w.free), el('span', '', w.renews(plan.price.periodDays)));
  } else {
    price.append(
      el('strong', '', money(plan.price.amountMinor, plan.price.currency, lang)),
      el('span', '', w.per(plan.price.periodDays)),
    );
    if (plan.discount) {
      const was = el('s');
      was.append(
        el('span', 'visually-hidden', `${w.was} `),
        money(plan.discount.listAmountMinor, plan.price.currency, lang),
      );
      price.append(was);
    }
  }
  card.append(price);

  if (!free && plan.discount) {
    const name =
      plan.discount.label?.[lang] ||
      (plan.discount.percent !== null ? w.percent(plan.discount.percent) : w.sale);
    card.append(el('p', 'tier__deal', `${name} · ${w.until(date(plan.discount.endsAt, lang))}`));
  }

  const limits = el('dl', 'tier__limits');
  for (const [label, value] of [
    [w.ownedTeams, plan.limits.ownedTeams],
    [w.members, plan.limits.membersPerTeam],
    [w.notes, plan.limits.notesPerTeam],
  ]) {
    const row = el('div');
    row.append(el('dt', '', label), el('dd', '', count(value)));
    limits.append(row);
  }
  card.append(limits);

  const cta = el(
    'a',
    `btn ${free ? 'btn--primary' : 'btn--ghost'} tier__cta`,
    free ? w.ctaFree : w.ctaPaid,
  );
  cta.href = STORE_URL;
  cta.target = '_blank';
  cta.rel = 'noopener';
  card.append(cta, el('p', 'tier__how', free ? w.howFree : w.howPaid));
  return card;
}

/**
 * Starts loading at once and draws whatever state it is in. `render` redraws
 * in the page's current language, for the language toggle.
 */
export function createPlans(section, { fetchImpl = fetch } = {}) {
  const list = section.querySelector('[data-plans]');
  const unavailable = section.querySelector('[data-plans-unavailable]');
  const foot = section.querySelector('[data-plans-foot]');
  let plans = null;
  let failed = false;

  function render() {
    if (failed) {
      list.hidden = true;
      if (foot) foot.hidden = true;
      unavailable.hidden = false;
      return;
    }
    if (!plans) return; // the outlines in the markup stay up
    const lang = document.documentElement.lang === 'en' ? 'en' : 'ar';
    // The first free plan is the one everyone is put on.
    const defaultCode = plans.find((p) => p.price.amountMinor === 0)?.code;
    list.replaceChildren(...plans.map((p) => tier(p, lang, p.code === defaultCode)));
    list.removeAttribute('aria-busy');
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
