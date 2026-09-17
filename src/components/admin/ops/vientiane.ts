/** SPP works on Vientiane time (UTC+7, no daylight saving). Staff may be travelling; the UI always says which zone it shows. */
export const VTE = "Asia/Vientiane";
const OFFSET = 7 * 3600e3;
const dt = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false, timeZone: VTE });
const tm = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: VTE });

export const vteDateTime = (iso: string | null | undefined) => (iso ? `${dt.format(new Date(iso))} ICT` : "—");
export const vteTime = (iso: string) => tm.format(new Date(iso));
/** yyyy-mm-dd of an instant, as read on a wall clock in Vientiane */
export const vteDay = (ms: number) => new Date(ms + OFFSET).toISOString().slice(0, 10);
/** value for <input type="datetime-local"> showing Vientiane wall time */
export const toVteInput = (iso: string | null | undefined) => (iso ? new Date(new Date(iso).getTime() + OFFSET).toISOString().slice(0, 16) : "");
/** datetime-local value typed as Vientiane wall time → ISO instant */
export const fromVteInput = (v: string) => (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v) ? new Date(`${v.slice(0, 16)}:00+07:00`).toISOString() : null);
