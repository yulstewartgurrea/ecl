import type { ReactNode } from "react";
import useSWR from "swr";
import { getVersion } from "@tauri-apps/api/app";
import { ExclamationTriangleIcon } from "@heroicons/react/24/outline";
import { useAppSelector } from "../../redux_toolkit/hooks";
import { useLogout } from "../../hooks/useLogout";
import { getTermsAcceptance } from "../../services/terms";
import PulsingDotsLoader from "../Loader";
import TermsAcceptance from "./TermsAcceptance";
import { TERMS_CONTENT } from "./platformTerms";

async function sha256Hex(text: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

// The user must accept again when the app version or any word of the terms changes
async function loadTermsStatus(token: string) {
  const termsContent = JSON.stringify(TERMS_CONTENT);
  const [appVersion, termsHash] = await Promise.all([getVersion(), sha256Hex(termsContent)]);
  const { accepted } = await getTermsAcceptance(token, appVersion, termsHash);
  return { appVersion, termsHash, termsContent, accepted };
}

// Shows the platform terms after login and keeps the app closed until the user accepts them
const TermsGate = ({ children }: { children: ReactNode }) => {
  const token = useAppSelector((state) => state.auth.token);
  const logout = useLogout();
  const { data, error, mutate } = useSWR(
    token ? ["termsAcceptance", token] : null,
    () => loadTermsStatus(token!),
    // a refetch on focus would skip the "recorded" step right after accepting
    { revalidateOnFocus: false, revalidateOnReconnect: false }
  );

  if (data?.accepted) return <>{children}</>;

  if (data) {
    return (
      <TermsAcceptance
        appVersion={data.appVersion}
        termsHash={data.termsHash}
        termsContent={data.termsContent}
        onCancel={logout}
        onFinish={() => mutate({ ...data, accepted: true }, { revalidate: false })}
      />
    );
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-white">
      {error ? (
        <div className="max-w-md rounded-2xl border border-slate-200 p-8 text-center shadow-lg">
          <ExclamationTriangleIcon className="mx-auto h-10 w-10 text-[#EA8024]" />
          <h2 className="mt-4 text-lg font-semibold text-slate-900">
            We couldn't check your acceptance of the platform terms
          </h2>
          <p className="mt-2 text-sm text-slate-600">{error.message}</p>
          <div className="mt-6 flex justify-center gap-3">
            <button
              onClick={logout}
              className="rounded-xl border-2 border-[#EA8024] px-6 py-2.5 font-semibold text-[#EA8024] cursor-pointer"
            >
              Log out
            </button>
            <button
              onClick={() => mutate()}
              className="rounded-xl bg-gradient-to-r from-[#EA8024] to-[#FFBB00] px-6 py-2.5 font-semibold text-white cursor-pointer"
            >
              Try again
            </button>
          </div>
        </div>
      ) : (
        <PulsingDotsLoader color="#EA8024" />
      )}
    </div>
  );
};

export default TermsGate;
