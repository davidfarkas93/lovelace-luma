import { readFileSync, readdirSync } from "node:fs";

const index = readFileSync("src/index.ts", "utf8");
const registered = new Set([...index.matchAll(/type:\s*["'](luma-[^"']+-card)["']/g)].map((match) => match[1]));
const stories = readdirSync("stories").filter((name) => /\.(ts|mdx)$/.test(name)).map((name) => readFileSync(`stories/${name}`, "utf8")).join("\n");
const documented = new Set([...stories.matchAll(/(?:custom:)?(luma-[a-z0-9-]+-card)/g)].map((match) => match[1]));
const missing = [...registered].filter((card) => !documented.has(card)).sort();

if (missing.length) {
  console.error(`Missing Storybook coverage:\n${missing.map((card) => `- ${card}`).join("\n")}`);
  process.exit(1);
}

console.log(`Storybook covers all ${registered.size} registered Luma cards.`);
