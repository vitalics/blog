import MetadataClient from "./metadata-client";

export const metadata = {
  title: "File Metadata",
  description: "View metadata of any file in your browser",
};

export default function Page() {
  return <MetadataClient />;
}
