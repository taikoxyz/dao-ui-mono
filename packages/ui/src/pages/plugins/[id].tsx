import React, { useEffect, useState, type FC } from "react";
import { useRouter } from "next/router";
import { PleaseWaitSpinner } from "@/components/please-wait";
import { resolveQueryParam } from "@/utils/query";
import { NotFound } from "@/components/not-found";
import { plugins } from "@/plugins";
import { logger } from "@/services/logger";
import { MainSection } from "@/components/layout/main-section";

const PluginLoader: FC = () => {
  const { query, isReady } = useRouter();
  const pluginId = isReady ? resolveQueryParam(query.id) : "";
  const [PageComponent, setPageComponent] = useState<FC | null>(null);
  const [componentLoading, setComponentLoading] = useState(true);

  useEffect(() => {
    if (!isReady) return;
    if (!pluginId) {
      setComponentLoading(false);
      setPageComponent(null);
      return;
    }

    const plugin = plugins.find((p) => p.id === pluginId);
    if (!plugin) {
      setComponentLoading(false);
      setPageComponent(null);
      return;
    }

    setComponentLoading(true);
    setPageComponent(null);
    import(`@/plugins/${plugin.folderName}`)
      .then((mod) => {
        setPageComponent(() => mod.default);
        setComponentLoading(false);
      })
      .catch((err) => {
        logger.error("Failed to load the page component", err);
        setComponentLoading(false);
      });
  }, [pluginId, isReady]);

  if (!PageComponent) {
    if (componentLoading) {
      return (
        <MainSection>
          <div className="flex h-24 w-full items-center justify-center">
            <PleaseWaitSpinner />
          </div>
        </MainSection>
      );
    }
    return <NotFound />;
  }

  return <PageComponent />;
};

export default PluginLoader;
