import JapaneseHolidays from "japanese-holidays";

export function getJapaneseHolidayName(year: number, month: number, day: number): string | null {
  const name = JapaneseHolidays.isHoliday(new Date(year, month - 1, day));
  return typeof name === "string" ? name : null;
}
