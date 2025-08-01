import { useTRPC } from "@/trpc/client";
import { useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import { useTogetherApiKey } from "../TogetherApiKeyProvider";

export const useLimitsNextAuth = () => {
  const { data: session } = useSession();
  const { apiKey } = useTogetherApiKey();

  const isBYOK = !!apiKey;

  const trpc = useTRPC();
  const { data: transformationsData, isLoading: isTransformationsLoading } =
    useQuery({
      ...trpc.limit.getTransformationsLeft.queryOptions(),
      enabled: !!session?.user && !isBYOK, // Don't fetch if BYOK (unlimited)
    });

  const { data: minutesData, isLoading: isMinutesLoading } = useQuery(
    trpc.limit.getMinutesLeft.queryOptions()
  );

  return {
    transformationsData,
    isLoading: isTransformationsLoading || isMinutesLoading,
    minutesData,
  };
};