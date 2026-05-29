import { MemberEditClient } from "./MemberEditClient";

interface Props {
  params: Promise<{ id: string }> | { id: string };
  searchParams?: Promise<{ returnTo?: string }> | { returnTo?: string };
}

export default async function MemberEditPage({ params, searchParams }: Props) {
  const resolvedParams = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const returnTo = resolvedSearchParams.returnTo;
  const returnPath = returnTo?.startsWith("/") ? returnTo : "/members";

  return <MemberEditClient memberId={resolvedParams.id} returnPath={returnPath} />;
}
