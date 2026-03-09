# Open Reporting — Documentation Site

The documentation site for **Open Reporting**, built with [Fumadocs](https://fumadocs.dev) on Next.js.

## Getting Started

```bash
cd docs-site
npm install
npm run dev
```

Open [http://localhost:3000/docs](http://localhost:3000/docs) to view the documentation.

## Project Structure

| Path | Description |
| --- | --- |
| `content/docs/` | Markdown/MDX documentation pages |
| `content/docs/meta.json` | Root sidebar navigation order |
| `app/docs/` | Next.js docs layout and page routes |
| `app/(home)/` | Landing page |
| `app/api/search/` | Built-in search API (Orama) |
| `lib/source.ts` | Content source adapter ([`loader()`](https://fumadocs.dev/docs/headless/source-api)) |
| `source.config.ts` | Fumadocs MDX configuration (frontmatter schema, etc.) |

## Adding Documentation

1. Create a `.md` or `.mdx` file inside `content/docs/` (or a subdirectory).
2. Add frontmatter with at least a `title`:
   ```yaml
   ---
   title: My New Page
   description: Optional description
   ---
   ```
3. Add the filename (without extension) to the relevant `meta.json` to include it in the sidebar.

## Building for Production

```bash
npm run build
```

## Learn More

- [Fumadocs Documentation](https://fumadocs.dev)
- [Next.js Documentation](https://nextjs.org/docs)
