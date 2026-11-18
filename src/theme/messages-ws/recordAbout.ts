/** Chrome strings of the About cards (RecordInteractions, `rpg*`). en + ar; the ar object must have every en key. Hosts
 *  can pass `labels` instead. */
export const recordAboutEn = {
  rpgInteractions: "Recent Interactions",
  rpgInbound: "Inbound",
  rpgOutbound: "Outbound",
  rpgNoInteractions: "No interactions yet",
};
export const recordAboutAr: { [K in keyof typeof recordAboutEn]: string } = {
  rpgInteractions: "التفاعلات الأخيرة",
  rpgInbound: "واردة",
  rpgOutbound: "صادرة",
  rpgNoInteractions: "لا توجد تفاعلات بعد",
};
