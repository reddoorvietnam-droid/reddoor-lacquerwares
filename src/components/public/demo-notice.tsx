import type { PublicDictionary } from "@/lib/i18n/dictionary";
import { cn } from "@/lib/utils/cn";

import { Badge } from "../ui/badge";

export type DemoNoticeProps = {
  common: PublicDictionary["common"];
  className?: string;
};

export function DemoNotice({ common, className }: DemoNoticeProps) {
  return (
    <aside
      className={cn(
        "border-gold/30 bg-gold/10 text-burgundy flex flex-col gap-3 rounded-[var(--radius-md)] border px-4 py-3 sm:flex-row sm:items-center",
        className,
      )}
      role="note"
    >
      <Badge variant="gold" className="shrink-0">
        {common.updatingLabel}
      </Badge>
      <p className="text-sm leading-6">{common.updatingNotice}</p>
    </aside>
  );
}
