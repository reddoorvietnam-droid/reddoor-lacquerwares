import type { FlipbookPreviewLabels } from "./flipbook-preview";

/**
 * Copy for the flipbook preview tool, shared by its two homes:
 *
 * - the administration portal page, which sits behind the server-side
 *   permission gate like every other portal surface, and
 * - the development-only route that exists so the reading experience can be
 *   reviewed before MongoDB and Google OAuth are configured. That route is
 *   compiled out of production builds entirely.
 *
 * The tool itself never uploads anything — the chosen file is read and
 * rendered inside the browser. Vietnamese and English only, matching the
 * administration locales.
 */

export type FlipbookPreviewPageCopy = {
  eyebrow: string;
  title: string;
  description: string;
  labels: FlipbookPreviewLabels;
};

export const flipbookPreviewCopy: Record<"vi" | "en", FlipbookPreviewPageCopy> =
  {
    vi: {
      eyebrow: "Công cụ xem thử",
      title: "Thử flipbook với file PDF của bạn",
      description:
        "Chọn một file PDF trên máy để xem ngay trải nghiệm lật trang. File được đọc và dựng hình hoàn toàn trong trình duyệt — không tải lên máy chủ.",
      labels: {
        localOnlyTitle: "File không rời khỏi máy bạn",
        localOnlyBody:
          "Công cụ này chỉ để duyệt trải nghiệm đọc và không lưu gì cả. Việc upload chính thức lên kho lưu trữ luôn yêu cầu đăng nhập và đúng quyền; đường dẫn xem thử công khai chỉ tồn tại ở môi trường phát triển và bị loại khỏi bản production.",
        pageCountTemplate: "{count} trang",
        chooseFile: "Chọn file PDF",
        chooseAnother: "Chọn file khác",
        hint: "Tối đa 10 MB, đúng bằng giới hạn của luồng chính thức.",
        reading: "Đang đọc file…",
        tooLarge: "File vượt quá giới hạn 10 MB.",
        notPdf: "File này không phải PDF hợp lệ.",
        failed: "Không đọc được file. File có thể hỏng hoặc được đặt mật khẩu.",
        previous: "Trang trước",
        next: "Trang sau",
        page: "Trang",
        of: "trên",
        fullscreen: "Toàn màn hình",
        exitFullscreen: "Thoát toàn màn hình",
        close: "Đóng",
        loading: "Đang dựng trang…",
        fallbackNotice:
          "Đang hiển thị ở chế độ đọc tuần tự vì bạn đã bật giảm chuyển động, hoặc hiệu ứng lật trang không khởi động được.",
      },
    },
    en: {
      eyebrow: "Preview tool",
      title: "Try the flipbook with your own PDF",
      description:
        "Choose a PDF from your device to see the page-turn experience. The file is read and rendered entirely in your browser — nothing is uploaded.",
      labels: {
        localOnlyTitle: "The file never leaves your device",
        localOnlyBody:
          "This tool only reviews the reading experience and stores nothing. The real upload into storage always requires sign-in and the right permission; the public preview route exists only in development and is compiled out of production builds.",
        pageCountTemplate: "{count} pages",
        chooseFile: "Choose a PDF",
        chooseAnother: "Choose another file",
        hint: "Up to 10 MB, the same limit the production flow applies.",
        reading: "Reading the file…",
        tooLarge: "The file is larger than the 10 MB limit.",
        notPdf: "This file is not a valid PDF.",
        failed:
          "The file could not be read. It may be damaged or password protected.",
        previous: "Previous page",
        next: "Next page",
        page: "Page",
        of: "of",
        fullscreen: "Full screen",
        exitFullscreen: "Exit full screen",
        close: "Close",
        loading: "Rendering the page…",
        fallbackNotice:
          "Showing the sequential reader because reduced motion is enabled, or the page-turn engine could not start.",
      },
    },
  };
