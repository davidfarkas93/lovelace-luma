import type { HomeAssistant } from "./types";

const en={confirm:"Confirm",details:"Details",close:"Close",dismiss:"Close",open:"Open",stop:"Stop",start:"Start",resume:"Resume",tap_to_execute:"Tap to run",tap_to_control:"Tap for controls",tap_for_history:"Tap for status and history",all_lights_off:"Lights off",turning_off:"Turning off…",open_timeline:"Timeline",acknowledge:"Acknowledge",done:"Done",open_item:"Open",settings:"Detailed settings",less:"Show less",more:"Show more",loading:"Loading…",install:"Install",installing:"Installing…",history:"Status and history",pedestrian:"Pedestrian"};
const hu:typeof en={confirm:"Megerősítés",details:"Részletek",close:"Zárás",dismiss:"Bezárás",open:"Nyitás",stop:"Leállítás",start:"Indítás",resume:"Folytatás",tap_to_execute:"Koppints a végrehajtáshoz",tap_to_control:"Koppints a vezérléshez",tap_for_history:"Koppints az állapot és előzmények megnyitásához",all_lights_off:"Lámpák le",turning_off:"Kikapcsolás…",open_timeline:"Idővonal",acknowledge:"Nyugtázás",done:"Kész",open_item:"Megnyitás",settings:"Részletes beállítások",less:"Kevesebb",more:"Továbbiak",loading:"Betöltés…",install:"Telepítés",installing:"Telepítés…",history:"Állapot és előzmények",pedestrian:"Gyalogos"};
export type LumaTranslationKey=keyof typeof en;
const browserLanguage=():string=>typeof navigator!=="undefined"?navigator.language:"en";
export const localize=(hass:HomeAssistant|undefined,key:LumaTranslationKey):string=>((hass?.locale?.language||browserLanguage()).toLowerCase().startsWith("hu")?hu:en)[key];
export const isHungarian=(hass?:HomeAssistant):boolean=>((hass?.locale?.language||browserLanguage()).toLowerCase().startsWith("hu"));
export const localized=(hass:HomeAssistant|undefined,english:string,hungarian:string):string=>isHungarian(hass)?hungarian:english;
export const localizedMap=(hass:HomeAssistant|undefined,english:Record<string,string>,hungarian:Record<string,string>,value:string):string=>(isHungarian(hass)?hungarian:english)[value]||value;
