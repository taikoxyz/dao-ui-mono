import EncryptionPage from "./pages/index";
import { useUrl } from "@/hooks/useUrl";
import { NotFound } from "@/components/not-found";

export default function PluginPage() {
  // Select the inner pages to display depending on the URL hash
  const { hash } = useUrl();

  if (!hash || hash === "#/") return <EncryptionPage />;

  // Default not found page
  return <NotFound />;
}
