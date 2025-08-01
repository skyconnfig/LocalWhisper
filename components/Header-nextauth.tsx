"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import React from "react";
import { Button } from "./ui/button";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";
import { ModalCustomApiKey } from "./hooks/ModalCustomApiKey";
import { toast } from "sonner";
import { useTogetherApiKey } from "./TogetherApiKeyProvider";
import { useLimitsNextAuth } from "./hooks/useLimitsNextAuth";

export function Header() {
  const pathname = usePathname();
  const { data: session, status } = useSession();
  const [mounted, setMounted] = React.useState(false);
  const { apiKey } = useTogetherApiKey();

  const isBYOK = !!apiKey;

  const { transformationsData, isLoading } = useLimitsNextAuth();

  React.useEffect(() => {
    setMounted(true);
  }, []);

  // /whispers/1234567890
  const isSingleWhisperPage =
    pathname.startsWith("/whispers/") && pathname.length > 11;

  if (!mounted || status === "loading") {
    // Optionally, you can return a skeleton or null while mounting
    return (
      <div className="h-[63px] w-full bg-gray-50 border-b border-gray-200" />
    );
  }

  const handleSignOut = async () => {
    try {
      await signOut({ redirect: true, callbackUrl: "/" });
    } catch (error) {
      toast.error("Error signing out");
    }
  };

  return (
    <header className="min-h-[63px] flex items-center justify-between p-4 bg-gray-50 border-b border-gray-200">
      {isSingleWhisperPage ? (
        <Link href="/whispers/" className="flex items-center gap-2">
          <img
            src="/back.svg"
            className="min-w-[14px] min-h-[14px] size-[14px]"
          />
          <span className="text-base font-medium text-[#4A5565]">
            My Whispers
          </span>
        </Link>
      ) : (
        <Link
          href={session?.user ? "/whispers/" : "/"}
          className="flex items-center gap-2"
        >
          <img src="/logo.svg" className="min-w-5 min-h-5 size-5" />
          <img
            src="/logoGradient.svg"
            alt="whisper"
            className="w-[71px] min-h-[25px] h-[25px]"
          />
        </Link>
      )}
      <div className="flex items-center gap-2">
        {!session ? (
          <>
            <Link href="/auth/signin">
              <Button variant="ghost">Login</Button>
            </Link>
            <Link href="/auth/signup">
              <Button className="font-medium">Sign up</Button>
            </Link>
          </>
        ) : (
          <>
            <Button
              className="w-[51px] h-[30px] relative rounded-lg bg-white hover:bg-gray-50 border-[0.5px] border-gray-200"
              onClick={() => {
                if (isBYOK) {
                  toast("You have unlimited transformations for your whispers!");
                } else if (!isLoading) {
                  toast(
                    `You got ${
                      transformationsData?.remaining ?? 0
                    } transformations left for your whispers`
                  );
                }
              }}
            >
              <img src="/spark.svg" className="size-4 min-w-4" />
              <p className="text-sm font-medium text-left text-[#1e2939]">
                {isBYOK
                  ? "∞"
                  : isLoading
                  ? "..."
                  : transformationsData?.remaining ?? 0}
              </p>
            </Button>
            <KeyButton />
            <UserMenuButton 
              user={session.user} 
              onSignOut={handleSignOut}
            />
          </>
        )}
      </div>
      <ModalCustomApiKey />
    </header>
  );
}

function KeyButton() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleClick = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("customKey", "true");
    const newUrl = params.toString() ? `${pathname}?${params}` : pathname;
    router.push(newUrl);
  };

  return (
    <Button
      variant="ghost"
      className="p-[7px] size-[30px] min-w-[30px] min-h-[30px] rounded-lg border border-gray-200 bg-white hover:bg-gray-50"
      onClick={handleClick}
    >
      <img src="/key.svg" className="min-w-4 min-h-4 size-4" />
    </Button>
  );
}

function UserMenuButton({ 
  user, 
  onSignOut 
}: { 
  user: any; 
  onSignOut: () => void;
}) {
  const [showMenu, setShowMenu] = React.useState(false);

  return (
    <div className="relative">
      <Button
        variant="ghost"
        className="p-0 h-[30px] w-[30px] rounded-[8px] overflow-hidden"
        onClick={() => setShowMenu(!showMenu)}
      >
        {user.image ? (
          <img 
            src={user.image} 
            alt={user.name || "User"} 
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
            {user.name?.charAt(0)?.toUpperCase() || user.email?.charAt(0)?.toUpperCase()}
          </div>
        )}
      </Button>
      
      {showMenu && (
        <div className="absolute right-0 mt-2 w-48 bg-white rounded-md shadow-lg py-1 z-50 border">
          <div className="px-4 py-2 text-sm text-gray-700 border-b">
            <p className="font-medium">{user.name}</p>
            <p className="text-gray-500">{user.email}</p>
          </div>
          <button
            onClick={() => {
              onSignOut();
              setShowMenu(false);
            }}
            className="block w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            Sign out
          </button>
        </div>
      )}
      
      {showMenu && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setShowMenu(false)}
        />
      )}
    </div>
  );
}