/**
 * Live GitHub Pages project sites published under https://redam94.github.io/.
 *
 * Single source of truth for the sitemap (astro.config.ts) and /llms.txt
 * (src/pages/llms.txt.ts). Add a site here and both stay in sync.
 */
export interface GithubPage {
  /** Repository name, which is also the path segment on github.io. */
  repo: string;
  title: string;
  description: string;
  /** The site publishes its own /sitemap.xml. */
  hasSitemap?: boolean;
  /** The site publishes its own /llms.txt. */
  hasLlmsTxt?: boolean;
}

export const GITHUB_PAGES_ORIGIN = "https://redam94.github.io";

export const githubPages: GithubPage[] = [
  {
    repo: "second-brain",
    title: "Second Brain",
    description:
      "A structured knowledge base covering Bayesian statistics, econometrics, causal inference, and agent-based modeling.",
    hasSitemap: true,
    hasLlmsTxt: true,
  },
  {
    repo: "axiom",
    title: "axiom — Bayesian causal decision science",
    description:
      "A Python toolkit for identification, experimental design, calibration, response surfaces, and evidence meta-analysis.",
  },
  {
    repo: "haruspex",
    title: "haruspex",
    description:
      "A Python library for advanced hierarchical Bayesian modeling with time series functionality, enabling causal inference in media mix modeling.",
    hasSitemap: true,
  },
  {
    repo: "modeling-api",
    title: "modeling-api",
    description:
      "Documentation for a modeling API that takes analysts from a spreadsheet to a report and a what-if scenario, with tracked, tested workflows for data scientists.",
    hasSitemap: true,
  },
  {
    repo: "abm",
    title: "ABM for Media & Marketing",
    description:
      "Documentation for agent-based modeling of media and marketing.",
  },
  {
    repo: "BayesianBrandTracker",
    title: "BayesianBrandTracker",
    description: "A Bayesian approach to brand health tracking.",
    hasSitemap: true,
  },
  {
    repo: "mmm-bayes",
    title: "mmm-bayes",
    description: "Media mix modeling using Bayesian methods.",
    hasSitemap: true,
  },
  {
    repo: "budget_optimizer",
    title: "budget_optimizer",
    description: "Budget optimizer for nested media mix models.",
    hasSitemap: true,
  },
  {
    repo: "bayesinsight-optimizer",
    title: "bayesinsight-optimizer",
    description: "Budget optimizer for bayesinsight models.",
    hasSitemap: true,
  },
  {
    repo: "optimizer",
    title: "Budget Optimizer Framework",
    description: "Overview of the budget optimizer framework.",
  },
  {
    repo: "optimizer-design-doc",
    title: "Budget Optimizer Framework Features",
    description:
      "Design document for the budget optimizer framework's features.",
  },
  {
    repo: "search-forecast",
    title: "search-forecast",
    description: "Search forecasting tool.",
    hasSitemap: true,
  },
  {
    repo: "agent_chatbot",
    title: "agent_chatbot",
    description: "Agentic chat bot test using pydantic-ai.",
    hasSitemap: true,
  },
  {
    repo: "causal-vs-predictive-modeling",
    title: "Seeing vs. Doing: A Field Guide to Causal Identification",
    description:
      "An interactive guide to DAGs, d-separation, do-calculus, causal discovery, Markov equivalence, and the trap of treating predictive models as causal.",
  },
  {
    repo: "double-ml-explainer",
    title: "Double Machine Learning",
    description:
      "A scroll-through explainer of double/debiased machine learning with live in-browser simulations.",
  },
  {
    repo: "pymc-challenges",
    title: "Bayesian Modelling in Practice",
    description:
      "Worked examples and real-data challenges in Bayesian data analysis with PyMC, from the first prior predictive check to decisions made under uncertainty.",
  },
  {
    repo: "bayesian_methods",
    title: "Bayesian Methods",
    description: "Notes and materials on Bayesian methods.",
  },
  {
    repo: "common_regression_issues",
    title: "Common Regression Issues",
    description:
      "A knowledge repository of common issues in regression analysis, with utility functions for generating synthetic data.",
    hasSitemap: true,
  },
  {
    repo: "illusion_of_significance",
    title:
      "The Illusion of Significance: Why P-Value Selection Undermines Marketing Analytics",
    description:
      "An essay on how selecting results by p-value undermines marketing analytics.",
  },
  {
    repo: "MTM",
    title: "The SHAP & Random Forest Pitfall on Time Series Data",
    description:
      "A walkthrough of the pitfalls of using SHAP with random forests on time series data.",
  },
  {
    repo: "cartier-market-analysis",
    title: "North American Luxury Jewelry Market Analysis",
    description:
      "An interactive report analyzing the North American luxury jewelry market.",
  },
  {
    repo: "printing",
    title: "3D Printing Service",
    description:
      "Custom 3D-printed parts, designed around the thing you already have.",
  },
  {
    repo: "nbdev_test",
    title: "nbdev_test",
    description: "A test site for nbdev.",
    hasSitemap: true,
  },
];

export const githubPageUrl = (page: GithubPage) =>
  `${GITHUB_PAGES_ORIGIN}/${page.repo}/`;
