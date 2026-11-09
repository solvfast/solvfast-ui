/** Chrome strings added by the P36d "fields" workstream (en + ar; the ar object must have every en key). */
export const fieldsEn = {
  /** Desk's paste warning on a Data / Link input with a maxlength (data.js:19-62, msgprint title "Data Clipped"). */
  fieldsDataClippedTitle: "Data Clipped",
  fieldsDataClipped: "The value you pasted was {length} characters long. Max allowed characters is {max}.",
};
export const fieldsAr: { [K in keyof typeof fieldsEn]: string } = {
  fieldsDataClippedTitle: "تم اقتطاع البيانات",
  fieldsDataClipped: "طول القيمة التي لصقتها {length} حرفًا. الحد الأقصى المسموح به {max} حرفًا.",
};
