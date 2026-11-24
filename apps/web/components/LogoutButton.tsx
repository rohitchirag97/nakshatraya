"use client";

import { useRouter } from "next/navigation";
import { send } from "@/lib/client";

export function LogoutButton({ label }: { label: string }) {
  const router = useRouter();
  return (
    <button
      type="button"
      className="nav-link"
      onClick={async () => {
        await send("/api/auth/logout");
        router.push("/");
        router.refresh();
      }}
    >
      {label}
    </button>
  );
}
