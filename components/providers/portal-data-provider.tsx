"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useAuth } from "@/components/providers/auth-provider";
import { countActionRequired } from "@/lib/dashboard";
import { friendlyError } from "@/lib/errors";
import { subscribeCurrentAuthorisations } from "@/lib/repos/authorisations";
import { subscribeCompanies } from "@/lib/repos/companies";
import { subscribeDepartments } from "@/lib/repos/departments";
import { subscribeDesignations } from "@/lib/repos/designations";
import { subscribeEmployees } from "@/lib/repos/employees";
import { accessibleCompanyIds, type Authorisation, type Company, type Department, type Designation, type Employee } from "@/lib/schemas";

export interface PortalData {
  loading: boolean;
  error: string | null;
  companies: Company[];
  /** Companies the current user may see (admin: all; hr: their companyIds). */
  accessibleCompanies: Company[];
  departments: Department[];
  designations: Designation[];
  employees: Employee[];
  currentAuths: Authorisation[];
  actionRequiredCount: number;
  /** Re-evaluated every minute so "today" rolls over at Maseru midnight. */
  now: Date;
}

export const PortalDataContext = createContext<PortalData | null>(null);

type Loaded<T> = T[] | null;

export function PortalDataProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const [companies, setCompanies] = useState<Loaded<Company>>(null);
  const [departments, setDepartments] = useState<Loaded<Department>>(null);
  const [designations, setDesignations] = useState<Loaded<Designation>>(null);
  const [employees, setEmployees] = useState<Loaded<Employee>>(null);
  const [currentAuths, setCurrentAuths] = useState<Loaded<Authorisation>>(null);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const onError = (err: unknown) => setError(friendlyError(err));
    const unsubs = [
      subscribeCompanies(setCompanies, onError),
      subscribeDepartments(setDepartments, onError),
      subscribeDesignations(setDesignations, onError),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const accessibleIds = useMemo(() => {
    if (!profile || !companies) return null;
    return accessibleCompanyIds(
      profile,
      companies.map((c) => c.id),
    );
  }, [profile, companies]);

  const accessKey = accessibleIds?.join("|") ?? null;

  useEffect(() => {
    if (accessKey === null) return;
    const ids = accessKey === "" ? [] : accessKey.split("|");
    const onError = (err: unknown) => setError(friendlyError(err));
    const unsubEmployees = subscribeEmployees(ids, setEmployees, onError);
    const unsubAuths = subscribeCurrentAuthorisations(ids, setCurrentAuths, onError);
    return () => {
      unsubEmployees();
      unsubAuths();
    };
  }, [accessKey]);

  const value = useMemo<PortalData>(() => {
    const allCompanies = companies ?? [];
    const ids = new Set(accessibleIds ?? []);
    const emps = employees ?? [];
    const auths = currentAuths ?? [];
    return {
      loading: !companies || !departments || !designations || !employees || !currentAuths,
      error,
      companies: allCompanies,
      accessibleCompanies: allCompanies.filter((c) => ids.has(c.id)),
      departments: departments ?? [],
      designations: designations ?? [],
      employees: emps,
      currentAuths: auths,
      actionRequiredCount: countActionRequired(emps, auths, now),
      now,
    };
  }, [companies, departments, designations, employees, currentAuths, accessibleIds, error, now]);

  return <PortalDataContext.Provider value={value}>{children}</PortalDataContext.Provider>;
}

export function usePortalData(): PortalData {
  const ctx = useContext(PortalDataContext);
  if (!ctx) throw new Error("usePortalData must be used inside <PortalDataProvider>.");
  return ctx;
}
