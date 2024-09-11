import { type IBreadcrumbsLink } from "@aragon/ods";
import { capitalizeFirstLetter } from "./text";

export function generateBreadcrumbs(pathname: string, placeholder: string): IBreadcrumbsLink[] {
  // Assuming that we work from the hash symbol
  const [path, hash] = pathname.split("/#").filter(Boolean);
  let pathAccumulator = "";
  let result: {
    label: string;
    href: string;
  }[];

  if (!hash.trim()) {
    // On the path
    result = path
      .split("/")
      .filter(Boolean)
      .map((path) => {
        pathAccumulator += `/${path}`;
        return {
          label: capitalizeFirstLetter(path),
          href: pathAccumulator,
        };
      });
  } else {
    // On the hash
    pathAccumulator = path + "/#";
    result = hash
      .split("/")
      .filter(Boolean)
      .map((path) => {
        pathAccumulator += `/${path}`;
        return {
          label: capitalizeFirstLetter(path),
          href: pathAccumulator,
        };
      });
  }

  if (!result.length)
    result.push({
      label: placeholder,
      href: pathname,
    });

  return result;
}
