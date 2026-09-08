export function currency(value = 0, locale = "ar-EG", currencyCode = "EGP") {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(Number(value || 0));
  } catch (err) {
    return `${Number(value || 0).toFixed(2)} ${currencyCode}`;
  }
}

export function number(value = 0, locale = "ar-EG") {
  try {
    return new Intl.NumberFormat(locale).format(Number(value || 0));
  } catch (err) {
    return String(value || 0);
  }
}

export function dateTime(value, locale = "ar-EG") {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleString(locale);
  } catch (err) {
    return String(value);
  }
}

export function dateOnly(value, locale = "ar-EG") {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(locale);
  } catch (err) {
    return String(value);
  }
}

export function timeOnly(value, locale = "ar-EG") {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleTimeString(locale);
  } catch (err) {
    return String(value);
  }
}
