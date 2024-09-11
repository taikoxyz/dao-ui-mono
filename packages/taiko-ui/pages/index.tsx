import { plugins } from "@/plugins";
import { MainSection } from "@/components/layout/main-section";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function Home() {
  const { replace } = useRouter();
  useEffect(() => {
    replace("/plugins/" + plugins[0].id);
  }, []);

  return (
    <MainSection>
      <div className="flex h-24 w-full items-center justify-center">
        <PleaseWaitSpinner />
      </div>
    </MainSection>
  );
}
