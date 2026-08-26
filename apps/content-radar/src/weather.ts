// Open-Meteo: clima real (no depende de que algún medio ya haya publicado la nota),
// gratis, sin API key, sin registro. Coordenadas fijas de CDMX (Zócalo aprox.).
const LAT = 19.4326;
const LON = -99.1332;

export interface DayForecast {
  date: string;
  maxC: number;
  minC: number;
  rainProbPct: number;
  weatherCode: number;
}

export interface WeatherNow {
  tempC: number;
  weatherCode: number;
  windKmh: number;
  humidityPct: number;
  forecast: DayForecast[];
}

const WEATHER_LABELS: Record<number, string> = {
  0: "despejado",
  1: "mayormente despejado",
  2: "parcialmente nublado",
  3: "nublado",
  45: "niebla",
  48: "niebla helada",
  51: "llovizna ligera",
  53: "llovizna moderada",
  55: "llovizna intensa",
  61: "lluvia ligera",
  63: "lluvia moderada",
  65: "lluvia intensa",
  71: "nieve ligera",
  73: "nieve moderada",
  75: "nieve intensa",
  80: "chubascos ligeros",
  81: "chubascos moderados",
  82: "chubascos intensos",
  95: "tormenta eléctrica",
  96: "tormenta con granizo",
  99: "tormenta fuerte con granizo",
};

export function weatherLabel(code: number): string {
  return WEATHER_LABELS[code] ?? `código ${code}`;
}

export async function getCdmxWeather(): Promise<WeatherNow | null> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${LAT}&longitude=${LON}` +
    `&current=temperature_2m,weather_code,wind_speed_10m,relative_humidity_2m` +
    `&daily=temperature_2m_max,temperature_2m_min,precipitation_probability_max,weather_code` +
    `&timezone=America%2FMexico_City&forecast_days=3`;

  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
    const data = await res.json();

    const days: string[] = data.daily.time;
    const forecast: DayForecast[] = days.map((date, i) => ({
      date,
      maxC: data.daily.temperature_2m_max[i],
      minC: data.daily.temperature_2m_min[i],
      rainProbPct: data.daily.precipitation_probability_max[i],
      weatherCode: data.daily.weather_code[i],
    }));

    return {
      tempC: data.current.temperature_2m,
      weatherCode: data.current.weather_code,
      windKmh: data.current.wind_speed_10m,
      humidityPct: data.current.relative_humidity_2m,
      forecast,
    };
  } catch {
    return null;
  }
}
