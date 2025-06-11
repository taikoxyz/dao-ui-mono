import { DaoResources } from "@/components/dashboard/dao-resources";
import { HeaderDao } from "@/components/dashboard/header-dao";
import { MainSection } from "@/components/layout/main-section";
import { LatestProposals } from "@/components/dashboard/latest-proposals";
import { LatestTweets } from "@/components/dashboard/latest-tweets";

export default function Home() {
  return (
    <MainSection>
      <HeaderDao />
      <main className="mx-auto max-w-screen-xl">
        <div className="pb-4 pt-4 md:pb-6">
          <DaoResources />
        </div>
        <div className="flex flex-col gap-y-10 pb-6 pt-10 md:flex-row md:gap-x-12 md:pb-12">
          <LatestProposals />
          <section className="flex flex-shrink flex-col gap-y-10 md:max-w-[464px] lg:w-full">
            <LatestTweets />
          </section>
        </div>
      </main>
    </MainSection>
  );
}
