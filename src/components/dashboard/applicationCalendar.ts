// Stable integer bands: the same color has the same meaning across years.
export const APPLICATION_COLORS = ["#90e0ef", "#48cae4", "#00b4d8", "#0077b6"];
export const APPLICATION_BANDS = ["1 application", "2–3 applications", "4–5 applications", "6+ applications"];

export const applicationLevel = (count: number) => count <= 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
