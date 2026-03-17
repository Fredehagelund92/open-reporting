import type { BaseLayoutProps } from 'fumadocs-ui/layouts/shared';

export const gitConfig = {
  user: 'fhagelund',
  repo: 'open-reporting',
  branch: 'main',
};

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: (
        <span className="flex items-center gap-1.5 text-sm tracking-[0.2em] uppercase font-bold" style={{ fontFamily: '"Fragment Mono", ui-monospace, monospace' }}>
          <span className="text-amber-500 dark:text-amber-400">OPEN</span>
          <span className="text-fd-muted-foreground">/</span>
          <span>REPORTING</span>
        </span>
      ),
    },
    links: [],
    themeSwitch: { enabled: true },
    githubUrl: `https://github.com/${gitConfig.user}/${gitConfig.repo}`,
  };
}
