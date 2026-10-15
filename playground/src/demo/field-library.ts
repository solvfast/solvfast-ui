/**
 * Sear's Field Library seed (sear_studio/pages/FieldLibrary/fieldLibraryStore.ts, baseline 7abc895-dirty; extracted, not
 * retyped). Sear dates them relative to load time (now / 3 days / 9 days ago); `modifiedDaysAgo` keeps that. Playground only.
 */
export interface FieldPresetRow { id: string; name: string; nameAr: string | null; description: string; fieldsCount: number; createdBy: string; modifiedDaysAgo: number; }
export const FIELD_PRESETS: FieldPresetRow[] = [
  {"id": "fp_corporate_booking", "name": "Corporate Travel Booking", "nameAr": "حجز سفر الشركات", "description": "A multi-section, two-column booking form — traveler, trip, and notes.", "fieldsCount": 11, "createdBy": "Sara Al-Otaibi", "modifiedDaysAgo": 0},
  {"id": "fp_visa_wizard", "name": "Visa Application (Wizard)", "nameAr": "طلب تأشيرة (معالج)", "description": "A step-by-step visa application: applicant, documents, then review.", "fieldsCount": 9, "createdBy": "Khaled Al-Mutairi", "modifiedDaysAgo": 0},
  {"id": "fp_bug_report", "name": "Portal Issue Report", "nameAr": "بلاغ مشكلة بالبوابة", "description": "Everything needed to triage a travel-portal issue — severity, steps, expected vs. actual, and environment.", "fieldsCount": 5, "createdBy": "Khaled Al-Mutairi", "modifiedDaysAgo": 0},
  {"id": "fp_contact_details", "name": "Traveler Details", "nameAr": "بيانات المسافر", "description": "Core traveler identity fields, reusable on any booking or visa form.", "fieldsCount": 4, "createdBy": "Sara Al-Otaibi", "modifiedDaysAgo": 3},
  {"id": "fp_company_information", "name": "Corporate Account", "nameAr": "حساب الشركة", "description": "Corporate travel account identification fields.", "fieldsCount": 3, "createdBy": "Omar Al-Shehri", "modifiedDaysAgo": 9},
  {"id": "fp_address_block", "name": "Trip Details", "nameAr": "تفاصيل الرحلة", "description": "Reusable trip fields for bookings and packages.", "fieldsCount": 4, "createdBy": "Sara Al-Otaibi", "modifiedDaysAgo": 3},
  {"id": "fp_compliance_documents", "name": "Visa Documents", "nameAr": "مستندات التأشيرة", "description": "Document uploads required for a visa application.", "fieldsCount": 4, "createdBy": "Khaled Al-Mutairi", "modifiedDaysAgo": 0},
  {"id": "fp_saudi_kyc", "name": "Corporate Account KYC", "nameAr": "اعرف عميلك للشركات", "description": "Know-Your-Customer documents and fields for corporate travel accounts.", "fieldsCount": 6, "createdBy": "Omar Al-Shehri", "modifiedDaysAgo": 0},
  {"id": "fp_priority_sla", "name": "Priority & SLA", "nameAr": "الأولوية واتفاقية الخدمة", "description": "Prioritisation and due-date fields for requests.", "fieldsCount": 3, "createdBy": "You", "modifiedDaysAgo": 0},
];
