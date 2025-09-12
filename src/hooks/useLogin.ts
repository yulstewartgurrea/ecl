// src/hooks/useLogin.ts
import useSWRMutation from "swr/mutation";
import { useAppDispatch } from "../redux_toolkit/hooks";
import {
  login as loginAction,
  resetStateAuth,
} from "../redux_toolkit/features/general/auth";

import { fetch } from "@tauri-apps/plugin-http";

interface LoginPayload {
  username: string;
  password: string;
}

interface LoginResponse {
  access_token: string;
  role: string;
}

const API_BASE =
  (import.meta.env.VITE_API_URL as string) || "http://127.0.0.1:8000";
const LOGIN_URL = `${API_BASE.replace(/\/$/, "")}/login`; // ensure no trailing slash issues

async function fetchWithTimeout(
  input: RequestInfo,
  init?: RequestInit,
  timeout = 15000
) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    clearTimeout(id);
    return res;
  } catch (err) {
    clearTimeout(id);
    throw err;
  }
}

async function loginFetcher(
  url: string,
  { arg }: { arg: LoginPayload }
): Promise<LoginResponse> {
  let res;
  try {
    res = await fetchWithTimeout(
      url,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(arg),
      },
      15000
    );
  } catch (err: any) {
    // network error / timeout / DNS / CORS-preflight blocked
    throw new Error(
      `Network error while contacting backend: ${err?.message || err}`
    );
  }

  // If backend responded but with non-2xx
  if (!res.ok) {
    // try get JSON detail if available
    const text = await res.text().catch(() => "");
    try {
      const json = text ? JSON.parse(text) : null;
      const detail = json?.detail || json?.message || text || res.statusText;
      throw new Error(`Login failed: ${detail} (status ${res.status})`);
    } catch {
      throw new Error(
        `Login failed: ${text || res.statusText} (status ${res.status})`
      );
    }
  }

  // parse JSON
  try {
    return await res.json();
  } catch {
    throw new Error("Backend returned invalid JSON.");
  }
}

export function useLogin() {
  const dispatch = useAppDispatch();

  const mutation = useSWRMutation<LoginResponse, Error, string, LoginPayload>(
    LOGIN_URL,
    loginFetcher
  );

  // Wrap trigger to handle dispatch after login
  const triggerWithDispatch = async (payload: LoginPayload) => {
    const data = await mutation.trigger(payload);
    dispatch(
      loginAction({
        username: payload.username, // use payload directly instead of arg
        token: data.access_token,
        role: data.role || "user",
      })
    );
    dispatch(resetStateAuth());
    localStorage.setItem("token", data.access_token);
    return data;
  };

  return {
    ...mutation,
    trigger: triggerWithDispatch,
  };
}
