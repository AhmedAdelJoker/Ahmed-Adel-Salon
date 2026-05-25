export function buildQuery(params = {}) {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      Number.isNaN(value)
    ) {
      return;
    }

    query.append(key, value);
  });

  const result = query.toString();
  return result ? `?${result}` : "";
}
