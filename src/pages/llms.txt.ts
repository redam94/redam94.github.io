import type { APIRoute } from "astro";
import { getCollection } from "astro:content";
import { getSortedPosts } from "@/utils/getSortedPosts";
import { getPostUrl } from "@/utils/getPostPaths";
import config from "@/config";
import { githubPages, githubPageUrl } from "@/data/githubPages";

const link = (title: string, url: string, description?: string) =>
  `- [${title}](${url})${description ? `: ${description}` : ""}`;

export const GET: APIRoute = async ({ site }) => {
  const base = site ?? new URL(config.site.url);
  const abs = (path: string) => new URL(path, base).href;

  const posts = getSortedPosts(await getCollection("posts"));

  const body = [
    `# ${config.site.title}`,
    "",
    `> ${config.site.description}`,
    "",
    "This file indexes the main site and every live GitHub Pages project site published under the same host.",
    "",
    "## Site",
    "",
    link("Home", abs("/")),
    link("About", abs("/about/")),
    link("Posts", abs("/posts/")),
    link("RSS feed", abs("/rss.xml")),
    link("Sitemap", abs("/sitemap-index.xml")),
    "",
    "## Posts",
    "",
    ...posts.map(({ data, id, filePath }) =>
      link(
        data.title,
        abs(getPostUrl(id, filePath, config.site.lang)),
        data.description
      )
    ),
    "",
    "## Project sites",
    "",
    ...githubPages.map(page => {
      const url = githubPageUrl(page);
      const llms = page.hasLlmsTxt ? ` (llms.txt: ${url}llms.txt)` : "";
      return link(page.title, url, `${page.description}${llms}`);
    }),
    "",
  ].join("\n");

  return new Response(body, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
};
