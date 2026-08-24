import { defaultLocale, isLocale, type Locale } from "@/lib/i18n/config";

export type LocalizedStateCopy = Readonly<{
  loading: string;
  error: Readonly<{
    eyebrow: string;
    title: string;
    body: string;
    retry: string;
  }>;
  notFound: Readonly<{
    eyebrow: string;
    title: string;
    body: string;
    home: string;
  }>;
  globalError: Readonly<{
    documentTitle: string;
    eyebrow: string;
    title: string;
    body: string;
    retry: string;
  }>;
}>;

export const stateCopy = {
  vi: {
    loading: "Đang tải nội dung",
    error: {
      eyebrow: "Đã xảy ra lỗi",
      title: "Trang hiện chưa thể hiển thị",
      body: "Vui lòng thử lại sau giây lát. Thông tin chẩn đoán nhạy cảm không được hiển thị trên trang này.",
      retry: "Thử lại",
    },
    notFound: {
      eyebrow: "404 · Không tìm thấy",
      title: "Lối này chưa mở",
      body: "Trang bạn yêu cầu không tồn tại hoặc bản dịch chưa được xuất bản.",
      home: "Về trang chủ",
    },
    globalError: {
      documentTitle: "Lỗi ứng dụng · Red Door",
      eyebrow: "Red Door · Khôi phục an toàn",
      title: "Ứng dụng cần được tải lại",
      body: "Không có thông tin chẩn đoán nhạy cảm nào được hiển thị. Vui lòng thử tải lại ứng dụng.",
      retry: "Thử lại",
    },
  },
  en: {
    loading: "Loading content",
    error: {
      eyebrow: "Something went wrong",
      title: "This page cannot be displayed right now",
      body: "Please try again in a moment. Sensitive diagnostic information is not displayed on this page.",
      retry: "Try again",
    },
    notFound: {
      eyebrow: "404 · Page not found",
      title: "This door is not open",
      body: "The requested page does not exist or its translation has not been published yet.",
      home: "Return home",
    },
    globalError: {
      documentTitle: "Application error · Red Door",
      eyebrow: "Red Door · Safe recovery",
      title: "The application needs to reload",
      body: "No sensitive diagnostic information is displayed. Please try loading the application again.",
      retry: "Try again",
    },
  },
  fr: {
    loading: "Chargement du contenu",
    error: {
      eyebrow: "Une erreur est survenue",
      title: "Cette page ne peut pas être affichée pour le moment",
      body: "Veuillez réessayer dans un instant. Aucune information de diagnostic sensible n’est affichée sur cette page.",
      retry: "Réessayer",
    },
    notFound: {
      eyebrow: "404 · Page introuvable",
      title: "Cette porte ne s’ouvre pas",
      body: "La page demandée n’existe pas ou sa traduction n’a pas encore été publiée.",
      home: "Retour à l’accueil",
    },
    globalError: {
      documentTitle: "Erreur de l’application · Red Door",
      eyebrow: "Red Door · Récupération sécurisée",
      title: "L’application doit être rechargée",
      body: "Aucune information de diagnostic sensible n’est affichée. Veuillez essayer de recharger l’application.",
      retry: "Réessayer",
    },
  },
  de: {
    loading: "Inhalt wird geladen",
    error: {
      eyebrow: "Etwas ist schiefgelaufen",
      title: "Diese Seite kann derzeit nicht angezeigt werden",
      body: "Bitte versuchen Sie es gleich noch einmal. Auf dieser Seite werden keine vertraulichen Diagnoseinformationen angezeigt.",
      retry: "Erneut versuchen",
    },
    notFound: {
      eyebrow: "404 · Seite nicht gefunden",
      title: "Diese Tür bleibt noch geschlossen",
      body: "Die angeforderte Seite existiert nicht oder ihre Übersetzung wurde noch nicht veröffentlicht.",
      home: "Zur Startseite",
    },
    globalError: {
      documentTitle: "Anwendungsfehler · Red Door",
      eyebrow: "Red Door · Sichere Wiederherstellung",
      title: "Die Anwendung muss neu geladen werden",
      body: "Es werden keine vertraulichen Diagnoseinformationen angezeigt. Bitte laden Sie die Anwendung erneut.",
      retry: "Erneut versuchen",
    },
  },
  ja: {
    loading: "コンテンツを読み込んでいます",
    error: {
      eyebrow: "エラーが発生しました",
      title: "このページは現在表示できません",
      body: "しばらくしてからもう一度お試しください。この画面には機密性の高い診断情報は表示されません。",
      retry: "もう一度試す",
    },
    notFound: {
      eyebrow: "404 · ページが見つかりません",
      title: "この扉はまだ開いていません",
      body: "お探しのページは存在しないか、翻訳がまだ公開されていません。",
      home: "ホームへ戻る",
    },
    globalError: {
      documentTitle: "アプリケーションエラー · Red Door",
      eyebrow: "Red Door · 安全な復旧",
      title: "アプリを再読み込みしてください",
      body: "機密性の高い診断情報は表示されていません。アプリをもう一度読み込んでください。",
      retry: "再試行",
    },
  },
  "zh-CN": {
    loading: "正在加载内容",
    error: {
      eyebrow: "发生错误",
      title: "暂时无法显示此页面",
      body: "请稍后重试。本页面不会显示任何敏感的诊断信息。",
      retry: "重试",
    },
    notFound: {
      eyebrow: "404 · 未找到页面",
      title: "这扇门尚未开启",
      body: "您访问的页面不存在，或其译文尚未发布。",
      home: "返回首页",
    },
    globalError: {
      documentTitle: "应用错误 · Red Door",
      eyebrow: "Red Door · 安全恢复",
      title: "应用需要重新加载",
      body: "页面不会显示任何敏感的诊断信息。请尝试重新加载应用。",
      retry: "重试",
    },
  },
} as const satisfies Record<Locale, LocalizedStateCopy>;

export function localeFromPathname(
  pathname: string | null | undefined,
): Locale {
  const firstSegment = pathname?.split("/").find(Boolean);
  return firstSegment && isLocale(firstSegment) ? firstSegment : defaultLocale;
}
