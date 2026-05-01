export default function DashboardLoading() {
  return (
    <div className="min-h-[60vh] w-full flex items-center justify-center" dir="rtl">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 rounded-full border-4 border-muted border-t-primary animate-spin" aria-hidden="true" />
        <p className="text-sm text-muted-foreground">جاري تحميل الصفحة...</p>
      </div>
    </div>
  );
}
