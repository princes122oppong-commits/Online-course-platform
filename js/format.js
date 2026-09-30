/*
 * CourseHub display formatters.
 *
 * Shared so prices, dates and percentages look identical on every page.
 */
(function () {
  const CEDI = '\u20b5';

  const money = (value) =>
    `${CEDI}${Number(value || 0).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;

  const number = (value) => Number(value || 0).toLocaleString();

  const percent = (value) => `${Math.round(Number(value) || 0)}%`;

  const date = (value) => {
    if (!value) return 'Not available';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleDateString();
  };

  const dateTime = (value) => {
    if (!value) return 'Not available';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? 'Not available' : parsed.toLocaleString();
  };

  window.coursehubFormat = { money, number, percent, date, dateTime };
})();
