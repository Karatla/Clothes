"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const apiBase = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

export default function LogoutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await fetch(`${apiBase}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } finally {
      setIsLoading(false);
      router.push("/login");
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isLoading}
      className="rounded-full border border-[#e4d7c5] bg-white px-4 py-2 text-sm text-[#6b645a] transition hover:border-[#a7652d] hover:text-[#1f1811] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? "正在退出..." : "退出登录"}
    </button>
  );
}
