import { Construction } from "lucide-react";
import { PageHeader } from "./ui";

export function ComingSoon({ title, blurb }: { title: string; blurb: string }) {
  return (
    <>
      <PageHeader title={title} />
      <div className="card grid place-items-center px-6 py-20 text-center">
        <Construction className="mb-4 size-10 text-muted" />
        <p className="text-lg font-medium">Not available yet</p>
        <p className="mt-2 max-w-md text-sm text-muted">{blurb}</p>
      </div>
    </>
  );
}
