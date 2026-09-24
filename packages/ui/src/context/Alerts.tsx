import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { IAlert } from "@/utils/types";
import { usePublicClient } from "wagmi";

const DEFAULT_ALERT_TIMEOUT = 7 * 1000;

export type AlertOptions = {
  type?: "success" | "info" | "error";
  description?: string;
  txHash?: string;
  timeout?: number;
};

export interface AlertContextProps {
  alerts: IAlert[];
  addAlert: (message: string, alertOptions?: AlertOptions) => void;
}

export const AlertContext = createContext<AlertContextProps | undefined>(undefined);

export const AlertProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const client = usePublicClient();

  // addAlert keeps one identity for the provider's lifetime. Hooks list it in the
  // dependencies of the effects that raise their alerts, so a new identity re-runs
  // those effects and raises the alert again; with a new one after every alert, that
  // looped for as long as the effect's condition held (e.g. while a transaction
  // confirms). Hence the list, timers and client are read through refs.
  const alertsRef = useRef<IAlert[]>([]);
  const timersRef = useRef(new Map<number, ReturnType<typeof setTimeout>>());
  const nextIdRef = useRef(0);
  const clientRef = useRef(client);
  clientRef.current = client;

  const removeAlert = useCallback((id: number) => {
    clearTimeout(timersRef.current.get(id));
    timersRef.current.delete(id);
    alertsRef.current = alertsRef.current.filter((alert) => alert.id !== id);
    setAlerts(alertsRef.current);
  }, []);

  const scheduleDismiss = useCallback(
    (id: number, timeout: number) => {
      clearTimeout(timersRef.current.get(id));
      timersRef.current.set(
        id,
        setTimeout(() => removeAlert(id), timeout)
      );
    },
    [removeAlert]
  );

  const addAlert = useCallback(
    (message: string, alertOptions?: AlertOptions) => {
      const type = alertOptions?.type ?? "info";
      const description = alertOptions?.description;
      const timeout = alertOptions?.timeout ?? DEFAULT_ALERT_TIMEOUT;
      const publicClient = clientRef.current;
      const explorerLink =
        alertOptions?.txHash && publicClient
          ? publicClient.chain.blockExplorers?.default.url + "/tx/" + alertOptions.txHash
          : undefined;

      // An alert already on screen only has its dismissal pushed back. The list is left
      // untouched, so a repeat causes no re-render and can never feed a loop. Match on
      // the type as stored (defaulted), so untyped alerts dedupe too.
      const existing = alertsRef.current.find(
        (alert) =>
          alert.message === message &&
          alert.description === description &&
          alert.type === type &&
          alert.explorerLink === explorerLink
      );
      if (existing) {
        scheduleDismiss(existing.id, timeout);
        return;
      }

      const newAlert: IAlert = { id: nextIdRef.current++, message, description, type, explorerLink };
      alertsRef.current = alertsRef.current.concat(newAlert);
      setAlerts(alertsRef.current);
      scheduleDismiss(newAlert.id, timeout);
    },
    [scheduleDismiss]
  );

  const value = useMemo(() => ({ alerts, addAlert }), [alerts, addAlert]);

  return <AlertContext.Provider value={value}>{children}</AlertContext.Provider>;
};

export const useAlerts = () => {
  const context = useContext(AlertContext);

  if (!context) {
    throw new Error("useContext must be used inside the AlertProvider");
  }

  return context;
};
