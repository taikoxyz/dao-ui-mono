import { PUB_TWITTER_ACCOUNT } from "@/constants";
import { Heading } from "@aragon/ods";
import { TwitterFeed } from "./twitter-feed";

export const LatestTweets = () => {
  return (
    <div className="flex w-full flex-col gap-y-4">
      <Heading size="h2">Latest posts from @{PUB_TWITTER_ACCOUNT}</Heading>
      <TwitterFeed account={PUB_TWITTER_ACCOUNT} />
    </div>
  );
};
