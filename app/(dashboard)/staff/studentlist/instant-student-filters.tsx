"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Search } from "lucide-react";

type ClassItem = {
  id: string;
  name: string;
};

type InstantStudentFiltersProps = {
  classes: ClassItem[];
  initialQuery: string;
  initialClassId: string;
  initialDate: string;
};

export function InstantStudentFilters({
  classes,
  initialQuery,
  initialClassId,
  initialDate,
}: InstantStudentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState(initialQuery);
  const [classId, setClassId] = useState(initialClassId);
  const [date, setDate] = useState(initialDate);

  const params = useMemo(() => {
    const sp = new URLSearchParams();
    if (query.trim()) sp.set("q", query.trim());
    if (classId.trim()) sp.set("classId", classId.trim());
    if (date.trim()) sp.set("date", date.trim());
    return sp;
  }, [query, classId, date]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const qs = params.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname);
    }, 180);
    return () => clearTimeout(timer);
  }, [params, pathname, router]);

  return (
    <>
      <div className="relative w-full md:w-auto">
        <Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <input
          name="q"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="ابحث باسم الطالب أو رقم ولي الأمر"
          className="h-8 w-full md:w-64 rounded-md border border-input bg-background pr-9 pl-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
        />
      </div>

      <select
        name="classId"
        value={classId}
        onChange={(e) => setClassId(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
      >
        <option value="">كل الصفوف</option>
        {classes.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <input
        type="date"
        name="date"
        value={date}
        onChange={(e) => setDate(e.target.value)}
        className="h-8 rounded-md border border-input bg-background px-3 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-yellow-400"
      />
    </>
  );
}
