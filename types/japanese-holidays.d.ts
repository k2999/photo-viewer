declare module "japanese-holidays" {
  const JapaneseHolidays: {
    isHoliday(date: Date, furikae?: boolean): string | undefined;
    getHolidaysOf(year: number, furikae?: boolean): Array<{
      month: number;
      date: number;
      name: string;
    }>;
  };

  export default JapaneseHolidays;
}
