import { Skeleton } from "../../primitives/skeleton";
import { useLocale } from "../../theme/ThemeProvider";
import { loc, type Localized } from "../../lib/localized";
import { FrappeForm, type FrappeFormProps } from "../form/FrappeForm";
import { useFamilyRecord, type FamilyDescriptor } from "./family";

export interface FrappeFamilyRecordProps extends Omit<FrappeFormProps, "doctype" | "name"> {
  family: FamilyDescriptor;
  /** The parent row's name (e.g. "TKT-00042"). */
  name: string;
  /** Shown when the parent row does not exist or names no record. Default "This record was not found." */
  notFound?: Localized;
}

/** A family record opened from its parent row: the form of the record in its type's DocType, where it is edited. */
export function FrappeFamilyRecord({ family, name, notFound, ...form }: FrappeFamilyRecordProps) {
  const { t, language } = useLocale();
  const record = useFamilyRecord(family, name);
  if (record.isPending) return <Skeleton className="h-64 rounded-2xl" />;
  if (record.isError) {
    const missing = (record.error as Error).message === "not-found";
    return <p className="text-sm text-destructive">{missing ? loc(notFound, language) || t("famNotFound") : (record.error as Error).message}</p>;
  }
  return <FrappeForm key={`${record.data.doctype}:${record.data.name}`} {...form} doctype={record.data.doctype} name={record.data.name} />;
}
