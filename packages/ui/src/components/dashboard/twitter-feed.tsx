import classNames from "classnames";
import React, { useEffect } from "react";
import { FeedSkeleton } from "./twitter-skeleton";

declare global {
  interface Window {
    twttr: any;
  }
}

interface ITwitterFeed {
  account: string;
}

export const TwitterFeed: React.FC<ITwitterFeed> = ({ account }) => {
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://platform.twitter.com/widgets.js";
    script.async = true;

    script.onload = () => {
      if (window?.twttr?.widgets) {
        window.twttr.widgets.load();
      }
    };

    document.body.appendChild(script);

    return () => {
      document.body.removeChild(script);
    };
  }, []);

  return (
    <div
      className={classNames(
        "relative inline-block",
        "after:absolute after:bottom-0 after:left-0 after:right-0 after:top-0 after:z-[1]",
        "after:pointer-events-none after:overflow-hidden after:rounded-[12px] after:border after:border-neutral-100 after:content-['']"
      )}
    >
      <a
        className="twitter-timeline"
        data-height="550"
        data-chrome="noheader nofooter"
        href={`https://twitter.com/${account}`}
      >
        <FeedSkeleton />
      </a>
    </div>
  );
};
