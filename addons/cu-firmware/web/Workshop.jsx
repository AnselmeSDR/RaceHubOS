import { useTranslation } from "react-i18next";
export default function Workshop() {
  const { t, i18n } = useTranslation("cu-firmware");
  return (
    <div className="p-4 space-y-4">
      <h1 className="text-2xl font-bold">{t("nav")}</h1>
      <p className="text-muted-foreground">{t("description")}</p>
      <iframe
        title={t("nav")}
        src={`/api/addons/cu-firmware/assets/index.html?lang=${encodeURIComponent(i18n.resolvedLanguage || i18n.language || "de")}`}
        className="w-full rounded-xl border bg-background"
        style={{ height: "calc(100vh - 180px)", minHeight: 600 }}
      />
    </div>
  );
}
