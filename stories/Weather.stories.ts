import { html } from "lit";
import type { Meta, StoryObj } from "@storybook/web-components-vite";
import "../src/index";
import { renderCard } from "../storybook/render-card";
import type { WeatherForecast } from "../src/weather";

const meta: Meta = { title:"Patterns/Weather", parameters:{ controls:{ disable:true }, layout:"fullscreen" } };
export default meta;
type Story = StoryObj;
const now = Date.now();
const hourly = (wet = false): WeatherForecast[] => Array.from({length:24},(_,i)=>({
  datetime:new Date(now+i*3600000).toISOString(), condition:wet&&i>=4&&i<=10?(i===7?"lightning-rainy":"rainy"):i<7?"clear-night":"sunny",
  temperature:Math.round(4+Math.sin(i/5)*8), precipitation_probability:wet&&i>=4&&i<=10?75:4, wind_speed:8, wind_gust_speed:wet?32:12,
}));
const daily: WeatherForecast[] = ["sunny","partlycloudy","rainy","cloudy","lightning-rainy","snowy","fog"].map((condition,i)=>({
  datetime:new Date(now+i*86400000).toISOString(),condition,temperature:17-i,templow:3+i,precipitation_probability:[5,15,75,25,90,65,10][i],wind_speed:12+i,
}));
function page(wet=false,missing=false) {
  const entities={"weather.home":{state:missing?"unavailable":"clear-night",attributes:{temperature:0,temperature_unit:"°C",humidity:76,wind_speed:8,wind_speed_unit:"km/h",forecast_hourly:missing?[]:hourly(wet),forecast_daily:missing?[]:daily}}};
  return html`<div style="max-width:1180px;margin:0 auto;padding:20px;display:grid;gap:16px;">
    ${renderCard("custom:luma-weather-hero-card",{weather_entity:"weather.home"},entities,1140)}
    ${renderCard("custom:luma-weather-hourly-card",{weather_entity:"weather.home"},entities,1140)}
    ${renderCard("custom:luma-weather-forecast-card",{weather_entity:"weather.home",days:7},entities,1140)}
  </div>`;
}
export const DryNight: Story = { render:()=>page() };
export const RainComing: Story = { render:()=>page(true) };
export const MissingForecast: Story = { render:()=>page(false,true) };
export const IncompleteDailyRanges: Story = {
  render:()=>renderCard('custom:luma-weather-forecast-card',{weather_entity:'weather.home'}, {
    'weather.home': {state:'cloudy',attributes:{temperature_unit:'°C',forecast_daily:[
      {...daily[0],templow:-5,temperature:5},
      {...daily[1],templow:0,temperature:0},
      {...daily[2],templow:undefined,temperature:12},
      {...daily[3],templow:8,temperature:undefined},
      {...daily[4],templow:10,temperature:5},
    ],forecast_hourly:hourly() }},
  },720),
};
