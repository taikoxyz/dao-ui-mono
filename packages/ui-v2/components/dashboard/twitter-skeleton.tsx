export const FeedSkeleton = () => {
  return (
    <div className="h-[600px] divide-y divide-neutral-100 overflow-hidden rounded-xl border border-neutral-100">
      <TweetSkeleton />
      <TweetSkeleton />
    </div>
  );
};

const TweetSkeleton = () => {
  return (
    <div className="w-full bg-neutral-0 p-4">
      <div className="flex items-center">
        <div className="h-10 w-10 animate-pulse rounded-full bg-neutral-50"></div>
        <div className="ml-4">
          <div className="h-4 w-24 animate-pulse rounded bg-neutral-50"></div>
          <div className="mt-2 h-3 w-16 animate-pulse rounded bg-neutral-50"></div>
        </div>
      </div>

      <div className="pl-10 pr-2">
        <div className="mt-4">
          <div className="h-4 w-full animate-pulse rounded bg-neutral-50"></div>
          <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-neutral-50"></div>
          <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-neutral-50"></div>
        </div>

        <div className="mt-4 w-full rounded-2xl border border-neutral-100 p-4">
          <div className="flex items-center">
            <div className="h-8 w-8 animate-pulse rounded-full bg-neutral-50"></div>
            <div className="ml-4">
              <div className="h-4 w-20 animate-pulse rounded bg-neutral-50"></div>
              <div className="mt-2 h-3 w-14 animate-pulse rounded bg-neutral-50"></div>
            </div>
          </div>
          <div className="mt-4">
            <div className="h-4 w-full animate-pulse rounded bg-neutral-50"></div>
            <div className="mt-2 h-4 w-3/4 animate-pulse rounded bg-neutral-50"></div>
            <div className="mt-2 h-4 w-1/2 animate-pulse rounded bg-neutral-50"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
