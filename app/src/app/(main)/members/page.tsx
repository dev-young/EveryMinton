import { MembersClient } from "./MembersClient";

type MembersSearchParams = {
  q?: string | string[];
  gender?: string | string[];
  level?: string | string[];
  memberUpdated?: string | string[];
};

interface Props {
  searchParams?: Promise<MembersSearchParams> | MembersSearchParams;
}

export default async function MembersPage({ searchParams }: Props) {
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const currentQueryString = new URLSearchParams(
    Object.entries(resolvedSearchParams)
      .map(([key, value]) => [key, firstString(value)] as [string, string | undefined])
      .filter((entry): entry is [string, string] => typeof entry[1] === "string")
  ).toString();

  return (
    <MembersClient
      searchQuery={firstString(resolvedSearchParams.q) ?? ""}
      genderParam={firstString(resolvedSearchParams.gender)}
      levelParam={firstString(resolvedSearchParams.level)}
      currentQueryString={currentQueryString}
    />
  );
}

function firstString(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
