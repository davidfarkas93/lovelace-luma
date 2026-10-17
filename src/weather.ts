export interface WeatherForecast {
  datetime?: string; condition?: string; temperature?: number; templow?: number;
  apparent_temperature?: number; precipitation?: number; precipitation_probability?: number;
  humidity?: number; wind_speed?: number; wind_gust_speed?: number; wind_bearing?: number;
  pressure?: number; uv_index?: number; dew_point?: number; visibility?: number;
}

const conditions: Record<string, [string, string, string, string]> = {
  sunny: ["mdi:weather-sunny", "#b9780d", "Sunny", "Napos"],
  partlycloudy: ["mdi:weather-partly-cloudy", "#b9780d", "Partly cloudy", "Részben felhős"],
  "clear-night": ["mdi:weather-night", "#7585d5", "Clear night", "Derült éjszaka"],
  cloudy: ["mdi:weather-cloudy", "#788697", "Cloudy", "Felhős"],
  fog: ["mdi:weather-fog", "#788697", "Foggy", "Ködös"],
  rainy: ["mdi:weather-rainy", "#3184bf", "Rainy", "Esős"],
  pouring: ["mdi:weather-pouring", "#3184bf", "Heavy rain", "Heves eső"],
  snowy: ["mdi:weather-snowy", "#3998a9", "Snowy", "Havazás"],
  "snowy-rainy": ["mdi:weather-snowy-rainy", "#3998a9", "Sleet", "Havas eső"],
  hail: ["mdi:weather-hail", "#9365bd", "Hail", "Jégeső"],
  lightning: ["mdi:weather-lightning", "#9365bd", "Thunderstorms", "Zivatar"],
  "lightning-rainy": ["mdi:weather-lightning-rainy", "#9365bd", "Thunderstorms with rain", "Zivatar esővel"],
  windy: ["mdi:weather-windy", "#518e81", "Windy", "Szeles"],
  "windy-variant": ["mdi:weather-windy-variant", "#518e81", "Windy", "Szeles"],
  exceptional: ["mdi:weather-tornado", "#c9685a", "Severe weather", "Szélsőséges idő"],
};

export function weatherVisual(condition?: string, hungarian = false) {
  const row = conditions[condition || ""];
  return row ? { icon: row[0], tone: row[1], label: row[hungarian ? 3 : 2] }
    : { icon: "mdi:weather-cloudy-alert", tone: "#788697", label: hungarian ? "Nincs adat" : "No data" };
}

export function weatherNumber(raw: unknown): number | undefined {
  if (raw == null || typeof raw === "boolean" || String(raw).trim() === "") return undefined;
  const value = Number(raw);
  return Number.isFinite(value) ? value : undefined;
}

export function precipitationChance(item: WeatherForecast): number | undefined {
  const value = weatherNumber(item.precipitation_probability);
  return value != null && value >= 0 && value <= 100 ? value : undefined;
}

const wet = new Set(["rainy", "pouring", "snowy", "snowy-rainy", "hail", "lightning-rainy"]);

/** Missing probabilities never become a confident dry forecast. */
export function precipitationOutlook(items: WeatherForecast[]) {
  const chances = items.map(precipitationChance).filter((n): n is number => n != null);
  const peak = chances.length ? Math.max(...chances) : undefined;
  const first = items.find(item => (precipitationChance(item) ?? 0) >= 30
    || (weatherNumber(item.precipitation) ?? 0) > 0 || wet.has(item.condition || ""));
  const complete = items.length > 0 && items.every(item => precipitationChance(item) != null || weatherNumber(item.precipitation) != null);
  return { kind: first ? (peak != null && peak >= 60 ? "likely" : "possible") : complete ? "dry" : "unknown", peak, first } as const;
}

export function temperatureRange(items: WeatherForecast[]) {
  const values = items.map(item => weatherNumber(item.temperature)).filter((n): n is number => n != null);
  return values.length ? { min: Math.min(...values), max: Math.max(...values) } : undefined;
}

/** Daily bands share one scale; incomplete/inverted ranges never invent a bar. */
export function dailyTemperatureBands(items: WeatherForecast[]) {
  const ranges = items.map(item => {
    const low = weatherNumber(item.templow), high = weatherNumber(item.temperature);
    return low != null && high != null && low <= high ? { low, high } : undefined;
  });
  const valid = ranges.filter((range): range is { low: number; high: number } => range != null);
  if (!valid.length) return ranges.map(() => undefined);
  const min = Math.min(...valid.map(range => range.low));
  const max = Math.max(...valid.map(range => range.high));
  return ranges.map(range => range && ({
    low: range.low, high: range.high,
    start: max === min ? 50 : (range.low - min) / (max - min) * 100,
    end: max === min ? 50 : (range.high - min) / (max - min) * 100,
  }));
}
