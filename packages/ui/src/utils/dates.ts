import dayjs, { type Dayjs } from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";

export function getShortTimeDiffFrom(timestamp: number | bigint) {
  return getShortTimeDiffFromDate(dayjs(Number(timestamp)));
}

export function getShortTimeDiffFromDate(value?: Dayjs) {
  if (!value) return "";

  dayjs.extend(relativeTime);

  const now = dayjs();
  const targetDate = dayjs(value);

  if (targetDate.isBefore(now)) {
    return "0 minutes";
  }

  const diffMins = targetDate.diff(now, "minute");
  const diffHours = targetDate.diff(now, "hour");
  const diffDays = targetDate.diff(now, "day");
  const diffWeeks = targetDate.diff(now, "week");

  // Decide whether to show days or weeks
  if (Math.abs(diffMins) < 1) {
    return "less than a minute";
  } else if (Math.abs(diffMins) < 60) {
    return `${Math.abs(diffMins)} ${Math.abs(diffMins) === 1 ? "minute" : "minutes"}`;
  } else if (Math.abs(diffHours) < 24) {
    // Calculate remaining minutes after hours
    const remainingMins = Math.abs(diffMins) % 60;
    const hourText = `${Math.abs(diffHours)} ${Math.abs(diffHours) === 1 ? "hour" : "hours"}`;

    if (remainingMins === 0) {
      return hourText;
    } else {
      return `${hourText}, ${remainingMins} ${remainingMins === 1 ? "minute" : "minutes"}`;
    }
  } else if (Math.abs(diffDays) >= 15) {
    return `${Math.abs(diffWeeks)} ${Math.abs(diffWeeks) === 1 ? "week" : "weeks"}`;
  } else {
    return `${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "day" : "days"} `;
  }
}
