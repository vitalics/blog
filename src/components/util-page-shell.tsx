import type { LucideIcon } from "lucide-react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";

interface UtilPageShellProps {
  icon: LucideIcon;
  title: string;
  description: string;
  children: React.ReactNode;
}

export function UtilPageShell({
  icon: Icon,
  title,
  description,
  children,
}: UtilPageShellProps) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="mb-8">
        <div className="mb-2 flex items-center gap-3">
          <Link
            href="/utils"
            aria-label="Back to utils"
            className="inline-flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <Icon className="h-7 w-7 text-muted-foreground" aria-hidden="true" />
          <h1 className="text-4xl font-bold">{title}</h1>
        </div>
        <p className="text-muted-foreground">{description}</p>
      </div>
      {children}
    </div>
  );
}
