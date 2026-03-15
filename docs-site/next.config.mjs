import { createMDX } from 'fumadocs-mdx/next';

const withMDX = createMDX();

const isGithubActions = process.env.GITHUB_ACTIONS === 'true';
const repo = process.env.GITHUB_REPOSITORY?.split('/')?.[1] ?? '';

/** @type {import('next').NextConfig} */
const config = {
  output: 'export',
  serverExternalPackages: ['@takumi-rs/image-response'],
  reactStrictMode: true,
  images: { unoptimized: true },
  ...(isGithubActions && repo
    ? {
        basePath: `/${repo}`,
        assetPrefix: `/${repo}/`,
      }
    : {}),
};

export default withMDX(config);
