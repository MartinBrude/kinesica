import { AUTO_REFRESH_START_HOUR, AUTO_REFRESH_END_HOUR } from "./interacciones-constants.js";

export function isWithinAutoRefreshHours(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return false;
  const totalMinutes = d.getHours() * 60 + d.getMinutes();
  return (
    totalMinutes >= AUTO_REFRESH_START_HOUR * 60 &&
    totalMinutes <= AUTO_REFRESH_END_HOUR * 60
  );
}
