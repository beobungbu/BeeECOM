import * as React from 'react';

export type AdminSection = 'operations' | 'catalog' | 'promotions';

const sections: Array<{ id: AdminSection; href: string; label: string; description: string }> = [
  { id: 'operations', href: '/', label: 'Operations', description: 'Orders, customers, returns and support' },
  { id: 'catalog', href: '/catalog', label: 'Catalog & inventory', description: 'Products, merchandising and stock' },
  { id: 'promotions', href: '/promotions', label: 'Promotions', description: 'Campaigns, discounts and schedules' },
];

function sectionLabel(section: AdminSection): string {
  return sections.find((item) => item.id === section)?.label ?? 'Operations';
}

export interface AdminShellProps {
  section: AdminSection;
  children: React.ReactNode;
}

export function AdminShell({ section, children }: AdminShellProps) {
  const currentLabel = sectionLabel(section);

  return (
    <>
      <header className="border-b border-border bg-background" data-testid="admin-shell">
        <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-4 px-4 py-4 md:px-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <a
                className="text-lg font-semibold text-foreground no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                href="/"
              >
                BeeECOM Admin
              </a>
              <p className="mt-1 text-sm text-muted-foreground">Commerce operations control center</p>
            </div>
            <nav aria-label="Breadcrumb" className="min-w-0 text-sm text-muted-foreground">
              <ol className="flex min-w-0 flex-wrap items-center gap-2">
                <li><a className="underline-offset-4 hover:underline" href="/">Admin</a></li>
                <li aria-hidden="true">/</li>
                <li aria-current="page" className="font-medium text-foreground">{currentLabel}</li>
              </ol>
            </nav>
          </div>

          <nav aria-label="Admin primary navigation" className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {sections.map((item) => {
              const active = item.id === section;
              return (
                <a
                  key={item.id}
                  aria-current={active ? 'page' : undefined}
                  className={[
                    'min-w-0 rounded-lg border px-3 py-3 no-underline transition-colors',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    active
                      ? 'border-foreground/20 bg-muted text-foreground'
                      : 'border-border bg-background text-foreground hover:bg-muted/60',
                  ].join(' ')}
                  href={item.href}
                >
                  <span className="block truncate text-sm font-semibold">{item.label}</span>
                  <span className="mt-1 block text-xs text-muted-foreground">{item.description}</span>
                </a>
              );
            })}
          </nav>
        </div>
      </header>
      {children}
    </>
  );
}
