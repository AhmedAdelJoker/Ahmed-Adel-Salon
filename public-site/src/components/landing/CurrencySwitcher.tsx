import { useCurrency } from "../../context/CurrencyContext";
import { useI18n } from "../../context/I18nContext";
import Switcher from "./Switcher";

/**
 * Currency switcher — EGP / USD / EUR / SAR / AED.
 *
 * Renders nothing unless the deployment supplied real exchange rates via
 * `VITE_CURRENCY_RATES`. Without them every rate is 1, so the control let a
 * visitor pick a currency that changed nothing on the page — an interface that
 * lies about what it does. With rates present, this is where they belong.
 *
 * `aria-label` comes from the catalogue; it used to be the English literal
 * "Switch currency" on an Arabic page.
 */
export interface CurrencySwitcherProps {
  className?: string;
}

export default function CurrencySwitcher({ className = "" }: CurrencySwitcherProps) {
  const { currency, setCurrency, availableCurrencies, hasRates, locale } = useCurrency();
  const { t } = useI18n();

  if (!hasRates) return null;

  return (
    <Switcher
      idPrefix="currency"
      className={className}
      label={t("currency.label")}
      listLabel={t("currency.listLabel")}
      value={currency}
      onChange={setCurrency}
      options={availableCurrencies.map((item) => ({
        id: item.code,
        label: `${item.code} · ${item[locale] ?? item.symbol}`,
      }))}
    />
  );
}
