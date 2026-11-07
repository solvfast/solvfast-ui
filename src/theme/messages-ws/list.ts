/** Chrome strings added by the P35 "list" workstream (en + ar; the ar object must have every en key). */
export const listEn = {
  listAddDoctype: "Add {doctype}",
  listTags: "Tags",
  listNoTags: "No Tags",
  listNotSet: "Not Set",
  listMe: "Me",
};
export const listAr: { [K in keyof typeof listEn]: string } = {
  listAddDoctype: "إضافة {doctype}",
  listTags: "الوسوم",
  listNoTags: "بلا وسوم",
  listNotSet: "غير محدد",
  listMe: "أنا",
};
