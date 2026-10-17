// Zone 1 variant — grid of small "definition" cards (Sayr Studio): tinted icon
// square + module name + total count only. Nothing in Sayr Studio is Published /
// Draft (v1.2 §9), so there is NO status split line. Each card deep-links.
import React from 'react';
import { Layers } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BRAND, CARD, IconSquare, MaybeLink, fmt, resolveLang } from './overviewShared';
import type { DefinitionEntryConfig, Lang } from './types';

export const DefinitionsGrid: React.FC<{ items: DefinitionEntryConfig[]; lang?: Lang }> = ({
  items,
  lang,
}) => {
  const l = resolveLang(lang);
  const isAr = l === 'ar';
  if (items.length === 0) return null;
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
      {items.map((it, i) => {
        const color = it.color ?? BRAND.violet;
        return (
          <MaybeLink
            key={i}
            to={it.to}
            ariaLabel={isAr ? it.titleAr : it.titleEn}
            className={cn(CARD, 'block p-4 transition-colors hover:bg-muted/30')}
          >
            <div className="flex items-center gap-2.5">
              <IconSquare icon={it.icon ?? Layers} color={color} size="sm" />
              <p className="text-sm font-semibold text-foreground truncate min-w-0">
                {isAr ? it.titleAr : it.titleEn}
              </p>
            </div>
            <p className="mt-3 text-2xl font-bold leading-none tabular-nums text-foreground">
              {fmt(it.total, l)}
            </p>
          </MaybeLink>
        );
      })}
    </div>
  );
};
