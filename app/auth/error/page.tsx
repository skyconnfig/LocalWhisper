import Link from "next/link";
import { Button } from "@/components/ui/button";

interface AuthErrorPageProps {
  searchParams: {
    error?: string;
    callbackUrl?: string;
  };
}

const errorMessages: Record<string, string> = {
  Configuration: "There is a problem with the server configuration.",
  AccessDenied: "You do not have permission to sign in.",
  Verification: "The verification token has expired or has already been used.",
  Default: "An error occurred during authentication.",
  CredentialsSignin: "Invalid credentials. Please check your email and password.",
  EmailCreateAccount: "Could not create user with this email address.",
  EmailSignin: "Failed to send verification email.",
  OAuthSignin: "Error in constructing an authorization URL.",
  OAuthCallback: "Error in handling the response from an OAuth provider.",
  OAuthCreateAccount: "Could not create OAuth account.",
  SessionRequired: "Please sign in to access this page.",
};

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const error = searchParams.error || "Default";
  const callbackUrl = searchParams.callbackUrl || "/";

  const errorMessage = errorMessages[error] || errorMessages.Default;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-6">
              <img src="/logo.svg" className="size-6" />
              <img
                src="/logoGradient.svg"
                alt="whisper"
                className="w-[85px] h-[30px]"
              />
            </div>

            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100 mb-4">
                <svg
                  className="h-6 w-6 text-red-600"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              
              <h1 className="text-2xl font-semibold text-gray-900 mb-2">
                Authentication Error
              </h1>
              
              <p className="text-gray-600">
                {errorMessage}
              </p>
            </div>

            <div className="space-y-3">
              <Button asChild className="w-full">
                <Link href="/auth/signin">
                  Try signing in again
                </Link>
              </Button>
              
              <Button variant="outline" asChild className="w-full">
                <Link href="/">
                  Go to homepage
                </Link>
              </Button>
            </div>

            {error === "Verification" && (
              <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  If you need a new verification email, please try signing in again.
                </p>
              </div>
            )}

            {(error === "AccessDenied" || error === "OAuthCreateAccount") && (
              <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                  If you continue to experience issues, please contact support.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}