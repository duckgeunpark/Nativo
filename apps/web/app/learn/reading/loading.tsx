import { Skeleton } from "@/components/ui/states";

/** 문서 목록/Gutenberg 검색 결과를 새로 불러오는 동안의 로딩 스켈레톤. */
export default function ReadingLoading() {
  return (
    <div className="container py-8 sm:py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-32" />
          <Skeleton className="mt-2 h-4 w-72" />
        </div>
        <Skeleton className="h-11 w-32 rounded-full" />
      </div>
      <Skeleton className="mb-3 h-4 w-20" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-[3/4] w-full" />
        ))}
      </div>
    </div>
  );
}
