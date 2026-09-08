export function buildQuery(params: Record<string, any> = {}): string {
  const query = new URLSearchParams();

  Object.entries(params).forEach(([key, value]: [string, any]) => {
    if (
      value === undefined ||
      value === null ||
      value === "" ||
      Number.isNaN(value)
    ) {
      return;
    }

    query.append(key, String(value));
  });

  const result = query.toString();
  return result ? `?${result}` : "";
}
