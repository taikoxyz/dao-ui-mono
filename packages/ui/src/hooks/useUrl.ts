import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export function useUrl() {
  const router = useRouter();
  const [url, setUrl] = useState(typeof window != "undefined" ? window.location.href : "");

  useEffect(() => {
    const urlChanged = (path: string) => {
      setUrl(location.protocol + "//" + location.host + path);
    };

    // Next.js router events only fire for navigations done through the router
    // (in-app links, router.push). They do NOT fire when the user edits the
    // URL fragment directly in the address bar or uses browser back/forward,
    // which emit the native hashchange/popstate events instead.
    const nativeUrlChanged = () => setUrl(window.location.href);

    router.events.on("hashChangeStart", urlChanged);
    router.events.on("routeChangeStart", urlChanged);
    window.addEventListener("hashchange", nativeUrlChanged);
    window.addEventListener("popstate", nativeUrlChanged);

    return () => {
      router.events.off("hashChangeStart", urlChanged);
      router.events.off("routeChangeStart", urlChanged);
      window.removeEventListener("hashchange", nativeUrlChanged);
      window.removeEventListener("popstate", nativeUrlChanged);
    };
  }, [router.events]);

  return new URL(url);
}
