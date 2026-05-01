"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

export default function RouteLoadingOverlay() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isLoading, setIsLoading] = useState(false);
  const targetPathRef = useRef<string | null>(null);

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented) return;
      if (event.button !== 0) return;
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const anchor = target?.closest("a") as HTMLAnchorElement | null;
      if (!anchor) return;
      if (!anchor.href) return;
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;

      const nextPath = `${url.pathname}${url.search}`;
      const currentPath = `${window.location.pathname}${window.location.search}`;
      if (nextPath === currentPath) return;

      targetPathRef.current = nextPath;
      setIsLoading(true);
    };

    document.addEventListener("click", onDocumentClick, true);
    return () => {
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, []);

  useEffect(() => {
    if (!isLoading) return;
    const currentPath = `${pathname}${searchParams.toString() ? `?${searchParams.toString()}` : ""}`;
    const targetPath = targetPathRef.current;
    if (!targetPath) {
      setIsLoading(false);
      return;
    }
    if (currentPath === targetPath) {
      setIsLoading(false);
      targetPathRef.current = null;
    }
  }, [pathname, searchParams, isLoading]);

  useEffect(() => {
    return () => {
      targetPathRef.current = null;
    };
  }, []);

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-[1px]" dir="rtl">
      <div className="flex flex-col items-center gap-4 rounded-xl border border-border bg-background/95 px-8 py-6 shadow-lg">
        <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">جاري تحميل الصفحة...</p>
      </div>
    </div>
  );
}
