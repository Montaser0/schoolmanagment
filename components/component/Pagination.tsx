"use client"
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

type PaginationProps = {
  currentPage: number;
  totalPages: number;
};

const Pagination = ({ currentPage, totalPages }: PaginationProps) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const safeCurrent = Math.max(1, Math.min(currentPage, Math.max(totalPages, 1)));
  const safeTotal = Math.max(1, totalPages);

  const buildHref = (targetPage: number) => {
    const next = new URLSearchParams(searchParams.toString());
    if (targetPage <= 1) next.delete("page");
    else next.set("page", String(targetPage));
    const qs = next.toString();
    return qs ? `${pathname}?${qs}` : pathname;
  };

  const start = Math.max(1, safeCurrent - 2);
  const end = Math.min(safeTotal, start + 4);
  const adjustedStart = Math.max(1, end - 4);
  const pageNumbers = Array.from({ length: end - adjustedStart + 1 }, (_, i) => adjustedStart + i);

  return (
    <div className="flex items-center justify-between text-gray-500 border-t border-white/10 px-4 py-3 sm:px-6">
      {safeCurrent <= 1 ? (
        <button
          disabled
          className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          السابق
        </button>
      ) : (
        <Link href={buildHref(safeCurrent - 1)} className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold">
          السابق
        </Link>
      )}

      <div className="flex items-center gap-2">
        {pageNumbers.map((num) =>
          num === safeCurrent ? (
            <button
              key={num}
              disabled
              className="py-2 px-4 rounded-md bg-sky text-xs font-semibold text-white disabled:opacity-100 disabled:cursor-not-allowed"
            >
              {num}
            </button>
          ) : (
            <Link key={num} href={buildHref(num)} className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold">
              {num}
            </Link>
          ),
        )}
      </div>

      {safeCurrent >= safeTotal ? (
        <button
          disabled
          className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          التالي
        </button>
      ) : (
        <Link href={buildHref(safeCurrent + 1)} className="py-2 px-4 rounded-md bg-slate-200 text-xs font-semibold">
          التالي
        </Link>
      )}
    </div>
  );
};
export default Pagination;
